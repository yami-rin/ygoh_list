#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
魔法・罠カードの種類を更新するプログラム

yugioh_cards_master.csvの魔法・罠カードに対して、
公式データベースから詳細な種類（通常魔法、速攻魔法など）を取得し、
カードタイプ欄を更新します。
"""

import sys
import io
# Windows コンソールの文字化け対策
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import requests
from bs4 import BeautifulSoup
import csv
import time
import re
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

class SpellTrapTypeUpdater:
    """魔法・罠カードの種類更新クラス"""

    def __init__(self):
        self.base_url = "https://www.db.yugioh-card.com"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        }

        # セッションプール
        self.session_pool = []
        self.session_lock = threading.Lock()
        self.max_sessions = 5

        print("セッションプールを初期化中...")
        for i in range(self.max_sessions):
            session = requests.Session()
            session.headers.update(self.headers)
            adapter = requests.adapters.HTTPAdapter(
                pool_connections=10,
                pool_maxsize=10,
                max_retries=3
            )
            session.mount('http://', adapter)
            session.mount('https://', adapter)
            self.session_pool.append(session)

        # 初期アクセス
        self.session_pool[0].get(f"{self.base_url}/yugiohdb/?request_locale=ja")
        time.sleep(0.5)

        # 統計
        self.stats_lock = threading.Lock()
        self.updated_count = 0
        self.error_count = 0

    def get_spell_trap_type(self, card_id: str, session=None) -> str:
        """カードIDから魔法・罠の種類を取得"""
        try:
            if session is None:
                session = self.session_pool[0]

            url = f"{self.base_url}/yugiohdb/card_search.action?ope=2&cid={card_id}&request_locale=ja"
            response = session.get(url, timeout=10)
            response.encoding = 'utf-8'

            soup = BeautifulSoup(response.text, 'lxml')

            # item_box_valueから魔法・罠の種類を取得
            item_values = soup.find_all(class_='item_box_value')

            if item_values:
                first_value = item_values[0].text.strip()

                # 魔法の種類をチェック（「魔法使い族」と区別するため、完全一致または特定パターンで確認）
                spell_types = ['通常魔法', '速攻魔法', '永続魔法', 'フィールド魔法', '儀式魔法', '装備魔法']
                trap_types = ['通常罠', '永続罠', 'カウンター罠']

                for spell_type in spell_types:
                    if spell_type in first_value:
                        return spell_type

                for trap_type in trap_types:
                    if trap_type in first_value:
                        return trap_type

            return ''

        except Exception as e:
            print(f"  エラー (ID:{card_id}): {e}")
            return ''

    def update_csv(self, input_file: str, output_file: str = None):
        """CSVファイルの魔法・罠カードの種類を更新"""

        if output_file is None:
            output_file = input_file

        print(f"\n魔法・罠カードの種類更新を開始します...")
        print(f"入力ファイル: {input_file}")
        print(f"出力ファイル: {output_file}\n")

        # CSVを読み込み
        cards = []
        spell_trap_cards = []

        with open(input_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            for row in reader:
                cards.append(row)
                # 種族が「魔法」または「罠」のカードを抽出
                # 注意：「魔法使い族」は種族なので除外
                race = row.get('種族', '')
                card_type = row.get('カードタイプ', '')

                # 種族が正確に「魔法」か「罠」で、カードタイプが空のものを対象
                if race in ['魔法', '罠'] and not card_type:
                    spell_trap_cards.append(row)

        print(f"総カード数: {len(cards)}")
        print(f"更新対象の魔法・罠カード: {len(spell_trap_cards)}")

        if not spell_trap_cards:
            print("更新対象のカードがありません。")
            return

        # カードIDをキーにしたインデックスを作成
        card_index = {card['カードID']: card for card in cards}

        # バッチ処理で更新
        batch_size = 10
        total_processed = 0

        for i in range(0, len(spell_trap_cards), batch_size):
            batch = spell_trap_cards[i:i+batch_size]

            print(f"\n処理中: {i+1}-{min(i+batch_size, len(spell_trap_cards))}/{len(spell_trap_cards)}")

            with ThreadPoolExecutor(max_workers=self.max_sessions) as executor:
                futures = {}
                for j, card in enumerate(batch):
                    session = self.session_pool[j % len(self.session_pool)]
                    future = executor.submit(self.get_spell_trap_type, card['カードID'], session)
                    futures[future] = card

                for future in as_completed(futures):
                    card = futures[future]
                    try:
                        card_type = future.result(timeout=15)
                        if card_type:
                            # 元のカードを更新
                            card_index[card['カードID']]['カードタイプ'] = card_type
                            with self.stats_lock:
                                self.updated_count += 1
                            print(f"  更新: {card['名前']} -> {card_type}")
                        else:
                            print(f"  スキップ: {card['名前']} (種類取得失敗)")
                    except Exception as e:
                        with self.stats_lock:
                            self.error_count += 1
                        print(f"  エラー: {card['名前']} - {e}")

            total_processed += len(batch)

            # 進捗保存（100件ごと）
            if total_processed % 100 == 0:
                print(f"\n--- 中間保存 ({total_processed}/{len(spell_trap_cards)}) ---")
                self._save_csv(output_file, cards, fieldnames)

            time.sleep(0.3)

        # 最終保存
        print(f"\n--- 最終保存 ---")
        self._save_csv(output_file, cards, fieldnames)

        print(f"\n更新完了!")
        print(f"更新成功: {self.updated_count}")
        print(f"エラー: {self.error_count}")

    def _save_csv(self, output_file: str, cards: list, fieldnames: list):
        """CSVを保存"""
        with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(cards)
        print(f"保存完了: {output_file}")


def main():
    """メイン関数"""
    import argparse

    parser = argparse.ArgumentParser(description='魔法・罠カードの種類更新プログラム')
    parser.add_argument('--input', type=str,
                        default=r'C:\Users\とうふ\card_manager_web\yugioh_cards_master.csv',
                        help='入力CSVファイル')
    parser.add_argument('--output', type=str, default=None,
                        help='出力CSVファイル（省略時は入力ファイルを上書き）')
    parser.add_argument('--test', action='store_true',
                        help='テストモード（最初の10件のみ処理）')

    args = parser.parse_args()

    updater = SpellTrapTypeUpdater()

    if args.test:
        print("テストモード: 最初の10件のみ処理します")
        # テスト用に別ファイルに出力
        test_output = r'C:\Users\とうふ\card_manager_web\yugioh_cards_master_test.csv'
        updater.update_csv(args.input, test_output)
    else:
        updater.update_csv(args.input, args.output)


if __name__ == "__main__":
    main()
