# 複数枚初動の実MDPro3検証

2026-09-08。同じソース版を固定し、隔離した4組の検証環境で3例ずつ並列実行した。**12/12例がPASS**。JavaScriptの自動テストは178件PASS。

製品のHTTP bridge・初動policy・実WindBot・nativeカードスクリプト・ルールエンジンを使用。各初動の最終Mainで、手札・全ゾーン・配置位置・LP・デッキ枚数をWASMの予定盤面と厳密比較した。相手の非公開カードIDが渡らないことと、入力IDの連続性も確認した。

| 初手の展開札 | 保存手順の入力数 | 実HTTP要求数 | 結果 |
| --- | ---: | ---: | --- |
| Rabbit | 62 | 61 | PASS |
| バックアップ＋うらら | 40 | 39 | PASS |
| Cat＋コード・マジシャン | 73 | 75 | PASS |
| コード・マジシャン＋Dormouse | 73 | 76 | PASS |
| コード・マジシャン＋うさぎ | 37 | 35 | PASS |
| UNDERGROUND＋コード・オブ・ソウル | 83 | 84 | PASS |
| Cat＋マグナムート | 59 | 62 | PASS |
| Hare＋TB | 68 | 68 | PASS |
| Dormouse＋TB | 102 | 95 | PASS |
| Rabbit＋アトラクター | 66 | 66 | PASS |
| Cat＋Cat | 16 | 17 | PASS |
| UNDERGROUND＋UNDERGROUND | 64 | 65 | PASS |

保存手順の入力数にはnativeが自動処理する単一選択も含む。HTTP数には先攻選択と終了確認も含むため、両者は一致しない。残りの手札はfixtureで固定した補助札であり、同じ展開札を含むすべての5枚手札の成功を保証するものではない。

アコードのWHITE BINDER・トランスコード蘇生は、native側の順番が逆でも各カードの予定位置を維持した。Cat＋マグナムートでは初動の59入力が完了した時の手札3枚を確認した後、エンドフェイズの登録済みサーチをテスト応答で解決し、バルドレイクだけが加わった手札4枚も確認した。

Astra CLIの呼び出しは0回。展開途中は製品の保存初動が応答し、初動後のEnd Phase・任意チェーン辞退・指定したマグナムートの処理は検証用応答が担当した。モデル自身の対戦判断や勝率の検証とは区別する。

Unityクライアントは前回検証済みのビルドを継続利用。今回は探索器・保存ルート・文書を更新し、ユーザー用クライアントとbridgeは再起動していない。更新候補集は次回bridge起動時に読み込まれる。GUI上でこの12試合を手動操作した検証ではなく、同じ入力処理を使ったnative対戦試験である。

ソースSHAと各例の終端・証拠グループは[NATIVE_MULTI_VERIFICATION.json](NATIVE_MULTI_VERIFICATION.json)。raw traceはruntime内のため新規checkoutには含まれず、[native-opening-smoke.md](../tests/native-opening-smoke.md)の12例のコマンドで再生成する。全333組の探索範囲と残枝は[MULTI_SEARCH_COVERAGE.md](MULTI_SEARCH_COVERAGE.md)を参照。

共通ソース識別子: `f57482c88a17cfc69960a593cad098a9ca2fa28853ee9c90843e0be6db6d2bfb`
