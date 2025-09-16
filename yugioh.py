#!/usr/bin/env python3



# -*- coding: utf-8 -*-





"""


遊戯王公式データベースからカード情報を取得するプログラム


指定されたURLから全てのカード情報を取得し、CSVファイルに保存します。


"""





import requests


from bs4 import BeautifulSoup


import csv


import time


import re


import sys

import os

from typing import Dict, List, Optional


from datetime import datetime








class YugiohCardScraper:


    """遊戯王カード情報取得クラス"""





    def __init__(self):


        self.base_url = "https://www.db.yugioh-card.com"


        self.headers = {


            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',


            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',


            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',


            'Accept-Encoding': 'gzip, deflate, br',


            'Connection': 'keep-alive',


            'Upgrade-Insecure-Requests': '1',


        }


        self.session = requests.Session()


        self.session.headers.update(self.headers)





        # トップページにアクセスしてセッションを確立


        print("セッションを確立中...")


        self.session.get(f"{self.base_url}/yugiohdb/?request_locale=ja")


        time.sleep(1)





    def get_card_list_from_url(self, url: str) -> List[str]:


        """指定URLからカードのリンクを全て取得"""


        try:


            print(f"カード一覧を取得中...")


            response = self.session.get(url)


            response.encoding = 'utf-8'


            soup = BeautifulSoup(response.text, 'html.parser')





            print(f"  レスポンスステータス: {response.status_code}")





            card_links = []





            # t_row要素からCIDを取得


            rows = soup.select('.t_row')


            print(f"  t_row要素: {len(rows)}個")





            for row in rows:


                # CIDを取得


                cid_input = row.select_one('input.cid')


                if cid_input and 'value' in cid_input.attrs:


                    cid = cid_input['value']


                    # カード詳細ページのURLを構築


                    card_url = f"{self.base_url}/yugiohdb/card_search.action?ope=2&cid={cid}&request_locale=ja"


                    card_links.append(card_url)





                    # カード名も取得して表示（デバッグ用）


                    card_name_elem = row.select_one('.card_name')


                    if card_name_elem:


                        card_name = card_name_elem.text.strip()


                        print(f"    CID {cid}: {card_name}")





            print(f"  {len(card_links)}枚のカードを発見")


            return card_links





        except Exception as e:


            print(f"エラー: カード一覧の取得に失敗しました - {e}")


            return []





    def get_card_details(self, card_url: str) -> Optional[Dict]:


        """個別のカード詳細情報を取得"""


        try:

            # URLからカードIDを抽出
            cid_match = re.search(r'cid=(\d+)', card_url)
            card_id = cid_match.group(1) if cid_match else ''

            response = self.session.get(card_url)


            response.encoding = 'utf-8'


            soup = BeautifulSoup(response.text, 'html.parser')





            card_info = {'カードID': card_id}





            # 読み方を取得（日本語版の場合）


            ruby_elem = soup.select_one('span.ruby')


            if ruby_elem:


                card_info['読み方'] = ruby_elem.text.strip()


            else:


                card_info['読み方'] = ''





            # カード名を取得


            # h2タグを探す（英語版の場合）


            h2_elem = soup.select_one('h2')


            if h2_elem:


                card_info['名前'] = h2_elem.text.strip()


            else:


                # h1タグから取得（日本語版の場合）


                # h1タグの中で、span.rubyではない部分のテキストを取得


                h1_elem = soup.select_one('h1')


                if h1_elem:


                    # h1のクローンを作成


                    h1_clone = BeautifulSoup(str(h1_elem), 'html.parser').h1


                    # ruby要素を削除


                    for ruby in h1_clone.select('span.ruby'):


                        ruby.decompose()


                    # 残ったテキストから名前を取得


                    h1_text = h1_clone.text.strip()


                    lines = [line.strip() for line in h1_text.split('\n') if line.strip()]


                    # "遊戯王"を含む行をスキップ


                    for line in lines:


                        if '遊戯王' not in line and line and 'Heart of' not in line:


                            card_info['名前'] = line


                            break





            # 名前が取得できなかった場合、metaタグから取得


            if not card_info.get('名前'):


                meta_keywords = soup.select_one('meta[name="keywords"]')


                if meta_keywords and 'content' in meta_keywords.attrs:


                    keywords = meta_keywords['content'].split(',')


                    if keywords:


                        card_info['名前'] = keywords[0].strip()





            # デフォルト値を設定


            card_info.setdefault('名前', '')


            card_info.setdefault('読み方', '')





            # 種族とカードタイプを取得（p.species内のspan要素から）


            species_elem = soup.select_one('p.species')


            card_types = []  # カードの種類を格納するリスト





            if species_elem:


                species_spans = species_elem.select('span')


                if species_spans:


                    # 最初のspanが種族（例：悪魔族、ドラゴン族など）


                    card_info['種族'] = species_spans[0].text.strip()





                    # 2番目以降のspanからカードタイプを取得（／を除く）


                    for span in species_spans[1:]:


                        text = span.text.strip()


                        if text and text != '／' and text != '/':


                            card_types.append(text)


                else:


                    # spanがない場合はテキスト全体から取得


                    text = species_elem.text.strip()


                    parts = re.split(r'[／/]', text)


                    if parts:


                        card_info['種族'] = parts[0].strip()


                        if len(parts) > 1:


                            card_types = [p.strip() for p in parts[1:] if p.strip()]


            else:


                card_info['種族'] = ''





            # カードタイプを文字列として保存


            card_info['カードタイプ'] = '／'.join(card_types) if card_types else ''





            # item_box_valueから情報を取得


            item_values = soup.select('.item_box_value')





            # カードタイプを判定（item_valuesの数と種族で判定）


            if len(item_values) >= 2 and ('族' in card_info['種族'] or 'Type' in card_info['種族']):


                # モンスターカード


                card_type = 'monster'





                # レベル/ランク/リンク（item_valuesから取得）


                level_found = False


                for i, val in enumerate(item_values):


                    val_text = val.text.strip()


                    # レベル/ランク/リンクを含む要素を探す


                    if 'レベル' in val_text or 'ランク' in val_text or 'リンク' in val_text or 'Level' in val_text or 'Rank' in val_text or 'Link' in val_text:


                        level_match = re.search(r'\d+', val_text)


                        card_info['レベル'] = level_match.group() if level_match else ''


                        level_found = True


                        break





                if not level_found and len(item_values) > 0:


                    # 最初のitem_valueがレベルの可能性


                    val_text = item_values[0].text.strip()


                    if re.search(r'\d+', val_text):


                        level_match = re.search(r'\d+', val_text)


                        card_info['レベル'] = level_match.group() if level_match else ''





                # 攻撃力と守備力（ATK/DEFの値を探す）


                atk_found = False


                def_found = False





                for i, val in enumerate(item_values):


                    val_text = val.text.strip()


                    # 数字のみの要素を探す


                    if re.match(r'^[\d?？-]+$', val_text):


                        if not atk_found:


                            card_info['攻撃力'] = val_text


                            atk_found = True


                        elif not def_found:


                            card_info['守備力'] = val_text


                            def_found = True





                if not atk_found:


                    card_info['攻撃力'] = ''


                if not def_found:


                    card_info['守備力'] = ''





            else:


                # 魔法・罠カードの判定
                # 最も信頼できる方法: item_box_valueの最初の要素を確認
                item_values = soup.select('.item_box_value')
                first_item_value = item_values[0].text.strip() if item_values else ''

                # アイコン画像での判定（バックアップ）
                trap_icon = soup.select_one('img[src*="TRAP"]')
                spell_icon = soup.select_one('img[src*="SPELL"], img[src*="MAGIC"]')

                # box_card_specの内容も確認（バックアップ）
                card_spec = soup.select_one('.box_card_spec')
                spec_text = card_spec.text if card_spec else ''

                # item_box_valueから判定（最優先）
                if '罠' in first_item_value:
                    # 罠カード（通常罠、永続罠、カウンター罠など）
                    card_type = 'trap'
                    if not card_info['種族']:
                        card_info['種族'] = '罠'
                elif '魔法' in first_item_value:
                    # 魔法カード（通常魔法、永続魔法、速攻魔法など）
                    card_type = 'spell'
                    if not card_info['種族']:
                        card_info['種族'] = '魔法'
                elif trap_icon:
                    # 罠カードのアイコンが見つかった
                    card_type = 'trap'
                    if not card_info['種族']:
                        card_info['種族'] = '罠'
                elif spell_icon:
                    # 魔法カードのアイコンが見つかった
                    card_type = 'spell'
                    if not card_info['種族']:
                        card_info['種族'] = '魔法'
                elif '【罠カード' in spec_text or '【Trap Card' in spec_text:
                    # スペックテキストから罠カードを判定
                    card_type = 'trap'
                    if not card_info['種族']:
                        card_info['種族'] = '罠'
                elif '【魔法カード' in spec_text or '【Spell Card' in spec_text:
                    # スペックテキストから魔法カードを判定
                    card_type = 'spell'
                    if not card_info['種族']:
                        card_info['種族'] = '魔法'
                else:
                    # アイコンやスペックテキストから判定できない場合、種族テキストから判定
                    if species_elem:
                        species_text = species_elem.text.strip()
                        if '罠' in species_text or 'Trap' in species_text:
                            card_type = 'trap'
                            if not card_info['種族']:
                                card_info['種族'] = '罠'
                        else:
                            card_type = 'spell'
                            if not card_info['種族']:
                                card_info['種族'] = '魔法'
                    else:
                        # デフォルトは魔法
                        card_type = 'spell'
                        if not card_info['種族']:
                            card_info['種族'] = '魔法'





                card_info['レベル'] = ''


                card_info['攻撃力'] = ''


                card_info['守備力'] = ''





            # 属性を取得（モンスターのみ）


            if card_type == 'monster':


                attr_elem = soup.select_one('img[alt*="属性"], img[alt*="Attribute"]')


                if attr_elem and 'alt' in attr_elem.attrs:


                    alt_text = attr_elem['alt']


                    # 日本語の場合


                    if '属性' in alt_text:


                        card_info['属性'] = alt_text.replace('属性', '').strip()


                    # 英語の場合


                    else:


                        card_info['属性'] = alt_text.replace('Attribute', '').strip()


                else:


                    card_info['属性'] = ''


            else:


                card_info['属性'] = ''





            # カードテキストを取得（CardText内のitem_box_textから）


            card_text_elem = soup.select_one('.CardText .item_box_text')


            if card_text_elem:


                # text_titleを除外してテキスト部分のみ取得


                text_title = card_text_elem.select_one('.text_title')


                if text_title:


                    text_title.extract()  # titleを削除


                card_text = card_text_elem.get_text(separator=' ').strip()


                card_text = re.sub(r'\s+', ' ', card_text)


                card_info['カードテキスト'] = card_text


            else:


                # フォールバック: .textクラスを探す


                text_elem = soup.select_one('.text')


                if text_elem and '条件を絞って検索' not in text_elem.text:


                    card_text = text_elem.get_text(separator=' ').strip()


                    card_text = re.sub(r'\s+', ' ', card_text)


                    card_info['カードテキスト'] = card_text


                else:


                    card_info['カードテキスト'] = ''





            # デフォルト値を設定

            card_info.setdefault('カードID', '')
            card_info.setdefault('名前', '')


            card_info.setdefault('読み方', '')


            card_info.setdefault('レベル', '')


            card_info.setdefault('属性', '')


            card_info.setdefault('種族', '')


            card_info.setdefault('カードタイプ', '')


            card_info.setdefault('攻撃力', '')


            card_info.setdefault('守備力', '')


            card_info.setdefault('カードテキスト', '')





            return card_info





        except Exception as e:


            print(f"エラー: カード詳細の取得に失敗しました - {card_url} - {e}")


            return None





    def load_existing_card_ids(self, csv_file: str) -> set:
        """既存のCSVファイルからカードIDを読み込む"""
        existing_ids = set()

        try:
            if os.path.exists(csv_file):
                with open(csv_file, 'r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        if 'カードID' in row and row['カードID']:
                            existing_ids.add(row['カードID'])
                print(f"既存のカード: {len(existing_ids)}枚")
        except Exception as e:
            print(f"既存ファイルの読み込みエラー: {e}")

        return existing_ids

    def update_cards(self, base_url: str, output_file: str = None, max_cards: int = None):
        """新しいカードのみを追加（重複チェックあり）"""

        # 出力ファイル名を生成
        if not output_file:
            output_file = f'C:\\Users\\とうふ\\card_manager_web\\yugioh_cards_master.csv'
        elif not output_file.startswith('C:\\'):
            output_file = f'C:\\Users\\とうふ\\card_manager_web\\{output_file}'

        print(f"\n遊戯王カード情報の更新を開始します...")
        print(f"ファイル: {output_file}\n")

        # 既存のカードIDを読み込み
        existing_ids = self.load_existing_card_ids(output_file)

        cards_to_add = []
        total_checked = 0
        total_new = 0
        page = 1

        fieldnames = ['カードID', '名前', '読み方', 'レベル', '属性', '種族', 'カードタイプ', '攻撃力', '守備力', 'カードテキスト']

        # ファイルが存在しない場合は新規作成
        file_exists = os.path.exists(output_file)
        mode = 'a' if file_exists else 'w'

        with open(output_file, mode, newline='', encoding='utf-8-sig') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            # 新規ファイルの場合はヘッダーを書き込み
            if not file_exists:
                writer.writeheader()

            while True:
                # ページ番号を含むURLを構築
                if 'page=' in base_url:
                    url = re.sub(r'page=\d+', f'page={page}', base_url)
                else:
                    url = f"{base_url}&page={page}"

                print(f"\n========== ページ {page} をチェック中 ==========")
                card_links = self.get_card_list_from_url(url)

                if not card_links:
                    print(f"ページ {page}: カードが見つかりません。終了します。")
                    break

                print(f"ページ {page}: {len(card_links)}枚のカードを発見")

                for i, card_url in enumerate(card_links):
                    # URLからカードIDを抽出
                    cid_match = re.search(r'cid=(\d+)', card_url)
                    card_id = cid_match.group(1) if cid_match else None

                    if not card_id:
                        continue

                    total_checked += 1

                    # 既存のカードはスキップ
                    if card_id in existing_ids:
                        print(f"[{i+1}/{len(card_links)}] カードID {card_id}: スキップ（既存）")
                        continue

                    # 新しいカードの詳細を取得
                    print(f"\n[{i+1}/{len(card_links)}] 新しいカードを取得中 (ID: {card_id})...")
                    card_info = self.get_card_details(card_url)

                    if card_info and card_info['名前']:
                        cards_to_add.append(card_info)
                        existing_ids.add(card_id)  # 追加済みリストに加える
                        total_new += 1
                        print(f"  追加: {card_info['名前']} ({card_info['読み方']})")

                        # 10件ごとに保存
                        if len(cards_to_add) >= 10:
                            writer.writerows(cards_to_add)
                            csvfile.flush()  # 即座にディスクに書き込み
                            print(f"--- {len(cards_to_add)}件を保存 ---")
                            cards_to_add.clear()

                    # 最大数に達したら終了
                    if max_cards and total_new >= max_cards:
                        break

                    time.sleep(0.5)  # サーバーに負荷をかけないよう待機

                if max_cards and total_new >= max_cards:
                    print(f"\n指定された最大数 {max_cards} 件に達しました。")
                    break

                page += 1
                time.sleep(1)

            # 残りのカードを保存
            if cards_to_add:
                writer.writerows(cards_to_add)
                print(f"--- 残り{len(cards_to_add)}件を保存 ---")

        print(f"\n\n更新完了！")
        print(f"チェック数: {total_checked}枚")
        print(f"新規追加: {total_new}枚")
        print(f"既存カード: {len(existing_ids) - total_new}枚")
        print(f"合計: {len(existing_ids)}枚")

    def scrape_all_cards(self, base_url: str, output_file: str = None, max_cards: int = None):


        """全カードを取得してCSVに保存（ページング対応、1000件ごとに保存）"""





        # 出力ファイル名を生成


        if not output_file:


            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')


            output_file = f'C:\\Users\\とうふ\\card_manager_web\\yugioh_cards_all_{timestamp}.csv'
        elif not output_file.startswith('C:\\'):
            # 相対パスの場合は絶対パスに変換
            output_file = f'C:\\Users\\とうふ\\card_manager_web\\{output_file}'





        print(f"\n遊戯王カード情報取得を開始します...")


        print(f"出力ファイル: {output_file}\n")





        cards_batch = []


        total_saved_cards = 0


        page = 1


        total_cards_found = 0





        fieldnames = ['カードID', '名前', '読み方', 'レベル', '属性', '種族', 'カードタイプ', '攻撃力', '守備力', 'カードテキスト']





        with open(output_file, 'w', newline='', encoding='utf-8-sig') as csvfile:


            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)


            writer.writeheader()





            outer_loop_stop = False


            while not outer_loop_stop:


                # ページ番号を含むURLを構築


                if 'page=' in base_url:


                    url = re.sub(r'page=\d+', f'page={page}', base_url)


                else:


                    url = f"{base_url}&page={page}"





                print(f"\n========== ページ {page} を取得中 ==========")


                card_links = self.get_card_list_from_url(url)





                if not card_links:


                    print(f"ページ {page}: カードが見つかりませんでした。取得終了。")


                    break





                total_cards_found += len(card_links)


                print(f"ページ {page}: {len(card_links)}枚のカードを発見 (累計: {total_cards_found}枚)")





                for i, card_url in enumerate(card_links, 1):


                    # 全体の進捗を表示


                    overall_index = total_saved_cards + len(cards_batch) + 1


                    print(f"\n[{overall_index}/{total_cards_found}] カード情報を取得中 (ページ{page}の{i}/{len(card_links)})...")





                    card_info = self.get_card_details(card_url)


                    if card_info and card_info['名前']:


                        cards_batch.append(card_info)


                        print(f"  取得完了: {card_info['名前']} ({card_info['読み方']})")


                        print(f"    種族: {card_info['種族']}, タイプ: {card_info['カードタイプ']}, レベル: {card_info['レベル']}")


                        if card_info['攻撃力']:


                            print(f"    ATK: {card_info['攻撃力']}, DEF: {card_info['守備力']}")





                    # 1000件たまったら書き込む


                    if len(cards_batch) >= 1000:


                        print(f"\n--- 1000枚たまったため、{output_file} に書き込みます ---")


                        writer.writerows(cards_batch)


                        total_saved_cards += len(cards_batch)


                        cards_batch.clear()


                        print(f"--- 書き込み完了。現在までの合計保存枚数: {total_saved_cards}枚 ---")





                    # max_cardsが指定されていて、その数に達したら終了


                    if max_cards and (total_saved_cards + len(cards_batch)) >= max_cards:


                        print(f"\n指定された最大数 {max_cards} 枚に達しました。取得を終了します。")


                        outer_loop_stop = True


                        break


                    


                    time.sleep(0.3)





                if outer_loop_stop:


                    break





                page += 1


                print(f"\n次のページの取得まで少し待機します...")


                time.sleep(2)





            # ループ終了後、残りのカードを書き込む


            if cards_batch:


                print(f"\n--- 残りの{len(cards_batch)}枚を {output_file} に書き込みます ---")


                writer.writerows(cards_batch)


                total_saved_cards += len(cards_batch)


                cards_batch.clear()





        if total_saved_cards > 0:


            print(f"\n\n完了！ 合計{total_saved_cards}枚のカード情報を {output_file} に保存しました。")


            print(f"取得ページ数: {page}")


        else:


            print("\nカード情報を取得できませんでした。")








