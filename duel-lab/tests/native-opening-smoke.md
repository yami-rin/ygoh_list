# Native opening smoke

実 `ygoserver.dll` / `ocgcore.dll`、MDPro3 の `GameClient` / `GameBehavior` / `GameAI`、追跡対象の `native/AstraDecisionBridge.cs` を使い、カード処理から HTTP 判断要求まで接続する Windows 用テスト。

```powershell
# native C# のコンパイルのみ
& C:/Users/tofu/.local/bin/python.exe tests/native-opening-smoke.py --build-only

# 固定した初手 5 枚で、実際の最初の Main 要求を確認（HTTP も一時ポート）
& C:/Users/tofu/.local/bin/python.exe tests/native-opening-smoke.py --workdir runtime/native-opening-test/isolated-main

# 実 policy + native の 3 fixture を、対戦用 bridge と独立して連続実行
& C:/Users/tofu/.local/bin/python.exe tests/native-opening-suite.py

# 複数枚初動・同名2枚・アトラクターの初期windowを含む12 fixture
& C:/Users/tofu/.local/bin/python.exe tests/native-opening-suite.py --fixtures tests/fixtures/multi-openings-native.json --timeout 60

# 1 fixture だけ再実行
& C:/Users/tofu/.local/bin/python.exe tests/native-opening-suite.py --fixture cat-mag

# 追加 fixture の JSON schema を表示
& C:/Users/tofu/.local/bin/python.exe tests/native-opening-suite.py --list
```

既定の初手は Rabbit、霊王の波動 2 枚、神の密告、GWC。`--hand` にカンマ区切りのカード番号を 5 個渡して変更できる。デッキの内容は `preset.json` と一致させ、テスト専用 room の noShuffle で初手を固定する。

smoke の既定モードはローカル HTTP fixture が先攻選択・任意チェーンの辞退・最初の End Phase だけを応答する。Astra CLI は起動せず、初動の展開能力は検証しない。`--bridge-config PATH` では応答をすべて明示した bridge に任せ、最初の手札と先攻終了を確認する。対戦中のユーザー用 bridge をテストの接続先に指定せず、通常は suite の隔離 runner を使う。

suite は root 所有の `tests/opening-bridge-runner.mjs` を使う。実 `startNativeBridge` / `NativeOpeningPolicy` が各判断を返し、予定ルート完了後の End Phase と任意チェーン辞退をテスト応答が担当する。Cat＋マグナムートのfixtureでは、追加でエンドフェイズの登録済みサーチを解決し、バルドレイク1枚が増えたことを確認する。この追加処理はテスト用であり、保存初動やAstra自身の判断実績には含めない。途中の model fallback は失敗になる。最終 Main では runner が実盤面を core 検証済み plan と比較し、suite がさらに最終 LP・モンスター・魔法罠・手札、連続した HTTP request ID、相手非公開 ID、フレーム完了を照合する。Astra CLI の呼び出しはない。

| fixture | 固定初手の展開札 | 期待終着 | LP |
| --- | --- | --- | ---: |
| rabbit | Rabbit | Accord + WHITE BINDER | 6200 |
| backup-ash | Backup + うらら（捨てる手札） | Accord + トランスコード | 8000 |
| cat-mag | Cheshire Cat + サイバース・コード・マジシャン | CRYPTER + WHITE BINDER + I:P + GWC | 6200 |

追加時は `--list` と同じ配列（または `{"fixtures": [...]}`）を JSON に保存し、`--fixtures PATH` で渡す。`id`・5 枚の `hand`・`routeId`・`lp`・`monsters`・`spells` を必須、`finalHand` を任意の期待値とする。`--fixture ID` は繰り返し指定できる。ルート採用方針が変わって別の終着を選んだ場合も差を検出するため、期待値は新しい実測に基づいて更新する。

smoke の生成物は `runtime/native-opening-test/` が既定。`--workdir` は専用の `runtime/native-opening-*` 配下を指定でき、同じ保存先の build/run はロックで重複を防ぐ。suite は毎回新規の `runtime/native-opening-suite/<UTC日時>-<ID>/<fixture>/` に保存する。既存の証拠を上書きしない。

`build-manifest.json` はコンパイル定義・ソース・native DLL・カード DB・Lua archive のハッシュ、`client.log` は自分の手札・盤面・LP、`result.json` は native 結果。suite の `policy-trace.jsonl` は実 HTTP payload/response、`evidence.json` は fixture の照合結果と証拠ファイルのハッシュ、run 直下の `summary.json` は全体結果を記録する。実行中に関連ソースが更新された場合は `changedSources` を記録し、再測定まで PASS にしない。相手用 TCP client は機械的な任意チェーン辞退だけを行い、非公開情報を bridge に転送しない。

コンパイラは既存 Unity Mono の mcs、実行環境は Windows .NET Framework 4.8。Unity の error toast のみ console sink に置き換える。Unity 同梱 Newtonsoft は desktop CLR で読めないため、署名済み NuGet 13.0.3 の net45 DLL をテスト領域へ取得する。production の DLL・ソース・ユーザーの client/server は変更・停止しない。

TCP duel port と HTTP bridge port は一時ポート。smoke の `--bridge-port PORT` で固定指定もできる。headless C# だけを `ASTRA_NATIVE_TEST_ENDPOINT` 定義付きでコンパイルし、専用 process の `ASTRA_BRIDGE_TEST_PORT` と一致する loopback URL を許可する。production build の `127.0.0.1:8788/choose` 制限は維持される。suite は専用 runner に stdin `stop` を送り、自分が起動した process と fixture の認証設定だけを片付ける。
