#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
修正したyugioh.pyのテスト
魔法カードと罠カードが正しく判別されるか確認
"""

from yugioh import YugiohCardScraper
import sys

def test_card(scraper, cid, expected_type, card_name=""):
    """特定のカードをテストして種族を確認"""
    card_url = f"https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=2&cid={cid}&request_locale=ja"

    print(f"\nテスト: {card_name if card_name else cid}")
    print(f"URL: {card_url}")

    card_info = scraper.get_card_details(card_url)

    if card_info:
        print(f"カード名: {card_info['名前']}")
        print(f"種族: {card_info['種族']}")
        print(f"カードタイプ: {card_info['カードタイプ']}")

        # 判定結果を確認
        if expected_type == '魔法' and ('魔法' in card_info['種族'] or 'spell' in card_info['種族'].lower()):
            print("✅ 正しく魔法カードと判定されました")
            return True
        elif expected_type == '罠' and ('罠' in card_info['種族'] or 'trap' in card_info['種族'].lower()):
            print("✅ 正しく罠カードと判定されました")
            return True
        else:
            print(f"❌ 誤判定: 期待値={expected_type}, 実際={card_info['種族']}")
            return False
    else:
        print("❌ カード情報の取得に失敗しました")
        return False

def main():
    print("遊戯王カードスクレイパーの魔法/罠判定テストを開始します...")

    # スクレイパーを初期化
    scraper = YugiohCardScraper()

    # テストケース（実際のカードのCIDを使用）
    test_cases = [
        # 魔法カード
        {"cid": "4343", "type": "魔法", "name": "強欲な壺"},  # 有名な魔法カード
        {"cid": "4861", "type": "魔法", "name": "死者蘇生"},  # 有名な魔法カード

        # 罠カード
        {"cid": "5697", "type": "罠", "name": "奈落の落とし穴"},  # 有名な罠カード
        {"cid": "5318", "type": "罠", "name": "神の宣告"},  # 有名な罠カード
    ]

    success_count = 0
    total_count = len(test_cases)

    for test_case in test_cases:
        if test_card(scraper, test_case["cid"], test_case["type"], test_case["name"]):
            success_count += 1

    print(f"\n\n=== テスト結果 ===")
    print(f"成功: {success_count}/{total_count}")

    if success_count == total_count:
        print("✅ 全てのテストが成功しました！")
    else:
        print(f"❌ {total_count - success_count}個のテストが失敗しました")
        sys.exit(1)

if __name__ == "__main__":
    main()