def main():


    """メイン関数"""


    import argparse





    # コマンドライン引数を解析


    parser = argparse.ArgumentParser(description='遊戯王カード情報取得プログラム')


    parser.add_argument('--max', type=int, default=None,


                        help='取得する最大カード数（指定しない場合は全て取得）')


    parser.add_argument('--output', type=str, default=None,


                        help='出力ファイル名（指定しない場合は自動生成）')


    parser.add_argument('--test', action='store_true',


                        help='テストモード（最初の10枚のみ取得）')

    parser.add_argument('--update', action='store_true',


                        help='更新モード（新しいカードのみ追加、重複チェックあり）')





    args = parser.parse_args()





    # ユーザーが指定したURL (100件ずつ取得、全ページ)


    base_url = "https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&rp=100&mode=&sort=1&keyword=&stype=1&ctype=&othercon=2&starfr=&starto=&pscalefr=&pscaleto=&linkmarkerfr=&linkmarkerto=&link_m=2&atkfr=&atkto=&deffr=&defto=&releaseDStart=1&releaseMStart=1&releaseYStart=1999&releaseDEnd=&releaseMEnd=&releaseYEnd="





    # スクレイパーを初期化して実行


    scraper = YugiohCardScraper()





    # 更新モードの場合


    if args.update:


        print("【更新モード】新しいカードのみを追加します（重複チェックあり）。")


        scraper.update_cards(base_url, output_file=args.output, max_cards=args.max)


    # テストモードの場合


    elif args.test:


        print("【テストモード】最初の10枚のみ取得します。")


        scraper.scrape_all_cards(base_url, output_file=args.output, max_cards=10)


    elif args.max:


        print(f"最大 {args.max} 枚のカードを取得します。")


        scraper.scrape_all_cards(base_url, output_file=args.output, max_cards=args.max)


    else:


        print("全てのカードを取得します。")


        scraper.scrape_all_cards(base_url, output_file=args.output)








if __name__ == "__main__":


    main()