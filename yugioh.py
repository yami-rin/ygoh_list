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
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from queue import Queue
import lxml








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

        # セッションプールを作成（複数のセッションを使い回す）
        self.session_pool = []
        self.session_lock = threading.Lock()
        self.max_sessions = 5  # 同時接続数

        # 初期セッションを作成
        print("セッションプールを初期化中...")
        for i in range(self.max_sessions):
            session = requests.Session()
            session.headers.update(self.headers)
            # HTTP接続アダプタの設定（接続プールサイズを増やす）
            adapter = requests.adapters.HTTPAdapter(
                pool_connections=10,
                pool_maxsize=10,
                max_retries=3
            )
            session.mount('http://', adapter)
            session.mount('https://', adapter)
            self.session_pool.append(session)

        # 最初のセッションでトップページにアクセス
        self.session_pool[0].get(f"{self.base_url}/yugiohdb/?request_locale=ja")
        time.sleep(0.5)  # 待機時間を短縮

        # 統計情報
        self.stats_lock = threading.Lock()
        self.fetch_times = []
        self.parse_times = []





    def get_session(self):
        """セッションプールから利用可能なセッションを取得"""
        with self.session_lock:
            return self.session_pool[0]  # シンプルにラウンドロビン

    def get_card_list_from_url(self, url: str) -> List[str]:
        """指定URLからカードのリンクを全て取得"""
        try:
            print(f"カード一覧を取得中...")

            session = self.get_session()
            response = session.get(url, timeout=10)
            response.encoding = 'utf-8'

            # lxml パーサーを使用（高速）
            soup = BeautifulSoup(response.text, 'lxml')





            print(f"  レスポンスステータス: {response.status_code}")

            card_links = []

            # より効率的なセレクタを使用
            rows = soup.find_all('div', class_='t_row')
            print(f"  t_row要素: {len(rows)}個")

            for row in rows:
                # CIDを直接取得（find_allよりfindの方が高速）
                cid_input = row.find('input', class_='cid')

                if cid_input and cid_input.get('value'):
                    cid = cid_input['value']
                    # カード詳細ページのURLを構築
                    card_url = f"{self.base_url}/yugiohdb/card_search.action?ope=2&cid={cid}&request_locale=ja"
                    card_links.append(card_url)

                    # デバッグ出力を削減（10件ごとに表示）
                    if len(card_links) % 10 == 0:
                        card_name_elem = row.find('span', class_='card_name')
                        if card_name_elem:
                            card_name = card_name_elem.text.strip()
                            print(f"    ... {len(card_links)}件目: {card_name}")





            print(f"  {len(card_links)}枚のカードを発見")


            return card_links





        except Exception as e:


            print(f"エラー: カード一覧の取得に失敗しました - {e}")


            return []





    def get_card_details(self, card_url: str, session=None) -> Optional[Dict]:
        """個別のカード詳細情報を取得"""
        try:
            start_time = time.time()

            # URLからカードIDを抽出
            cid_match = re.search(r'cid=(\d+)', card_url)
            card_id = cid_match.group(1) if cid_match else ''

            # セッションが渡されなかった場合はプールから取得
            if session is None:
                session = self.get_session()

            response = session.get(card_url, timeout=10)
            response.encoding = 'utf-8'

            fetch_time = time.time() - start_time
            parse_start = time.time()

            # lxml パーサーを使用
            soup = BeautifulSoup(response.text, 'lxml')

            parse_time = time.time() - parse_start

            # 統計情報を記録
            with self.stats_lock:
                self.fetch_times.append(fetch_time)
                self.parse_times.append(parse_time)





            card_info = {'カードID': card_id}

            # 読み方を取得（高速化のためfindを使用）
            ruby_elem = soup.find('span', class_='ruby')
            card_info['読み方'] = ruby_elem.text.strip() if ruby_elem else ''





            # カード名を取得（高速化）
            h2_elem = soup.find('h2')
            if h2_elem:
                card_info['名前'] = h2_elem.text.strip()
            else:
                h1_elem = soup.find('h1')
                if h1_elem:
                    # 文字列操作で名前を抽出（BeautifulSoup再解析を避ける）
                    h1_text = h1_elem.get_text()
                    # rubyテキストを除外
                    if ruby_elem:
                        h1_text = h1_text.replace(ruby_elem.text, '')
                    lines = [line.strip() for line in h1_text.split('\n') if line.strip()]
                    for line in lines:
                        if '遊戯王' not in line and line and 'Heart of' not in line:
                            card_info['名前'] = line
                            break





            # 名前が取得できなかった場合、metaタグから取得
            if not card_info.get('名前'):
                meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
                if meta_keywords and meta_keywords.get('content'):
                    keywords = meta_keywords['content'].split(',')
                    if keywords:
                        card_info['名前'] = keywords[0].strip()





            # デフォルト値を設定
            card_info.setdefault('名前', '')
            card_info.setdefault('読み方', '')

            # 種族とカードタイプを取得（高速化）
            species_elem = soup.find('p', class_='species')


            card_types = []  # カードの種類を格納するリスト





            if species_elem:


                species_spans = species_elem.find_all('span')
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





            # item_box_valueから情報を取得（高速化）
            item_values = soup.find_all(class_='item_box_value')





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


                # 魔法・罠カードの判定（高速化）
                first_item_value = item_values[0].text.strip() if item_values else ''

                # アイコン画像での判定（find使用で高速化）
                trap_icon = soup.find('img', src=lambda x: x and 'TRAP' in x)
                spell_icon = soup.find('img', src=lambda x: x and ('SPELL' in x or 'MAGIC' in x))

                # box_card_specの内容も確認（バックアップ）
                card_spec = soup.find(class_='box_card_spec')
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





            # 属性を取得（モンスターのみ、高速化）
            if card_type == 'monster':
                attr_elem = soup.find('img', alt=lambda x: x and ('属性' in x or 'Attribute' in x))
                if attr_elem and attr_elem.get('alt'):


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





            # カードテキストを取得（高速化）
            card_text_elem = soup.find(class_='CardText')
            if card_text_elem:
                item_box_text = card_text_elem.find(class_='item_box_text')
                if item_box_text:
                    # text_titleを除外
                    text_title = item_box_text.find(class_='text_title')
                    if text_title:
                        text_title.extract()
                    card_text = item_box_text.get_text(separator=' ').strip()
                    card_text = re.sub(r'\s+', ' ', card_text)
                    card_info['カードテキスト'] = card_text
                else:
                    card_info['カードテキスト'] = ''
            else:
                # フォールバック
                text_elem = soup.find(class_='text')


                if text_elem and '条件を絞って検索' not in text_elem.text:


                    card_text = text_elem.get_text(separator=' ').strip()


                    card_text = re.sub(r'\s+', ' ', card_text)


                    card_info['カードテキスト'] = card_text


                else:


                    card_info['カードテキスト'] = ''





            # デフォルト値を設定（辞書の setdefault を一括で行う）
            defaults = {
                'カードID': '', '名前': '', '読み方': '', 'レベル': '',
                '属性': '', '種族': '', 'カードタイプ': '',
                '攻撃力': '', '守備力': '', 'カードテキスト': ''
            }
            for key, value in defaults.items():
                card_info.setdefault(key, value)

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

    def fetch_card_details_batch(self, card_urls: List[str], existing_ids: set) -> List[Dict]:
        """複数のカード詳細を並列で取得"""
        results = []

        with ThreadPoolExecutor(max_workers=self.max_sessions) as executor:
            # セッションを各スレッドに割り当て
            futures = {}
            for i, url in enumerate(card_urls):
                # URLからカードIDを抽出
                cid_match = re.search(r'cid=(\d+)', url)
                card_id = cid_match.group(1) if cid_match else None

                # 既存のカードはスキップ
                if card_id and card_id not in existing_ids:
                    session = self.session_pool[i % len(self.session_pool)]
                    future = executor.submit(self.get_card_details, url, session)
                    futures[future] = (url, card_id)

            # 結果を収集
            for future in as_completed(futures):
                try:
                    card_info = future.result(timeout=15)
                    if card_info and card_info['名前']:
                        results.append(card_info)
                        print(f"  取得: {card_info['名前']} (ID: {card_info['カードID']})")
                except Exception as e:
                    url, card_id = futures[future]
                    print(f"  エラー: カードID {card_id} の取得失敗 - {e}")

        return results

    def update_cards(self, base_url: str, output_file: str = None, max_cards: int = None):
        """新しいカードのみを追加（並列処理で高速化）"""

        # 出力ファイル名を生成
        if not output_file:
            output_file = f'C:\\Users\\とうふ\\card_manager_web\\yugioh_cards_master.csv'
        elif not output_file.startswith('C:\\'):
            output_file = f'C:\\Users\\とうふ\\card_manager_web\\{output_file}'

        print(f"\n遊戯王カード情報の更新を開始します（並列処理モード）...")
        print(f"ファイル: {output_file}")
        print(f"最大同時接続数: {self.max_sessions}\n")

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

                # URLからIDを抽出して既存チェック
                new_urls = []
                for url in card_links:
                    cid_match = re.search(r'cid=(\d+)', url)
                    card_id = cid_match.group(1) if cid_match else None
                    if card_id:
                        total_checked += 1
                        if card_id not in existing_ids:
                            new_urls.append(url)

                print(f"  新しいカード: {len(new_urls)}/{len(card_links)}枚")

                if new_urls:
                    # バッチ処理で並列取得
                    batch_size = min(10, len(new_urls))  # 10件ずつ処理
                    for i in range(0, len(new_urls), batch_size):
                        batch = new_urls[i:i+batch_size]

                        print(f"\nバッチ処理: {i+1}-{min(i+batch_size, len(new_urls))}/{len(new_urls)}")
                        batch_results = self.fetch_card_details_batch(batch, existing_ids)

                        for card_info in batch_results:
                            cards_to_add.append(card_info)
                            existing_ids.add(card_info['カードID'])
                            total_new += 1

                        # 10件ごとに保存
                        if len(cards_to_add) >= 10:
                            writer.writerows(cards_to_add)
                            csvfile.flush()
                            print(f"--- {len(cards_to_add)}件を保存 ---")
                            cards_to_add.clear()

                        # 最大数チェック
                        if max_cards and total_new >= max_cards:
                            break

                        # バッチ間の待機時間を短縮
                        time.sleep(0.2)

                if max_cards and total_new >= max_cards:
                    print(f"\n指定された最大数 {max_cards} 件に達しました。")
                    break

                page += 1
                time.sleep(0.5)  # ページ間の待機時間を短縮

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
        """全カードを取得してCSVに保存（並列処理で高速化）"""





        # 出力ファイル名を生成


        if not output_file:


            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')


            output_file = f'C:\\Users\\とうふ\\card_manager_web\\yugioh_cards_all_{timestamp}.csv'
        elif not output_file.startswith('C:\\'):
            # 相対パスの場合は絶対パスに変換
            output_file = f'C:\\Users\\とうふ\\card_manager_web\\{output_file}'





        print(f"\n遊戯王カード情報取得を開始します（並列処理モード）...")
        print(f"出力ファイル: {output_file}")
        print(f"最大同時接続数: {self.max_sessions}\n")





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





                # バッチ処理で並列取得
                batch_size = 10  # 10件ずつ処理
                for i in range(0, len(card_links), batch_size):
                    batch = card_links[i:i+batch_size]

                    overall_start = total_saved_cards + len(cards_batch) + 1
                    print(f"\nバッチ処理: [{overall_start}-{overall_start+len(batch)-1}/{total_cards_found}] (ページ{page})")

                    # 並列で詳細を取得
                    with ThreadPoolExecutor(max_workers=self.max_sessions) as executor:
                        futures = []
                        for j, url in enumerate(batch):
                            session = self.session_pool[j % len(self.session_pool)]
                            futures.append(executor.submit(self.get_card_details, url, session))

                        for future in as_completed(futures):
                            try:
                                card_info = future.result(timeout=15)
                                if card_info and card_info['名前']:
                                    cards_batch.append(card_info)
                                    print(f"  取得: {card_info['名前']} (ATK:{card_info['攻撃力']})" if card_info['攻撃力'] else f"  取得: {card_info['名前']}")
                            except Exception as e:
                                print(f"  エラー: {e}")





                    # 100件たまったら書き込む（より頻繁に保存）
                    if len(cards_batch) >= 100:


                        print(f"\n--- {len(cards_batch)}枚をファイルに書き込みます ---")


                        writer.writerows(cards_batch)


                        total_saved_cards += len(cards_batch)


                        cards_batch.clear()


                        print(f"--- 書き込み完了。現在までの合計保存枚数: {total_saved_cards}枚 ---")





                    # max_cardsチェック
                    if max_cards and (total_saved_cards + len(cards_batch)) >= max_cards:
                        print(f"\n指定された最大数 {max_cards} 枚に達しました。")
                        outer_loop_stop = True
                        break

                    # バッチ間の待機
                    if i + batch_size < len(card_links):
                        time.sleep(0.2)




                if outer_loop_stop:


                    break





                page += 1


                print(f"\n次のページへ...")
                time.sleep(0.5)  # ページ間の待機時間を短縮





            # ループ終了後、残りのカードを書き込む


            if cards_batch:


                print(f"\n--- 残りの{len(cards_batch)}枚を {output_file} に書き込みます ---")


                writer.writerows(cards_batch)


                total_saved_cards += len(cards_batch)


                cards_batch.clear()





        if total_saved_cards > 0:


            print(f"\n\n完了！ 合計{total_saved_cards}枚のカード情報を保存しました。")
            print(f"取得ページ数: {page}")

            # 統計情報を表示
            if self.fetch_times:
                avg_fetch = sum(self.fetch_times) / len(self.fetch_times)
                avg_parse = sum(self.parse_times) / len(self.parse_times)
                print(f"\n[パフォーマンス統計]")
                print(f"平均取得時間: {avg_fetch:.3f}秒")
                print(f"平均解析時間: {avg_parse:.3f}秒")
                print(f"合計処理時間: {avg_fetch + avg_parse:.3f}秒/カード")


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