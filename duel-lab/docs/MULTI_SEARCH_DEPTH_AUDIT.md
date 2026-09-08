# 深い2枚初動frontierの入力循環監査

2026-09-08。旧 `runtime/multi-pair-search` の凍結checkpointだけを読み、8組・各2prefixを実coreで再生した。探索器、既存checkpoint、routes、productionは変更していない。調査用probeと証拠は `runtime/multi-search-depth-audit/` に置いた。

## 結論

**標準Linkの監査では除去されない、バルドレイクの通常召喚取消し循環がある。** バルドレイクを含む3組の深い6prefixは、通常召喚を選ぶ → `SELECT_TRIBUTE` で取り消す、という2入力を71〜86回繰り返していた。6prefixとも既存reference kernelに最後まで到達し、Link縮約件数は増えなかった。

この6prefixの149〜180入力のうち、実際の通常召喚取消し往復を数から引くと7〜14入力になる。**このサンプルについては、240入力への深さ増加を必要とする長い効果展開が原因ではない。** 他の未探索枝の必要深さや、333組全体の最大有効深さまで証明したものではない。

縮約候補は「固定ルール・固定presetで、初期手札から一度も外へ出ていない唯一のバルドレイクの、特定の通常召喚取消し取引」に限定できる。後述の追加追試により、マグナムートにも同じ制限を適用できることを確認した。任意の盤面hash一致や、あらゆる手札の召喚取消しへ一般化しない。本担当は候補の証拠を提示し、探索器への実装は行っていない。

## サンプルと再生結果

8つの旧summaryから、各shardで `maxDepth` 残件の多い組を優先し、同数なら訪問数の多い未完組を1組選んだ。各組のcheckpoint内で長い順に異なる2prefixを選んだ。全333checkpointの深さを横断して順位付けしたサンプルではない。出典ファイルのSHA256を各 `pair-<index>-<sample>.json` と `summary.json` に保存し、再生後も全16件で出典不変を確認した。

| pair | 初手 | 最深2prefixの入力数 | 通常召喚取消し往復数 | 取消し往復以外の入力数 |
| --- | --- | --- | --- | --- |
| 288 | バルドレイク＋黄金櫃 | 149 / 149 | 71 / 71 | 7 / 7 |
| 265 | UNDERGROUND＋バルドレイク | 180 / 180 | 86 / 85 | 8 / 10 |
| 286 | バルドレイク＋テラ・フォーミング | 180 / 180 | 84 / 83 | 12 / 14 |
| 242 | TB－11＋コード・オブ・ソウル | 8 / 7 | 0 / 0 | 8 / 7 |
| 115 | ドットスケーパー＋Cheshire Cat | 18 / 17 | 0 / 0 | 18 / 17 |
| 308 | コード・オブ・ソウル＋MTP－07 | 8 / 7 | 0 / 0 | 8 / 7 |
| 229 | 霊王の波動＋コード・オブ・ソウル | 8 / 8 | 0 / 0 | 8 / 8 |
| 311 | 黄金櫃＋プルリア | 22 / 21 | 0 / 0 | 22 / 21 |

16prefixすべて実coreの応答エラーなし。reference kernelで13件は同じprefixのobserverへ到達し、pair115の18入力はターン終了済みの合法終端、pair308の7入力とpair311の22入力は既存Link縮約により処理された。したがって、checkpointに残っているというだけで全件を新たな未対応循環とは分類していない。

## 最小の実例

`pair-265-0.json` のdepth 7時点は、手札にバルドレイク、モンスターゾーン0に除外から戻ったDormouse、フィールドゾーンにUNDERGROUND。LPは7700で、Dormouseの除外時効果はすでに解決している。

1. depth 8: `SELECT_IDLECMD` の `action:0`、「召喚：深淵の獣バルドレイク」を選択。raw出力は `HINT(player=0,hint_type=3,hint=500)` と `SELECT_TRIBUTE(player=0,can_cancel=true,min=1,max=1)`。候補は自分のDormouse1体、`release_param=1`。
2. depth 9: `SELECT_TRIBUTE` へ `{cancel:true}`。raw出力は元と同一の `SELECT_IDLECMD` 1件だけ。

この2入力ではMOVE、CHAIN、LP、召喚、リリースのイベントは発生しない。pending、全query、LP、phase、chain、logは入口と同じ。ただし、この一致は診断の手掛かりであり、それだけをhidden stateやHOPTの同値性の根拠にしていない。

`prompts.mjs:79` は取消しを `SELECT_TRIBUTE` の `indicies:null` に変換する。実coreの `playerop.cpp:237-245` は取消し応答を `return_cards.canceled=true` として解析し、`SelectTributeP` の取消し分岐は材料リストの通常確定処理を行わず戻る (`core-playerop.cpp:683-688`)。

## 実使用WASMとC++の対応

