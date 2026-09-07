# Astra Duel Lab

実際のOCGルール処理で人間とGPT-6 Astraが対戦するローカルアプリ。
要件と設計は[DESIGN.md](DESIGN.md)。カードマネージャー既存の手動シミュレーターとは別に起動する。

## このPCで起動

現在の対戦クライアントは **MDPro3版**。`start-native.cmd`をダブルクリックする。
「AI対戦」→「Astra — GPT-6」→「PLAY」→ルームの「準備完了」「ゲーム開始」で進む。
通常M∀LICEの40枚＋EX15枚を設定済み。デッキ編集はMDPro3のメニューを使う。
終了すると、このランチャーが起動したAstra接続も終了する。

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
対戦中の選択ごとにgpt-6-astraを呼ぶため、通信・Codexの使用枠と数秒〜数十秒以上の待ち時間がある。
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
