# Rabbit単独の分岐探索

2026-09-08。対象は `preset.json` の固定40＋15枚、開始手札White Rabbit 1枚、先攻・相手手札/盤面なし。手札に置くRabbitを先にメインデッキから抜き、追加手札や確定ドローを与えない。

## 現時点の結果

**探索は未完了。** 全合法木や最善展開の証明ではない。実エンジンで既存Rabbit 11ルートを再生し、追加8ルートの生成と別インスタンスでの再生が成功した。履歴が完全に等しいprefixだけを監査表で共用し、盤面・位置・同名個体や効果使用履歴が異なる枝をまとめていない。

最終同期時の集計は **37169訪問・8259終了経路・736未探索frontier**。固定10入口のうち5部分木が閉じた。追加のcanonical v2 rootも含めた11入口を保存し、失敗・拒否は0。未探索736件はドロー待ち91、時間境界516、ノード境界129で、旧深さ境界は実coreで再判定済み。訪問や終了経路は独立した戦略パターンの数ではない。

| 集計系列 | 訪問 | 終了経路 |
| --- | ---: | ---: |
| 移行前v1の基準値 | 11041 | 2206 |
| 既存10入口へのv2追加 | 23758 | 5443 |
| v1履歴を継承しないcanonical v2 root | 2370 | 610 |

`--verify-saved` により、代表8ルート、全91ドロー直前prefixと残り山札、全11checkpointのpreset・根prefix・計数・frontier一致を実エンジン/ファイルで照合した。チェックはPASS、構文確認もPASS。全入力はruntime、追跡するJSONは要約と代表ルートを保持する。

| 初回の罠 | 調べた種類 | 残る範囲 |
| --- | --- | --- |
| TB－11 | Rabbit / Cat / Dormouse / Hare | 各同名個体・全配置・以後の全素材選択 |
| MTP－07 | Rabbit / Cat / Dormouse / Hare | 同上 |
| GWC－06 | 初回セット直後は発動不可 | Rabbitを別カードへ変換した後を含む全手順木 |

初回のGWCは発動前の墓地/除外に蘇生対象がなく、コストで除外予定のRabbitを先に対象として扱えない。TBから出したDormouseは、その個体の効果発動が禁止されるが、Decoder/S:Pで一度墓地→除外→帰還するとデッキ除外効果を使える。

## 新しく実証した8終点

共通部は既存 `rabbit-no-draw-ip` のI:P召喚直前まで。Rabbit→TB/Dormouse→Decoder/S:P→Dormouse帰還→Cat→Binder→MTP/Hareから、Binder＋Cat＋Hareを得る。ドローは辞退する。

| ID末尾 | 終点 | LP | 制約 |
| --- | --- | ---: | --- |
| `wicked` | Binder＋ウィキッド | 6200 | ウィキッドのサーチをこの後必ず使えるという意味ではない |
| `contract` | Binder＋コントラクト | 6200 | 儀式サーチの魔法コストはこの盤面にない |
| `firewall` | ファイアウォール＋Hare | 6200 | 相互リンクしておらず、回収を妨害として数えない |
| `access` | アクセスコード＋Hare | 6200 | Binderを参照した攻撃力上昇を処理済み |
| `transcode` | トランスコード | 6200 | S:Pを出したターンなので蘇生効果は発動不可 |
| `wp` | W:P | 6200 | 相手ターンの応答自体はこのリプレイに含めない |
| `perfectron` | パーフェクトロン | 6200 | Cat/HareをウィキッドにしてからBinder＋ウィキッドで出す。相手空盤面でダメージは発生しない |
| `crypter-self-return` | 自身を除外して帰還したCrypter | 5300 | Dormouseの600上昇が残り攻撃力5600。Crypter①・②を使用済み。①を残した妨害盤面と同一扱いしない |

いずれも「より強い」とは判定していない。先攻の用途・後続・未使用効果を考慮して、実対戦の行動候補から選ぶ必要がある。

## 探索と再開

```powershell
node scripts/exhaustive-rabbit.mjs
node scripts/exhaustive-rabbit.mjs --search --nodes 100 --depth 35 --ms 30000
node scripts/exhaustive-rabbit.mjs --search --search-only --sharded --resume --nodes 1000 --depth 160 --ms 20000
node scripts/exhaustive-rabbit.mjs --search --search-only --sharded --resume --prioritize-depth --nodes 1000 --depth 180 --ms 30000
node scripts/exhaustive-rabbit.mjs --search --search-only --sharded --resume --canonical-root --shard 10 --nodes 1000 --depth 180 --ms 30000
node scripts/exhaustive-rabbit.mjs --report-only --sharded
node scripts/exhaustive-rabbit.mjs --verify-saved
```

