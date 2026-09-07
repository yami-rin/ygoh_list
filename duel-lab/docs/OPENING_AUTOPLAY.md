# 固定M∀LICEの初動自動入力

2026-09-08。MDPro3の実WindBotへ接続済み。ドロー内容を予測する探索は対象外とし、既知の併せ持ちで展開を検証する。

## 接続と判断

`start-native.cmd` → `native-bridge.mjs` → `opening-policy.mjs` → `opening-semantics.mjs` → MDPro3の実入力。従来の起動Mutex、HTTP認証・同時要求拒否、Astra CLI共通排他を維持する。

固定40枚＋EX15枚、先攻1ターン目、初期手札5枚・LP8000・空の盤面でのみ開始する。無ドロー79テンプレートの保存証拠を起動時に独立再生。実際の5枚を40枚から抜いたfixtureで、適合する候補を最大24件予備再生し、成功候補の盤面評価が最大のものを使う。評価は手動重みであり、勝率・貫通率ではない。

カード番号、効果番号、場の位置で入力を再解決するため、サーチやEXデッキの並び順に依存しない。追加手札の任意チェーンは、実際の候補へ「発動しない」を明示して再生する。素材の選び直し等、保存アダプタ未対応の入力はAstraへ渡す。

native protocol v2のrequestIdと、ドロー・相手効果・無効化・ターン・デュエルの履歴番号を照合。自分の手札・場・墓地・除外・EX・デッキ枚数・LP、相手の公開盤面と手札枚数を照合し、不一致時は当該セッションの保存手順を終了する。相手の非公開カード番号やデッキ順は参照しない。同一要求の再送は前回応答を返し、入力位置を進めない。

ルート終了後もAstraが残りの手札の伏せ、残りの展開、ターン終了を判断する。妨害後や追加ドロー後へルートをそのまま続けない。通常のAstraモデル呼び出しは従来どおり単一実行。診断時だけ`ASTRA_OPENING_DISABLED=1`で保存入力を無効にできる。

## 複数枚の検証範囲

新規29ルート（M∀LICE側9、サイバース側20）を追加。固定デッキの合法な2枚組333種類・物理組合せ780を全件検査し、79テンプレートの適合候補1,273件をすべて試行した。284組に既知手順を適用、49組は未対応。適用には小展開・罠を伏せるだけの手順も含むため、284を初動成功数として使わない。

両初期カードの使用証拠あり12組、相方が残る1枚手順261組、同名個体等の使用が未確定11組。全合法手順木の網羅ではなく、未対応は不成立証明ではない。3枚以上の全組合せも未検査。実際の5枚手札への適用時は再度効果処理する。

## 実nativeでの検証

実`ygoserver.dll`＋`ocgcore.dll`、MDPro3のGameClient/GameBehavior/GameAI/AstraDecisionBridge、製品のHTTP bridgeとopening policyで検証した。Unityの表示入口のみconsoleに置き換え、盤面処理・通信・入力コードは実物。各ルート完了時に手札・全ゾーン・LP・デッキ枚数を予備再生の終端と一致検査した。

| 初手（残りは固定した補助札） | 検証した終端 | LP | HTTP要求数 |
| --- | --- | ---: | ---: |
| Rabbit | アコード＋WHITE BINDER | 6200 | 61 |
| Cat＋コード・マジシャン | Crypter＋WHITE BINDER＋I：P＋GWC伏せ | 6200 | 75 |
| バックアップ＋うらら（手札コスト） | アコード＋トランスコード | 8000 | 39 |

終了確認用のAstra応答だけはテストstubがEnd Phase・任意チェーン辞退を返す。モデル自身がこのテストで終了を判断したとは扱わない。実HTTPのAstraへの分岐、認証、409排他、再送キャッシュも別途検査。妨害・ドロー履歴の観測は実native packet handler試験、保存手順の終了判断はpolicy試験で検証する。

直列実測ではRabbitの初回候補準備155ms、以後の判断は最大1ms。バックアップは初回301ms、以後最大1ms。HTTP通信・演出を除いたbridge内部時間であり、全対戦の平均やAstra判断時間の保証ではない。

Unity 6000.0.24で更新クライアントをビルドし、`runtime/MDPro3-client`へ配置済み。

## 再検証

```powershell
npm test
node scripts/survey-multi-openings.mjs --resume
node scripts/survey-multi-openings.mjs --verify
& C:/Users/tofu/.local/bin/python.exe tests/native-patch.py --runtime
# 対戦用bridgeを終了した状態で、HTTP経路だけを検査
node --test tests/native-bridge-http.mjs
# 以下の専用bridgeを別端末で起動（Astra CLIは呼ばない）
node tests/opening-bridge-runner.mjs
# 別端末から実nativeで開幕から終了まで検査
& C:/Users/tofu/.local/bin/python.exe tests/native-opening-smoke.py --bridge-config runtime/astra-bridge.json --timeout 35
```

`tests/native-opening-smoke.md`に初手変更手順。2枚組のrawtrace・HTTP証拠は無視対象の`runtime/`、集計・カード入力手順・ソースハッシュはGit管理する。新規checkoutはrawtraceを復元済みと見なさず再生成する。
