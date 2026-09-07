# Cat / Binder ドロー後の公平な後続探索

更新: 2026-09-07T22:36:46.903Z。固定デッキの39ドロー境界、1053結果を対象とする。

初回到達 1053/1053、最初の4node到達 1053/1053、探索完了 0/1053、訪問 5099、終端入力列 0、未探索frontier 24656。
後続ドロー境界 0、初期化エラー 0、探索エラー 0。全網羅: false。

各ドロー結果へ最初に4〜8nodeずつ配分し、処理回数が少ない結果から再開する。1プロセス、1実行の時計予算は最大30秒。実コアの1回の処理は途中打切りできないため、終了時刻は最後のfixtureと証拠保存の分だけ超過し得る。

`materializeDrawOutcome` で最初の手札から実効果を再生し、draw acceptanceまでの全prefixと初期deckOrderを保存する。途中盤面の再配置は行わないため、同名HOPT・通常召喚権・消費した罠・残デッキ枚数は実履歴から復元する。各結果の初期state hashと残デッキ枚数はドロー担当の証拠へ照合する。

既存ドローより後で新しくドローした入力列は `newChanceFrontier` として残す。その1回の固定結果を後続ドロー全体の網羅と扱わない。任意ドローの確認時は否認枝も残し、承諾後に実際のドローが発生した枝だけを停止する。残デッキや入力前の任意ドロー確認はruntimeのchance証拠へ記録し、新しい確率は仮定しない。

全入力列、初期root、未探索prefix、後続chance証拠は `runtime/search-optional-draw/`。追跡JSONは件数、各ファイルのSHA-256、条件付きドロー重み、少数の代表ルートを保存する。rootRepresentativesはドロー直後までの履歴で、完成盤面ではない。終端の代表はrepresentativesへ別途収録する。代表ルートの選択は表示用であり、元の探索枝を削除しない。

## 再開

```powershell
node scripts/search-optional-draw-continuations.mjs --max-ms=30000 --nodes=4
```

同じコマンドで未処理結果とcheckpointを継続する。`--nodes` は4〜8、`--extra-depth` はroot以後の初回深さ上限（既定24）。その後のsliceで8ずつ深くする。checkpointがchanceやエラー境界だけになった結果は自動再試行せず、未完として保持する。

検証: `node scripts/search-optional-draw-continuations.mjs --self-test`。独立replayでrootの状態・残デッキを比較し、kernelの4+4node再開が8node連続実行と同じ終端・frontierを持つことを確認する。

同じruntimeを使う実行器の二重起動はrun.lockで拒否する。2026-09-08の実process検証でも既存PIDへの二重起動が拒否され、元の探索が継続した。

この作業はAstra CLIや実対戦用のAstraプロセスを起動しない。全初動・全ドロー後展開の完了はまだ主張しない。