重要な区別として、実際に `engine.mjs` が使う `data/ocgcore.sync.wasm` は、node_modules内の同梱WASMと異なる。実体は `data/sources.json` が示す **JSR @n1xx1/ocgcore-wasm 0.1.4** で、SHA256は `68e0ddde6932df1dc9de39e6eff8afae10a5db0f18ea8a0870a6b7eb80073ea8`。

次の公開された一次資料を取得し、相互の対応を確認した。

- [JSR 0.1.4 manifest](https://jsr.io/@n1xx1/ocgcore-wasm/0.1.4_meta.json) のWASM checksumが実体SHA256と一致。
- [JSR version metadata](https://api.jsr.io/scopes/n1xx1/packages/ocgcore-wasm/versions/0.1.4) のRekor log indexは2625992175。[Rekor entry](https://rekor.sigstore.dev/api/v1/log/entries?logIndex=2625992175) の公開provenanceはwrapper commit `d6f47c644e2f73c20c5379a2018b3b1771eef2c7` を指定。
- そのcommitの [cpp/ygo gitlink](https://github.com/n1xx1/ocgcore-wasm/tree/d6f47c644e2f73c20c5379a2018b3b1771eef2c7/cpp/ygo) は core commit `46779fbe40e6a9bd8967f5dc6a03f4eaa6550d57` を指す。
- 同commitの [build workflow](https://github.com/n1xx1/ocgcore-wasm/blob/d6f47c644e2f73c20c5379a2018b3b1771eef2c7/.github/workflows/build.yaml) はsubmoduleをcheckoutし、WASM build cache keyにも実際のcore revisionを含む。[build script](https://github.com/n1xx1/ocgcore-wasm/blob/d6f47c644e2f73c20c5379a2018b3b1771eef2c7/scripts/build.sh) は同submoduleのC++をコンパイルする。

公開registry/checksum/provenanceと固定sourceの対応を確認したもので、独立した再ビルドによるバイナリ一致や、Rekor署名の暗号学的な再検証は今回の範囲に含めていない。旧MDPro3同梱C++を実WASMのソースと取り違えて根拠にしていない。

取得したC++は `core-operations.cpp`、`core-playerop.cpp`、`core-processor.cpp`、`core-card.cpp`、provenance関連は同じ証拠directoryに保存した。SHA256一覧は `evidence-manifest.json`。

## コスト・召喚権・HOPTと、取消し前の注意点

[固定coreのSummonRule](https://github.com/edo9300/ygopro-core/blob/46779fbe40e6a9bd8967f5dc6a03f4eaa6550d57/operations.cpp#L1775) は通常召喚の素材選択を行い、case 5 の `return_cards.canceled` で `summon_depth` を減らして即returnする (`core-operations.cpp:2012-2014`)。

以下はその後の処理にあるため、当該取消しでは実行されない。

- `EFFECT_SUMMON_COST` のoperation実行: 2020行以降。
- 確定したリリース、召喚素材情報の設定: 2091-2095行付近。
- 独自召喚手順のoperationと `dec_count`: 2102-2132行。ただし今回の通常召喚は独自手順を使用しない。
- 通常召喚回数の加算: case 8、2144行。
- 召喚カードを場へ移す操作: case 9以降。

一方、**取消し前のcase 0に `target->material_cards.clear()` が存在する** (`core-operations.cpp:1832`)。過去に召喚され手札へ戻ったカードには、queryに現れない材料履歴が残る可能性がある。このため「通常召喚取消しはどんなカードでも内部状態を一切変えない」とは主張できない。

採用候補では、元から手札にある唯一のバルドレイクが、その個体の初期化以降一度もHand外へ出ていないことを必要条件とする。この個体の材料履歴は最初から空なので、当該clearは空を保つ。

通常召喚の合法性検査は、独自召喚proc・追加召喚効果・召喚cost条件等のLuaを呼び得る (`core-card.cpp:2546-2602,3065-3077,3182`)。現presetの41card Luaに対し、通常召喚proc/cost/extra-count、tribute修飾、通常召喚・リリース制限、効果コピー、材料情報、GetOperatedGroup等の明示的な登録・参照をスキャンし、該当0件だった (`preset-normal-summon-scan.json`)。対象バルドレイク自身の初期化も特殊召喚・除外効果とそのイベント監視であり、独自の通常召喚手順・通常召喚costを登録しない。固定presetと読み込まれる全依存Luaの内容固定が前提になる。

coreの選択用scratch containerまで全バイト不変とは扱わない。固定card群の効果処理と回数制限を消費しない特定の取消し取引として評価する。

## 実coreでの継続比較

`confirm-continuations.mjs` は同じpair265のdepth 7から、取消し0回・1回・86回の3条件を作り、それぞれ次の実操作を行った。

- バルドレイクの通常召喚をやり直し、Dormouse1体を実際にリリースして通常召喚を成立させる。
- Dormouseの除外する効果を実際に発動し、デッキのWhite Rabbitを除外する。Rabbitの任意効果を辞退し、Dormouseの使用済み効果が次のIdle候補に再出現しないことを確認する。

**6条件すべて成功**。同じ継続どうしの盤面・pending・log・rawイベントが、取消し0/1/86回で完全一致した。通常召喚継続は10/12/182入力、Dormouse継続も10/12/182入力。HOPTを単なる公開盤面一致から推定せず、効果発動と再使用不可まで実行した。証拠は `continuations.json`。

## マグナムートだけの追加追試

追加依頼を受け、pair215の初手 `[33854624,75500286]` で黄金櫃からドットスケーパーを除外・蘇生し、マグナムートの通常召喚取消し0回・1回・116回の後にドットスケーパーを実際にリリースして通常召喚した。`confirm-magnamhut.mjs` は3条件とも成功し、入力数は9/11/241。終了時のboard・pending・log・rawイベントはすべて同じhash `cb7fbe29aa6fe4248ea3dcb8925ceca40ecbdc70297b3de0a98a0fb436699d2a` だった。

各往復で初期uniqueマグナムートがHand外へ出ていないこと、`HINT_SELECTMSG(500) → SELECT_TRIBUTE(can_cancel=true,min=max=1) → 同一IDLE` だけが発生すること、全query等の一致を検査した。通常召喚成立時には、特殊召喚時だけのマグナムートのサーチ効果が発動していないことも検査した。

`c33854624.lua:5-35` の初期化は手札からの特殊召喚と、その特殊召喚成功時のサーチ登録であり、独自の通常召喚proc/cost/extraCountを追加しない。すでに監査した固定41Luaと同じ範囲に含まれる。初期未離脱個体のmaterial履歴は空なので、既存のSummonRule取消し位置の証明を同じ条件で適用できる。追加対象は **33854624だけ**。シフターや他のレベル6カードを同じレベルという理由で許可しない。

証拠は `magnamhut-continuations.json`。これは既存のfastwave成果物を編集したり、pair215の全枝を再探索した結果ではなく、同じ初手に対する取消し取引の独立した限定追試である。

## 最小の縮約候補と対象外

次版の局所取引監査として、次の条件をすべて要求することが候補になる。

1. 固定preset・core・wrapper・engine・prompt adapter・全依存Luaが監査版と一致する。
2. 初期手札の唯一の `72656408` または追加追試した `33854624`。MOVE履歴を初期化から監視し、その個体が自分Hand外へ出た、戻った、または識別不能なMOVE/SWAPがあった場合は例外を無効にする。
3. 自分の先攻Main1、空chain、Idleの通常召喚action 0から開始。対象は自分Handのその個体。
4. 最初の応答のraw出力が `HINT_SELECTMSG(500)` と `SELECT_TRIBUTE` だけ。自分controller、`can_cancel=true`、`min=max=1`。候補は自分の表側MonsterZoneのカードだけで、`release_param=1`。表側性はpendingに属性がない場合、全queryで照合する。
5. 次入力が明示的な `{cancel:true}`。そのraw出力は元と同一のIdleだけ。途中に選択、cost、move、chain、LP、追加question、その他のイベントを挟まない。
6. 入口と出口のpending、全query、LP、phase、chain、logが一致する。この照合は上記のC++/Lua・初期個体の条件を置き換えない。
7. 入口が保存rootのdepthより前なら縮約しない。初期状態からの生履歴は確認に使うが、固定rootの外側にある代替経路を消さない。

Shifter等の追試していない高レベルカード、手札へ帰還した個体、召喚セットaction 3、特殊召喚手順、追加召喚、相手カードのリリース、二重リリース、SELECT_CARD/UNSELECT/YESNO/OPTION経由の別手順、取消し前にコストが発生した履歴は今回の証明対象外。必要なら別のカード・別の処理として追加監査する。

変更箇所の候補は、参照kernelのLink取引と同じreplay/advance箇所に独立した取消し取引を置き、2入力の監査条件を満たした時だけ閉じる処理。新しいpolicy/versionとguardを持ち、旧checkpointを同じ意味のまま黙って扱わない。保存済みの長いrouteを短くする場合も、入力を機械削除して既存before/finalHashを残さず、新しい短い履歴を実coreで最初から再生して採点・hash・終端を作り直す必要がある。

## 再現コマンドと範囲

```text
node runtime/multi-search-depth-audit/probe.mjs
node runtime/multi-search-depth-audit/confirm-continuations.mjs
node runtime/multi-search-depth-audit/confirm-magnamhut.mjs
```

実行結果は `DEPTH_AUDIT_COMPLETE 16`、`CONTINUATIONS_PASS 6`、追加の `MAGNAMHUT_CONTINUATIONS_PASS 3`。対象の元checkpoint16読取はすべてSHA不変。深さ監査から一般のHOPT同値や全枝完了は導かない。候補の実装、別versionでの探索再開、productionへ出すrouteの再作成・native確認は統合担当へ引き渡す。
