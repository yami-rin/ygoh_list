#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
アイヴィ・シャックルの詳細デバッグ
"""

import requests
from bs4 import BeautifulSoup
import sys
import io

# 標準出力をUTF-8に設定
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def debug_card():
    url = "https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=2&cid=8065&request_locale=ja"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    response = requests.get(url, headers=headers)
    response.encoding = 'utf-8'
    soup = BeautifulSoup(response.text, 'html.parser')

    print("=== デバッグ情報 ===\n")

    # アイコン画像を探す
    print("【アイコン画像の検索】")
    trap_icon = soup.select_one('img[src*="TRAP"]')
    spell_icon = soup.select_one('img[src*="SPELL"], img[src*="MAGIC"]')

    print(f"  罠アイコン: {trap_icon['src'] if trap_icon else '見つかりません'}")
    print(f"  魔法アイコン: {spell_icon['src'] if spell_icon else '見つかりません'}")

    # すべてのimg要素を確認
    all_imgs = soup.select('img[src*="CARD"]')
    print(f"\n  CARD を含む画像: {len(all_imgs)}個")
    for img in all_imgs[:5]:
        print(f"    - {img['src']}")

    # box_card_specを探す
    print("\n【box_card_spec の内容】")
    card_spec = soup.select_one('.box_card_spec')
    if card_spec:
        print(f"  {card_spec.text.strip()[:100]}...")
    else:
        print("  見つかりません")

    # species要素を確認
    print("\n【species要素】")
    species_elem = soup.select_one('p.species')
    if species_elem:
        print(f"  テキスト: {species_elem.text.strip()}")
        spans = species_elem.select('span')
        for i, span in enumerate(spans):
            print(f"  span[{i}]: {span.text.strip()}")
    else:
        print("  見つかりません")

    # カードのタイトルエリアを確認
    print("\n【その他の手がかり】")

    # frame_typeを探す
    frame = soup.select_one('[class*="frame_"]')
    if frame:
        print(f"  フレームクラス: {frame.get('class')}")

    # item_box_valueの内容
    item_values = soup.select('.item_box_value')
    print(f"  item_box_value: {len(item_values)}個")
    for i, val in enumerate(item_values[:3]):
        print(f"    [{i}]: {val.text.strip()}")

    print("\n【重要: 最初のitem_box_valueの詳細】")
    if item_values:
        first_value = item_values[0]
        print(f"  テキスト: '{first_value.text.strip()}'")
        print(f"  HTMLタグ: {first_value.name}")
        print(f"  クラス: {first_value.get('class')}")

        # 親要素を確認
        parent = first_value.parent
        if parent:
            print(f"  親要素: {parent.name}, クラス: {parent.get('class')}")

        # 子要素を確認
        children = first_value.find_all()
        if children:
            print(f"  子要素: {len(children)}個")
            for child in children[:3]:
                print(f"    - {child.name}: {child.text.strip()[:30]}")

    print("\n【カードタイプの判定に使える要素】")
    # 永続罠のテキストを直接探す
    if "永続罠" in response.text:
        print("  '永続罠' が見つかりました！")
    if "通常罠" in response.text:
        print("  '通常罠' が見つかりました！")
    if "カウンター罠" in response.text:
        print("  'カウンター罠' が見つかりました！")

if __name__ == "__main__":
    debug_card()