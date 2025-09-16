#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
取得したCSVファイルを分析して、魔法・罠カードの分類を確認
"""

import csv
import sys
from collections import Counter

def analyze_csv(filename):
    """CSVファイルを分析して統計を表示"""

    card_types = Counter()
    species_types = Counter()
    spell_cards = []
    trap_cards = []

    try:
        with open(filename, 'r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile)

            for row in reader:
                species = row.get('種族', '')
                card_type = row.get('カードタイプ', '')
                name = row.get('名前', '')

                # 種族でカウント
                if species:
                    species_types[species] += 1

                    # 魔法・罠カードをリストに追加
                    if '魔法' in species or 'spell' in species.lower():
                        spell_cards.append(name)
                    elif '罠' in species or 'trap' in species.lower():
                        trap_cards.append(name)

                # カードタイプでカウント
                if card_type:
                    card_types[card_type] += 1

    except FileNotFoundError:
        print(f"ファイル {filename} が見つかりません")
        return
    except Exception as e:
        print(f"エラー: {e}")
        return

    # 結果を表示
    print("=== カード分析結果 ===\n")

    print("【種族別カウント】")
    for species, count in species_types.most_common():
        print(f"  {species}: {count}枚")

    print("\n【カードタイプ別カウント】")
    for card_type, count in card_types.most_common():
        if card_type:
            print(f"  {card_type}: {count}枚")

    print(f"\n【魔法カード】 {len(spell_cards)}枚")
    for i, card in enumerate(spell_cards[:10], 1):
        print(f"  {i}. {card}")
    if len(spell_cards) > 10:
        print(f"  ... 他{len(spell_cards) - 10}枚")

    print(f"\n【罠カード】 {len(trap_cards)}枚")
    for i, card in enumerate(trap_cards[:10], 1):
        print(f"  {i}. {card}")
    if len(trap_cards) > 10:
        print(f"  ... 他{len(trap_cards) - 10}枚")

    # 統計サマリー
    total_cards = sum(species_types.values())
    print(f"\n【統計サマリー】")
    print(f"  総カード数: {total_cards}枚")
    print(f"  モンスター: {total_cards - len(spell_cards) - len(trap_cards)}枚")
    print(f"  魔法: {len(spell_cards)}枚 ({len(spell_cards)/total_cards*100:.1f}%)")
    print(f"  罠: {len(trap_cards)}枚 ({len(trap_cards)/total_cards*100:.1f}%)")

if __name__ == "__main__":
    # デフォルトファイル名
    filename = "test_10_cards.csv"

    # コマンドライン引数があればそれを使用
    if len(sys.argv) > 1:
        filename = sys.argv[1]

    print(f"ファイル '{filename}' を分析中...\n")
    analyze_csv(filename)