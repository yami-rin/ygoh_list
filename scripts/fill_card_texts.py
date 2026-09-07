#!/usr/bin/env python3
"""Untitled-1.pyと同じ公式DBから、既存マスターの本文だけを補完する。

Usage: python scripts/fill_card_texts.py [--apply]
Requires: requests, beautifulsoup4, lxml
検索結果100件単位で取得し、カードIDと名前を照合する。TMPの取得済みページを
再利用して再開できる。再取得する場合は別の --cache-dir を指定する。
"""
import argparse
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://www.db.yugioh-card.com/yugiohdb/card_search.action'


def clean_text(element):
    if element is None:
        return ''
    # 検索結果は改行が &lt;br&gt;、詳細画面は実際のbrの場合がある。
    # 既存Webの行単位CSV読込との互換性を維持し、本文を1行にする。
    text = element.get_text(' ', strip=True)
    return re.sub(r'\s+', ' ', re.sub(r'<br\s*/?>', ' ', text, flags=re.I)).strip()


def parse_page(html):
    soup = BeautifulSoup(html, 'lxml')
    cards = {}
    for row in soup.select('#card_list .t_row'):
        cid = row.select_one('input.cid')
        name = row.select_one('.card_name') or row.select_one('input.cnm')
        body = row.select_one('.box_card_text')
        if cid is None or name is None or body is None:
            raise ValueError('公式DBのカード行構造が変わっています')
        card_id = cid['value']
        if card_id in cards:
            raise ValueError(f'同一ページに重複ID: {card_id}')
        cards[card_id] = {
            'name': clean_text(name) if name.name != 'input' else name['value'],
            'text': clean_text(body),
            'pendulum': clean_text(row.select_one('.box_card_pen_effect')),
        }
    if not cards:
        raise ValueError('カード一覧が空です（エラーページの可能性）')
    return soup, cards


def read_csv(data):
    reader = csv.DictReader(io.StringIO(data.decode('utf-8-sig'), newline=''))
    rows = list(reader)
    if not reader.fieldnames or not {'カードID', '名前', 'カードテキスト'} <= set(reader.fieldnames):
        raise ValueError('必要なCSV列がありません')
    if any(None in row or any(v is None for v in row.values()) for row in rows):
        raise ValueError('CSVの列数が不正です')
    ids = [row['カードID'] for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError('CSVのカードIDが重複しています')
    return reader.fieldnames, rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--master', type=Path, default=ROOT / 'yugioh_cards_master.csv')
    parser.add_argument('--cache-dir', type=Path, default=ROOT / 'TMP' / 'card-text-fetch')
    parser.add_argument('--apply', action='store_true', help='全件照合成功時にマスターへ反映')
    args = parser.parse_args()
    original = args.master.read_bytes()
    fields, rows = read_csv(original)
    cache = args.cache_dir
    cache.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja'})

    def fetch(page):
        path = cache / f'page-{page:03}.html'
        if path.exists():
            return parse_page(path.read_text(encoding='utf-8'))
        for attempt in range(4):
            try:
                response = session.get(URL, params={
                    'ope': 1, 'sess': 1, 'rp': 100, 'stype': 1,
                    'sort': 21, 'request_locale': 'ja', 'page': page,
                }, timeout=45)
                response.raise_for_status()
                html = response.content.decode('utf-8')
                result = parse_page(html)
                path.write_text(html, encoding='utf-8')
                time.sleep(0.25)
                return result
            except (requests.RequestException, ValueError):
                if attempt == 3:
                    raise
                time.sleep(2 ** (attempt + 1))

    soup, cards = fetch(1)
    links = soup.select('.page_num a')
    pages = max([1] + [int(m.group(1)) for a in links
                       if (m := re.search(r'ChangePage\((\d+)\)', a.get('href', '')))])
    for page in range(2, pages + 1):
        _, batch = fetch(page)
        if cards.keys() & batch.keys():
            raise ValueError(f'ページ{page}: ページ間で重複ID（取得中に一覧が変化した可能性）')
        cards.update(batch)
        if page % 10 == 0 or page == pages:
            print(f'page {page}/{pages}: {len(cards)} cards', flush=True)

    missing, mismatched, empty, aliases = [], [], [], []
    updated = pendulums = 0
    for row in rows:
        card = cards.get(row['カードID'])
        if card is None:
            missing.append(row['カードID'])
            continue
        if card['name'] != row['名前']:
            # 初期マスターの英語名省略や、その後の日本語名追加を公式表記で照合。
            reading = row.get('読み方', '')
            matched = bool(reading) and reading == card['name']
            if not matched and reading:
                detail_path = cache / f'detail-{row["カードID"]}.html'
                if not detail_path.exists():
                    response = session.get(URL, params={'ope': 2, 'cid': row['カードID'],
                                                        'request_locale': 'ja'}, timeout=45)
                    response.raise_for_status()
                    detail_path.write_text(response.content.decode('utf-8'), encoding='utf-8')
                    time.sleep(0.25)
                detail = BeautifulSoup(detail_path.read_text(encoding='utf-8'), 'lxml')
                official_names = {clean_text(e) for e in detail.select('h1 span:not(.ruby)')}
                title_name = detail.title.get_text().split(' | ')[0] if detail.title else ''
                matched = reading in official_names and title_name == card['name']
            difference = {'id': row['カードID'], 'master': row['名前'], 'source': card['name']}
            if not matched:
                mismatched.append(difference)
                continue
            aliases.append(difference)
        if not card['text']:
            empty.append(row['カードID'])
            continue
        if card['pendulum']:
            pendulums += 1
        if not row['カードテキスト'].strip():
            row['カードテキスト'] = (
                f'【ペンデュラム効果】{card["pendulum"]} 【カードテキスト】{card["text"]}'
                if card['pendulum'] else card['text'])
            updated += 1

    report = {
        'verified_at': datetime.now(timezone.utc).isoformat(),
        'source': URL + '?ope=1&sess=1&rp=100&stype=1&sort=21&request_locale=ja',
        'master_sha256_before': hashlib.sha256(original).hexdigest(),
        'master_rows': len(rows), 'source_cards': len(cards), 'pages': pages,
        'filled': updated, 'pendulum_cards': pendulums,
        'missing_ids': missing, 'name_mismatches': mismatched, 'empty_source_ids': empty,
        'verified_name_aliases': aliases,
    }
    (cache / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    if missing or mismatched or empty:
        raise SystemExit('照合未完了のためマスターを変更しません。report.jsonを確認してください。')
    if not args.apply:
        print('検証のみ完了。反映するには --apply を指定してください。')
        return
    if args.master.read_bytes() != original:
        raise SystemExit('実行中にマスターが変更されたため停止しました。再実行してください。')
    backup = cache / ('master-before-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.csv')
    shutil.copy2(args.master, backup)
    temp = args.master.with_suffix('.csv.tmp')
    try:
        with temp.open('w', encoding='utf-8-sig', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
            writer.writeheader()
            writer.writerows(rows)
        after_fields, after = read_csv(temp.read_bytes())
        _, before = read_csv(original)
        assert after_fields == fields and len(after) == len(before)
        assert all(a[k] == b[k] for a, b in zip(after, before) for k in fields if k != 'カードテキスト')
        assert all(row['カードテキスト'].strip() for row in after)
        os.replace(temp, args.master)
    finally:
        temp.unlink(missing_ok=True)
    print(f'反映完了: {updated}件。バックアップ: {backup}', flush=True)


if __name__ == '__main__':
    main()
