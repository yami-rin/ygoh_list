# Astra Duel Lab

実際のOCGルール処理で人間とGPT-6 Astraが対戦するローカルアプリ。
要件と設計は[DESIGN.md](DESIGN.md)。カードマネージャー既存の手動シミュレーターとは別に起動する。

## このPCで起動

現在の対戦クライアントは **MDPro3版**。`start-native.cmd`をダブルクリックする。
「AI対戦」→「Astra — GPT-6」→「PLAY」→ルームの「準備完了」「ゲーム開始」で進む。
通常M∀LICEの40枚＋EX15枚を設定済み。デッキ編集はMDPro3のメニューを使う。
終了すると、このランチャーが起動したAstra接続も終了する。
二重起動はWindowsの名前付きMutexで拒否する。Astraの思考もネイティブ・ブラウザ版をまたいで1件に制限する（ローカル8789番を排他に使用）。
停止中は子プロセスの終了まで排他を維持する。

MDPro3のカード全体（枠・属性・レベル・効果欄）と対戦画面を使用する。
プリセット41種類の画像は既存シミュレーター向け素材から取得するため、MD本体のインストールは不要。
追加カードの画像は`runtime/MDPro3-client/Picture/Art/<passcode>.jpg`または`.png`で利用できる。
接続エラーは`runtime/native-astra-error.log`、クライアントは`runtime/native-client.log`に記録する。

以下は検証用に残した**旧ブラウザ試作**の操作方法。MDPro3版の完成UIを代用しない。
`node server.mjs`を実行し、http://127.0.0.1:8787 を開く。
対戦画面の「DUEL START」で開始。右側から行動を選択。複数枚選択は最後に「選択を確定」。
カードをクリックすると効果全文を表示。墓地・除外・EXの山はクリックで一覧。
「デッキ・新規対戦」でデッキを変更できる。YDKまたはカード名と枚数を貼り付け可能。
画面に接続エラーが出た場合は「Astraに再接続」。別モデルや固定AIへの自動代替はない。
ブラウザを閉じるだけではサーバーは終了しない。対戦を止めるときは先に降参する。

## 初回セットアップ

Node.js 24とPython 3.12以降を使う。Pythonにはrequestsが必要。

```powershell
cd C:\Project\card_manager_web\duel-lab
npm ci
& 'C:\Users\tofu\.local\bin\python.exe' scripts/setup.py
npm test
powershell.exe -NoProfile -ExecutionPolicy Bypass -File build-native.ps1
```

Codexへのログインは同梱CLI（`node node_modules/@openai/codex/bin/codex.js login`）から可能。
認証情報はアプリに保存しない。ユーザーのCodexログインを使う。通常は既存ログインで動作する。
カード本文をカード番号ごとに一度だけ送り、戦略メモを120字以内に抑えて待ち時間を減らす。
単純な行動選択2回の確認では9.7秒・7.7秒だった。複雑な盤面での平均や短縮率は未測定。
固定プリセットの先攻初動は保存ルートを自動入力し、終了後・妨害後・未対応の状態ではgpt-6-astraを呼ぶ。モデル判断には通信・Codexの使用枠と数秒〜数十秒以上の待ち時間がある。
開発作業を委譲するサブエージェントではなく、アプリの対戦相手として呼び出す。

ビルド時はMDPro3ソース、画面素材、プリセットの画像、対応するUnity 6000.0.24f1を取得する。
初回は数GBの取得とUnityの展開・ビルドが必要。取得版とハッシュは`native-sources.lock.json`。
Unityのライセンス認証はそのPCの環境を使う。

## MD画像（任意の補完）

```powershell
& 'C:\Users\tofu\.local\bin\python.exe' -m venv .venv
.venv/Scripts/python.exe -m pip install UnityPy==1.25.3
.venv/Scripts/python.exe scripts/extract-md.py
```

既定のSteam配置以外は `--game 'D:/SteamLibrary/steamapps/common/Yu-Gi-Oh!  Master Duel'`。
読み取り専用でアートを抽出し、data/imagesに保存する。ゲームは改造しない。
カード画像はローカル利用のみで、Gitへ追加しない。抽出後はprepare-mdpro3.pyとstage-mdpro3.pyを実行し、クライアントを再起動する。
MDに存在しない・未取得のカードは名前と効果全文で表示する。

## 事前検証した初動ルート