前者は既存11本＋追加8本を実エンジン検証し、194個の履歴prefixと各要求の全候補を `runtime/search-rabbit/audited-branches.json` に保存する。`routes/exhaustive-rabbit.json` は監査のhash・深さ・候補数と代表8ルートを保持する。候補一覧にあることと、その候補以下の全枝を検証済みであることは区別する。

後者は汎用 `search-kernel.mjs` で初手から有限予算の応答木を探索する。初回smokeは100ノード、深さ35、2.2秒で15個のターン終了経路と80個の未探索frontier。拒否0・エンジン失敗0で、`complete:false`。同じ盤面に見える選択解除ループも深さ上限に残るため、これを戦略的に独立した100展開とは数えない。

追加の大予算探索はrootと初回罠/対象の10入口へ公平に分け、各20秒の区間で再開した。深さ160、効果ドロー後は停止、状態の同一視はなし。累計 **11041訪問・2206ターン終了経路・4179未探索frontier**。エンジン拒否0・エンジン失敗0。frontier内訳は深さ上限2636・時間上限1543。いずれも未完了。

その後v2探索器へ移行し、監査済みの標準L召喚における素材選択・解除・取消の無操作循環だけを縮約した。位置、コスト、チェーン、効果使用などが変わる操作は統合しない。深さ180・最大30秒の区間で再開し、v2第2巡までに累計 **23103訪問・5041終了経路・2626frontier**、無操作循環3184件を縮約。移行前から12062訪問を追加し、終了経路は2835件増えた。拒否0・処理失敗0。この値は第2巡時の記録で、最新集計はJSONの `search` を参照する。

GWCセット後、MTPでRabbit・Cat・Dormouseを手札に加えた後の4入口は、固定prefixから先の残りfrontierが0になった。それぞれの表示上の終点はRabbit据え置き、Ringの左右EX、Decoderの左右EXの5種類。MTP検索札は手札に残りLP7700、GWC入口はセットを残してLP8000。この表示盤面集計を探索の状態統合には使わず、効果履歴が同じとも主張しない。配置や初回選択まで固定した4部分木の完了であり、Rabbit全体の完了ではない。

継続探索でTBから2枚目Rabbitを出した固定prefixも閉じた。この5番目の部分木は746終了履歴、73表示盤面。ほかの4入口は各5表示盤面。表示盤面の集計と代表履歴hashは `search.closedSubtrees` に保存し、探索の統合判定には使わない。

rootと指向的な途中prefixの探索には重複訪問があり、素材の選択取消ループも数えている。この11041を独立した展開数や一意な局面数とは数えない。各入口の作業量と未探索境界は `routes/exhaustive-rabbit.json` の `search.summaries` に保存した。

再開用は `runtime/search-rabbit/*.checkpoint.json`、個別集計は同名の `*.summary.json`。`--search-only` は既に検証した指向ルートの再検証を省き、`--resume` は各入口のcheckpointを読む。`--shard 0`〜`9` で入口を選べる。ノード・時間・深さの境界、frontier、失敗を保持する。初回罠の同じ種類を選ぶ場合でも、未調査の配置・個体・タイミングは未探索に残る。初回100ノードsmokeは旧ファイル `search-result.json` / `checkpoint.json` に別保存している。

`--canonical-root` はv1の入力履歴を継承しない比較用のv2初手探索を入口10として作る。既存10入口を残し、計数は `search.accounting` で旧v1・既存入口へのv2追加・新規v2 rootに分ける。表示盤面や応答履歴が重なるので、これらの合計を独立パターン数にはしない。

再開する最新checkpointは更新前に `runtime/search-rabbit/history/<入口>/` へ保存する。`--prioritize-depth` は旧深さ上限のframeを訪問順の先頭へ移すだけで、1件も削除せずkernelに再判定させる。完了済み入口と、全残件がドロー引継ぎ待ちだけになった入口は、同じ条件で再訪問して計数を増やさない。後者は未完了のまま保持する。

## ドローの引継ぎ

Binderの任意1ドロー直前のprefixを、最終同期時点で91件保存した。各件に実エンジンから取得した残り山札の全カードコードとYES入力を添付する。全件の引継ぎデータは `runtime/search-rabbit/draw-frontiers.json`。追跡するJSONでは `drawFrontierSummary` に全件のhashと残り枚数、`drawFrontiers` に入口別の代表prefixを保存する。現在の固定順序から引いた1枚を全ドロー結果として扱わない。

同名カード・位置・効果使用済みの違いを同一視せず、ランダムなドロー結果、全後続手順、相手の妨害・相手ターン、最適性は未完了のまま残す。
