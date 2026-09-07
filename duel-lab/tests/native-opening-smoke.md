# Native opening smoke

実 `ygoserver.dll` / `ocgcore.dll`、MDPro3 の `GameClient` / `GameBehavior` / `GameAI`、追跡対象の `native/AstraDecisionBridge.cs` を使い、カード処理から HTTP 判断要求まで接続する Windows 用テスト。

```powershell
# native C# のコンパイルのみ
& C:/Users/tofu/.local/bin/python.exe tests/native-opening-smoke.py --build-only

# 固定した初手 5 枚で、実際の最初の Main 要求を確認
& C:/Users/tofu/.local/bin/python.exe tests/native-opening-smoke.py

# 起動済みの実 bridge を使い、先攻ターンの終了まで実行
& C:/Users/tofu/.local/bin/python.exe tests/native-opening-smoke.py --bridge-config runtime/astra-bridge.json --timeout 180
```

既定の初手は Rabbit、霊王の波動 2 枚、神の密告、GWC。`--hand` にカンマ区切りのカード番号を 5 個渡して変更できる。デッキの内容は `preset.json` と一致させ、テスト専用 room の noShuffle で初手を固定する。

既定モードはローカル HTTP fixture が先攻選択・任意チェーンの辞退・最初の End Phase だけを応答する。Astra CLI は起動せず、初動の展開能力は検証しない。外部 bridge モードでは応答をすべて指定 bridge に任せ、最初の手札と先攻終了を確認する。最終盤面の期待値は呼び出し側で `result.json` の `terminal` と照合する。

生成物は `runtime/native-opening-test/`。`build-manifest.json` にソースと native DLL のハッシュ、`client.log` に自分の手札・盤面・LP、`result.json` に結果を記録する。既定モードの `requests.json` は実 bridge payload で、相手の手札・EX のカード番号が非公開であることを検査する。相手用 TCP client は機械的な任意チェーン辞退だけを行い、非公開情報を bridge に転送しない。

コンパイラは既存 Unity Mono の mcs、実行環境は Windows .NET Framework 4.8。Unity の error toast のみ console sink に置き換える。Unity 同梱 Newtonsoft は desktop CLR で読めないため、署名済み NuGet 13.0.3 の net45 DLL をテスト領域へ取得する。production の DLL・ソース・ユーザーの client/server は変更・停止しない。

TCP duel port は一時ポート。既定 HTTP fixture は production bridge と同じ `127.0.0.1:8788` を排他的に使うため、使用中なら起動に失敗する。既存 bridge を検証するときは `--bridge-config` を明示する。同じテスト領域を共有するため、この harness の build/run は同時に複数起動しない。