固定プリセットの全メイン26種類を分類し、主要展開・小展開・単独では伸びない例を[展開帳](docs/ONE_CARD_OPENINGS.md)にまとめた。
追加手札を要する例、ドロー依存、無妨害の確定展開を分け、配置順・帰還効果の使用回数も保存する。
生成元は`routes/`、索引は`opening-book.json`。`npm run openings:verify`で全保存入力を独立した実coreへ再生し、資料を再生成する。
手札はプリセットから実際に抜き取り、手札1枚を足した41枚のデッキで検証しない。
現在は[初動の自動入力](docs/OPENING_AUTOPLAY.md)へ接続済み。保存した無ドロー手順を読み、実際の5枚手札で候補を効果処理してから、MDPro3の合法な選択肢へ入力する。2枚組333種類を初期状態から探索する[実探索の進捗](docs/MULTI_SEARCH_COVERAGE.md)と、保存手順が各手札へ適用できるか調べる[適用検査](docs/MULTI_OPENINGS.md)は別に集計する。探索が未完了の組は最善性や不成立が証明されたものとして扱わない。
ドロー結果を仮定する枝は自動入力から除外し、既に持っているカードとの併せ持ちで調べる。相手の効果・無効化・追加ドロー・盤面や選択肢の不一致を検知したらAstraへ戻す。全合法手順・全妨害応答の網羅や最善性を保証しない。

以前の全分岐探索は[探索範囲と進捗](docs/SEARCH_COVERAGE.md)に履歴として残す。そこにあるドロー後の枝・再開コマンドは今回の探索方針の対象外。`npm run search:report`で過去資料を集約し、`npm run search:verify`で元資料との一致を検査できる。
全入力履歴と再開用checkpointはローカルの`runtime/search-*`に保存し、Gitには集計・代表ルート・証拠ファイルのハッシュを含める。新しいcheckoutでは未追跡checkpointを復元したものと扱わず、スクリプトから再探索する。
探索は対戦用AstraのCLIを起動しない。対戦側の単一起動制御を維持したまま、研究側でルールエンジンを並列実行する。
現在の再開入口は `scripts/search-multi-pairs-tribute.mjs`、集約は `node scripts/build-multi-search-report.mjs --tribute`。実Duelの再利用と、対象を限定した通常召喚取消しの縮約を使う。[高速化と移行](docs/MULTI_SEARCH_FAST.md)・[取消し処理と残件](docs/MULTI_SEARCH_TRIBUTE.md)に適用条件と検証を記録している。旧reference・fastのcheckpointは別ディレクトリに保持する。稼働中bridgeは読み込み済みの候補集を使うため、更新した候補集は次回起動時に読み込まれる。

## 検証と対応範囲

`python tests/native-server.py` は実ネイティブサーバーで正常デッキの受理と禁止・制限・準制限・同名4枚の拒否を検証する。
実画面ではAstraのM∀LICE展開と300LPを払う帰還を確認済み。全試合の完走・全裁定の検証は未実施。
`npm test` はブラウザ試作の実coreを用いた効果・チェーン・戦闘・情報遮断の試験。
`node tests/ui.mjs` は起動中のローカルサーバーに対するFirefoxブラウザ試験。
カードデータの存在とスクリプトの有無を登録時に検査するが、全14,000種超の全裁定を試験したものではない。
主要な選択プロトコルを実装。未対応・スクリプト例外は停止して表示する。
ルールは指定2026年7月のOCG。MDの禁止制限・独自ルールを再現するものではない。
ネイティブ版はMDPro3のリプレイ機能を使用する。旧ブラウザ版の公開ログは「ログ保存」から取得できる。
サーバー再起動後の対戦途中復元は未対応。

## 出典とライセンス

- [MDPro3](https://code.moenext.com/ElderLich/MDPro3) / [画面素材](https://code.moenext.com/sherry_chaos/mdpro3-assetbundles) / [カード画像](https://code.moenext.com/mycard/hd-arts)。上流コードの変更手順は`scripts/patch-mdpro3.py`と`setup-native.py`。
- [EDOPro core](https://github.com/edo9300/ygopro-core) / [CardScripts](https://github.com/ProjectIgnis/CardScripts)：AGPL-3.0-or-later。
- [ocgcore-wasm](https://github.com/n1xx1/ocgcore-wasm)：MITラッパー。0.1.2 + 0.1.4 WASM。
  scripts/patch-core.mjsにラッパーのメモリレイアウト・Queryパース修正を記録。
- [BabelCDB](https://github.com/ProjectIgnis/BabelCDB)、[日本語DB](https://github.com/mycard/ygopro-database)。取得版はsources.lock.json。
- [MD抽出の参考](https://github.com/daominah/yugioh_master_duel_card_art)。抽出器はUnityPy。
- [通常M∀LICEプリセット出典](https://www.db.yugioh-card.com/yugiohdb/member_deck.action?cgid=6fd2f84a87c3b5b275ff84004674cf4b&dno=695&request_locale=ja)。
- [2026年7月規制](https://www.yugioh-card.com/japan/event/limitregulation/?list=202607)。

本ディレクトリの独自アプリコードはAGPL-3.0-or-laterで提供。既存カードマネージャーのライセンスを変更しない。
カードの名称・文章・画像およびMD資産は各権利者に帰属。第三者のカード資産にこのコードのライセンスは適用しない。
