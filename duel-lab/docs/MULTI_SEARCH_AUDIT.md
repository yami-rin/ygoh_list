# 全333組の2枚初動探索・独立監査

2026-09-08。対象は固定40枚の合法な2枚組から行う実コア探索、ドロー後の除外、盤面評価、native自動入力への受け渡し。監査担当は本書のみを変更する。探索器・adapter・GUI・稼働中bridgeは変更も停止もしていない。

## 現時点の結論

既存kernelは未探索の枝をfrontierへ保持し、盤面を大域的に同一視せず、固定scriptで監査した標準Link素材選択の操作循環のみを縮約している。ただし**333組の全件着手、各組の全探索完了、良い盤面の発見、nativeへの適用確認は別の完了条件**である。今回の監査テスト成功は、333組の探索が完了した証拠ではない。

`stopOnDraw`単独は「ドロー直前でcoreを止める」機能ではなく、ドローが解決した後の次promptで探索を止める機能である。新runnerのreadbackでは採点前の追加DRAW判定が入り、ドロー後の混入を防ぐ条件が実装された。監査で発見したnativeの同名部分選択・合計条件の取り違え、および集約器の誤完了条件は修正され、下記の反例追試で拒否を確認した。山札内の同名copyに限る例外は、初期状態からの履歴と山札復帰なしを必要とする。

## 範囲とexactnessの定義

- `enumeratePairs` は異なるカード名の組を順不同で取り、同名2枚は採用枚数が2枚以上の場合だけ含める (`scripts/survey-multi-openings.mjs:20-28`)。現presetは333組、同名8組、物理的な2枚の重み合計780=`C(40,2)`。この重みは初手5枚の確率ではない。
- 探索は各組の指定した初期手札順、残り山札順、ルール版、先攻1ターン、初期相手手札なしのfixtureに条件付く。未知の残り山札の全順列や相手妨害、初手5枚の全組合せを探索したとは言わない。
- 生の入力履歴をすべて数えると、素材の選択→解除や召喚取消→再選択を何度でも繰り返せる。有限の完了は、監査済みのゲーム処理を伴わない局所Link操作循環を同じものとして扱った範囲でのみ定義する。通常召喚権、効果使用、LP、移動、chain等が変わる反復をこの縮約へ含めない。
- `inventoryComplete` は333組すべてが正しいhand/sourceで保存されていること。`visitedAllPairs` は各組で少なくともrootを実行したこと。`preDrawSearchComplete` は対象内の全枝が合法終端・明示した対象外ドロー境界・監査済みUI循環へ分類され、残った予算境界/エラー/未対応が0であること。これらを同じboolへまとめない。
- `bestFound` は今回到達した候補中の評価最大値。対象内の枝が閉じていない間は「探索済み範囲の最良」と表示する。枝がすべて閉じても、手動評価関数上の最良という意味であり、勝率・貫通率・対面を問わない最強の証明ではない。
- 旧 `multi-opening-survey.json` のcompleteは既知templateを全pairへ試した意味であり、合法手順木の完全探索ではない (`survey-multi-openings.mjs:112-126`)。そのboolを新しい全探索の証拠に流用しない。

## kernelの確認結果

| 箇所 | 確認した動作 | 監査条件 |
| --- | --- | --- |
| 候補列挙 | singleは全候補、通常multiは全subset、SORTは全順列、counterは合計を満たす配分、宣言は全候補。SUM/TRIBUTEは重み付き条件をcoreへ委ねて全subsetを列挙 (`scripts/search-kernel.mjs:90-107`)。同名カードindexを列挙段階では統合しない。 | 生成されたすべての候補の終端/拒否/残件を保存する。順位が低いという理由で探索から消さない。 |
| 制限と再開 | maxNodes/maxMs/maxDepth/maxGenerated、onNode停止、未対応、例外をfrontierへ保持。nextCandidateで生成途中の残りを保持 (`search-kernel.mjs:275-316`)。 | 予算切れは不成立証明でも完了でもない。shard集約は333組を重複・欠落なく照合し、全組の残件を数える。 |
| 非合法と障害 | 実coreのRETRYをcoreRetryとして保存。一方wrapper側等の例外をinvalidResponseとしてrejectedへ落とす場合がある (`search-kernel.mjs:136-141`)。 | coreRetry以外のinvalidResponseを、合法な枝がない証明と扱わない。新runnerは未解決へ戻すか、少なくともcompleteをfalseにする。 |
| UI循環 | 固定presetのLink召喚取引のみ。許可messageはHINT/SELECT_UNSELECT/SELECT_IDLECMDだけ。全query、LP、phase、chain、logと同一pendingを確認し、同一取引内の祖先のみ照合 (`search-kernel.mjs:21-56,117-160`)。 | この方針の名称・script hash・縮約件数を残す。他のループはfrontierに残す。盤面だけのHOPT同一視は禁止。 |
| shard prefix | 祖先depthがrootDepthより前の取消循環は縮約しない (`search-kernel.mjs:151-156`)。 | shard root以前の同じ状態を理由に、そのshard全体を消さない。既存実コアテストがSELECT_PLACEと元Idle双方の出口を確認する。 |
| 終了 | turn>1またはduel終了をterminalにし、その判定はonNode/ドロー判定より先 (`search-kernel.mjs:269-280`)。 | 次ターンの最初のpromptを、nativeで利用できる先攻Main1の展開停止点と混同しない。turn2の相手通常ドローを含むterminalと、自分のturn1にドローした枝を分ける。 |
| 版の同一性 | checkpointはpreset/hand/seed/deckOrder/protocol hashとLink縮約policyを検査。legacy移行にはparserが候補を落としていなかったという仮定が残る (`search-kernel.mjs:203-227,323-327`)。 | 新runのsourceIdentityにはengine、adapter、DB、core実体、実際に読むscript群も含める。現在のLink監査hashがconstant.lua等すべての依存ファイルまで固定しているとは言わない。 |

## ドロー境界で取りこぼさない・混ぜない条件

実コアで闇の誘惑を解決したprefixを `stopOnDraw:true` で検索したところ、ドロー済みの `onNode` が1回呼ばれ、その後 `drawBoundary` frontierへ保存された。これは `onNode` がドロー判定より前に呼ばれる順序そのものを確認した証拠である。callbackの冒頭で自分のturn1のDRAWを検出し、採点・best更新・成功分類を行う前に除外する必要がある。

`engine.emit` はログごとにturnを持つため、turn1のDRAWとturn2の相手通常ドローを区別できる (`engine.mjs:56-57,84-86`)。文字列の「のターン」を数えてturnを推定する必要はない。可能ならraw messageのDRAWを根拠とし、表示用文言への依存を避ける。

ドロー後を範囲外として閉じる場合も、境界を消さず `excludedDraw` のような明示区分へ保存する。発生源のpair、応答prefix、ドローを起こした応答の位置、最後の無ドロー状態を再現できる証拠を持たせる。除外したのはドロー結果から先の分岐であり、それ以前の別選択肢まで除外してはいけない。

「内部coreがドローまで実行して境界を発見し、以降を採点しない」と「ドロー直前にcore実行を停止する」は異なる。前者の実装を後者として報告しない。自動入力へ渡すrouteは最後の確定した無ドロー停止点まで切り出して新しくreplayし、ドロー済み状態に保存されたfinal/scoreを付け替えて使わない。

## 展開成功と最良盤面

現在の `openingScore` は盤面カード重み、罠、残った手札、LPに加点し、入力数をわずかに減点する (`opening-policy.mjs:10-15`)。霊王の波動2枚だけの実コアfixtureで、開始時scoreは1.9、1枚を伏せるだけで3.198へ上がり、モンスターは0体だった。したがってscore>0、score増加、1応答以上、保存routeの存在はいずれも展開成功の条件にならない。

最低限、何もせず手札を持つ、伏せるだけ、通常召喚のみ、少量のLink/資源準備、展開盤面の成立を別区分として保存する。区分ごとの根拠は、実際の召喚・特殊召喚・サーチ・素材利用と、安定した停止点の盤面から取る。単にEXが1枚減ったという理由で十分な展開盤面を作れたと断定しない。妨害回数等を評価するなら、効果を使える条件と使用済み状態も確認する。

「2枚を与えた」と「2枚とも展開へ使った」も分ける。1枚初動に相方を残した経路、相方を汎用手札コストにした経路、2枚の固有効果を組み合わせた経路を区別する。同名カードの終端残存だけでは、最初の個体が未使用だったと証明できない。既存 `handUsage` も同名個体を追跡せず、初期カードが手札を離れた数の下限を示す設計である (`survey-multi-openings.mjs:37-74`)。

native候補へ保存するbestは、未解決chainや素材選択中の一時盤面ではなく、先攻Main1の安定したSELECT_IDLECMDなど、適用契約の停止点に限定する。多くの手順を探索しても、出力を1本へ絞ること自体は可能だが、残りの探索証拠とその1本の採用理由を失わないようにする。

## native適用ガードの現状

以前の監査後、native v2にはrequestId、draw/opponentEffect/negation/turn/duelのepoch、UNSELECTのfinish/cancel/群の件数が追加された (`native/AstraDecisionBridge.cs:19-75,125-140`)。policyはsession reset、request gap、重複応答cache、初手5枚とdeck35、preset一致、相手盤面なし、epoch変化、disabled、不一致による引退を検査し、Astraへ移った後に同じ盤面で自動再開しない (`opening-policy.mjs:82-133`)。既存テスト22件のうち関連するpolicyテスト9件が今回PASSした。

新たな全探索routeの接続について、次の修正と制限を確認した。

- 修正前は保存selection:[1]の同名手札2枚が[0]へ変換された。修正後の `matchFrame` は同じ参照を持つカード群の一部だけを選ぶ場合、Hand/Grave/Removed/Extra等ではfallbackする。全群を選ぶ順不同の集合と、後述する限定的なDeck例外だけを許可する。探索器側は引き続き元の個体index別の履歴を保存する。
- 修正前はmultiへsum:999/exact:trueを足しても受理された。修正後の `supportedMulti` は通常SELECT_CARD/SELECT_UNSELECTのみを許可し、重み付き合計・order・矛盾するsubtypeを拒否する。native `GameAI.OnSelectTribute` も明示的にSELECT_TRIBUTEを渡す修正を確認し、専用Pythonテスト1件がPASSした。これはソースとpatchの検証であり、稼働中GUIへの反映確認ではない。
- 状態照合はfieldのcode/positionと各zoneの枚数・名前等で、動的attack/level/linkやchainは含まない (`opening-semantics.mjs:39-51`)。現在のガードは「全公開盤面情報の完全一致」と同義ではない。追加経路がこの省略情報へ依存する場合は、動的状態を比較するか対象外にする。
- `openingSources()` は既存5群に加え、明示したpair-shard-0〜7とmulti-search-bestだけを読み込む。runtimeのcheckpointや除外DRAW frontierをディレクトリ走査で拾わない。loaderは実コアで無ドローと先攻Main1 SELECT_IDLECMDを検査する。JSONを書くだけでnativeへの接続確認を済ませたとは扱わない。
- 実戦の `bestOpening` は既定で24候補に絞る (`opening-policy.mjs:62-77`)。2枚探索の最良と、実5枚で全候補を再生した最良は同じ保証ではない。候補制限を維持する場合は、その範囲と失敗時fallbackを表示・記録する。

接続の観測可能な完了条件は、新しい探索出力に由来するrouteIdがnativeにロードされ、実際の5枚手札から実コアで再検証され、現在要求に合法な応答を返し、その次状態を確認できること。ドロー、相手干渉、不一致でAstraへ移ることも合わせて確認する。GUIやbridgeを停止したという事実、JSONの存在、WASMのreplay成功だけをこの確認の代用にしない。

## 新runnerのreadback

作成された `scripts/search-multi-pairs.mjs` を確認した。既知templateを検索するsurveyを呼び出して流用しているわけではなく、各pairのrootから `search` を呼び、onNodeでDRAW判定を最初に行い、自分のturn1/Main1/SELECT_IDLECMDのみを採点する。新しいbestの保存前にはrouteをreplayする。callback内のDRAW混入と、turn2 terminalをそのままnative用bestへ使う問題はこの構造で回避している。

`partitionResult` はdrawBoundaryを消去せずexcludedDrawへ移し、invalidResponseをunverifiedResponseとしてfrontierへ戻す。pure function確認で、drawだけが残った場合に除外証拠1件を保ちつつ対象内completeとなり、maxDepth/invalidResponse/未解決errorがある場合はcomplete=falseとなることを確認した。これは対象内completeの意味であり、全デュエルパターン完了ではない。reportはその区別を `allGamePatternsComplete:false` でも保持する。

分類はno-action、link-development、multiple-monsters、normal-summon-only、single-monster、set-or-spell-only、effect-only、no-board-developmentへ分ける。実コアの罠伏せのみをset-or-spell-onlyと分類することを確認した。`bestPlayable` は入力が1件以上あるという意味なので、その件数をそのまま展開成功件数と表示しない。

追加懸念の修正をreadbackした。

- 評価のweights/trapCodesはrunner内のscore v1へ固定され、runner自身のhashに含まれる。DB、strings、WASM、全Lua依存も起動時assetsHashに入り、searchIdentityをexportする。開始/保存前のJS source変更は拒否する。assetsHashは起動時に固定されるため、長時間実行中にLua/DB/WASM資産を変更しない運用前提は残る。プロセス間の変更はidentityで検出される。
- 過去のfailuresを専用failureHistoryへ保存し、次sliceのkernel.failuresは空にして保持frontierを再処理する。これにより、正常再処理されたprefixを過去の障害記録だけで永久に復活させる構造は解消された。

## 集約器・source統合の追試

`scripts/build-multi-search-report.mjs` の前版では、wrong-version・sourceHash欠落・visited=0・unresolved=99・complete=trueという333件の入力を受理し、searched=0、unresolved=32967なのにreport.complete=trueとなった。これは全fsをメモリ内へ置換した独立ハーネスで再現し、実際のreportファイルは出力していない。

修正後は `validateSearchIdentity` が現runnerのschema/presetHash/pairHash/sourceHash/assetsHashとshardを照合し、`validatePairSummary` がhand/id/physicalWeight、訪問数、残件数、status/completeの整合を検査する。summaryとbest-routesは同じgenerationを持ち、各best routeのpair、id、score、finalHashをsummaryのbestPlayableと照合する。重複pair・重複routeIdを拒否し、読み込んだ同じbytesからJSONとstampを作り、再生後に元sourceの不変性を再確認する。

メモリ内の追試では、333未探索の在庫を維持しcomplete=false、wrong-schema、sourceHash欠落、完了矛盾、重複pair、世代不一致、解析後のsource変更の6ケースはすべて拒否された。手作業routeも所有pairを確認した後、search routeと同じ実コア検証へ通す。

無ドロー判定も保存logだけでは不足していた。実在の `spell-1475311-no-dark-draw` の保存logを空にすると、従来のroute-harness.replayは実際にDRAWしても正常終了した。現版の `verifyNoDrawRoute` は各応答後の実logを検査し、この加工routeを拒否する。またMain1でもSELECT_PLACE途中のrouteを拒否し、最後がSELECT_IDLECMDであることを確認する。正常な `pair-shard-0-backup-impulse-accord` は同じ検証でPASSした。

この集約器の構造・反例の確認は、まだ出力していない最終reportや333件の実探索完了を保証するものではない。実成果物の生成後に、8shardと各sourceのreadbackを行う必要がある。

## 山札の同名copyだけを許可する条件

nativeのDeck検索候補はsequence=-1、攻撃力等が全0のlookup情報になり得る。この送信属性の一致だけを潜在個体履歴の一致と扱うことはできない。固定presetにはCrypterの除外M∀LICEを山札へ戻す処理があり (`data/scripts/official/c21848500.lua:65`)、Code Magicianには個体flagを使う処理もある (`c64865.lua:51`)。

一方、対象のCat/Backupは名前IDによる共有回数制限を使用する (`c96676583.lua:22,33`, `c30118811.lua:12,24`)。固定presetのcard LuaにはDeck上端/下端取得、Deckの並べ替え、上端確認、DiscardDeck、ReverseDeckの直接呼出しは見つからず、GetSequenceは場のゾーン判定のみだった。未知の順番を消費するDRAWは本探索の停止境界である。この固定条件内で、初期山札から一度も外へ出て戻っていない同名copyは、名前を保った個体の置換として扱える。

実装は `startDeckCopyAudit` を手付かずのfixtureから設置し、raw MOVEの自分の非Deck→Deck移動をcodeごとに恒久記録する。code不明・位置欠損・observer置換は証明全体を失効させる。`prepareOpening` は最初の応答前にobserverを設置し、各frameへdeckCopyProofを保存する。

partial選択の例外は、固定preset、先攻、相手干渉なし、ドローなし、連続した自己操作履歴に加え、通常SELECT_CARD、自分Deck、対象codeの復帰記録なし、コピー間の送信属性がsequence以外すべて一致する場合だけである。Hand/field/Grave/Removed/Extraの曖昧な個体選択、SUM/TRIBUTE/order、欠けた証明へ拡張しない。

独立再実行した14テストはすべてPASS。実CrypterでHareを山札へ戻したMOVEが履歴へ残り、不明MOVE/observer置換/属性差/非Deckは拒否される。初期DeckのBackup2copyについては、それぞれを選んで残りの経路を実コア再生し、同じ無ドロー盤面と合法候補へ到達した。これは上記条件付きの例外の証拠であり、一般的な同名個体や盤面の大域的合流を許可するものではない。

## 今回の検証

- `node --test tests/search-kernel.test.mjs tests/multi-opening-survey.test.mjs tests/opening-policy.test.mjs`: **22件PASS、失敗0、skip0**。333組/780重みの在庫、Link局所循環とshard境界、予算残件とresume、nativeのevent/session/重複要求等を確認。
- 読み取り専用Nodeの実コア確認: ドロー済みonNodeが1回呼ばれ、drawBoundaryが残る。罠1枚伏せのみでscoreが1.9→3.198、モンスター0。
- 読み取り専用Nodeのadapter反例は修正後に追試し、同名部分選択・重み付き要求の拒否を確認。最新の `node --test tests/opening-semantics-multi.test.mjs` はDeck限定例外を含む**14件PASS、失敗0、skip0**。
- `C:/Users/tofu/.local/bin/python.exe tests/native-patch.py PatchTests.test_tribute_tag_is_distinct_and_idempotent`: 1件PASS。最初の実行は誤ったtest class名で失敗し、正しい収録名で再実行した。
- 集約器の構造チェックとメモリ内6反例拒否、実coreによる隠したDRAW/不安定Main1の拒否・正常manual routeの再生がPASS。実report出力は行っていない。
- 新runnerの読み取り専用確認: 8shardの和が333組・重複0・物理重み780、DRAWと予算/adapter/errorの分離、turn2通常ドローの除外区分、罠伏せのみ分類がPASS。監査担当はrunShardを起動せず、他担当の探索出力を変更していない。
- 333組全探索の完了、すべての最良盤面、native実戦での新runner由来routeの適用は、この監査の時点では未確認。

## 統合変更の再監査（2026-09-08）

対象は `scripts/build-multi-search-report.mjs`、`opening-policy.mjs`、`opening-sources.mjs`、`native-bridge.mjs`、`scripts/patch-mdpro3.py`、`start-native.ps1`。承認条件は保存routeのverified、現presetと保存盤面のhash、現実コアによる再生、無ドロー確認である。native実測済みrouteのallowlistは要件ではなく、実戦での適用は実手札の予備再生と各requestの盤面・候補・履歴一致に従う。

**解消済み — P2 / runtime分離:** 前版の `native-bridge.mjs:13` はportを変更してもconfigPathを独立に本番の `runtime/astra-bridge.json` へ既定化し、`startNativeBridge({port:0})` が既存8788の接続設定を上書き、stop時に削除した。HTTPとfsをすべてメモリへ置換して再現し、実際の本番設定・portは変更していない。修正後は絶対pathへ正規化したうえで、非8788と本番configPathの組合せをroute読込・listenより前に拒否する。別ポートの設定作成はwxで既存ファイルを上書きせず、作成失敗時にはserverを閉じて起動失敗を返す。独立実行した分離回帰テストがPASSし、既存本番設定のhash不変を確認した。秘密値は出力していない。

それ以外の今回の対象変更では、新たな具体的不具合は確認できなかった。集約器は各応答後の実DRAWを検査し、loaderと実手札の予備再生も無ドローを検証する。最後の応答の解決結果もfinalOwnに一致しなければopening-completedにせずAstraへ戻す。DRAW/STANDBYから始まるShifterの任意発動窓は予備再生のframeに含まれ、該当テストがPASSした。

今回実行した検証は以下の通り。

- `node --test tests/multi-search-report.test.mjs tests/opening-policy.test.mjs`: **16件PASS、失敗0、skip0**。保存DRAWログを削除した経路、完了数の矛盾、誤identity、最終モンスター配置の変化を拒否し、実手札とShifterの開始窓を確認。
- `node --test tests/native-bridge-http.mjs`: **1件PASS**。専用の一時設定ファイルとport 58676で実HTTPを実行し、認証・同時推論拒否・同一要求の結果再利用を確認。モデル処理はstubで、作成したserverと設定のみ終了・削除した。
- 分離修正後の `node --test --test-name-pattern="isolated port" tests/native-bridge-http.mjs`: **1件PASS、失敗0、skip0**。configPath省略と本番path明示の別ポート起動を両方拒否し、本番設定のhash不変を確認。主担当からは修正後の同ファイル全2件PASSも報告された。
- `C:/Users/tofu/.local/bin/python.exe tests/native-patch.py`: **4件PASS、1件skip**。今回のTRIBUTE subtypeの区別と冪等性を含む。compiled bridge/packet handlerの実runtime試験は、このコマンドでは実行していない。
- PowerShell parserによる `start-native.ps1` の構文検査はPASS。起動・停止処理は実行していない。
- 公開済み `routes/multi-search-report.json`（updatedAt=`2026-09-08T00:10:05.726Z`）をreadbackし、333組・重み780、全組着手、全枝終了84組、訪問104108、終端29721、未解決34578、complete=falseの集計一致を確認。これは保存時点の結果で、並行実行中の新waveの最終値ではない。全333組の全枝終了や最善性を保証しない。

native endpointと意味変換の同時修正は別担当が検証中であり、本監査の17件PASSを全routeのnative完走証明として扱わない。実装の編集、ユーザーGUI/bridgeの停止、commit/pushは行っていない。

## 最終Accord蘇生の配置補正（2026-09-08）

`opening-placement.mjs` と `opening-policy.mjs` の統合を読み取り専用で監査した。適用対象は最終のAccord単独chainによるBinderとTranscodeの2枚蘇生に限る。予備再生の連続した最後の2つのSELECT_PLACE、MOVE/SPSUMMONING/HINT/SELECT_PLACEと最終解決eventの並び、途中の全own状態、予定slot/position、最終own状態を照合し、監査対象の両script実体のhashが一致した場合だけblockを作る。

次の2件を独立に再現し、担当の修正後に解消を確認した。

- **解消済み — 以前配置した対象の逆戻り:** 前版は直前の対象codeだけを覚えていた。実コアで作った `dorm-no-draw-firewall-accord` のblockを使い、Binder→Transcodeと応答した後でBinderだけが墓地へ戻るnative状態を与えると、3回目のBinder配置が受理された。現版は `opening-policy.mjs:148` が全回答済みcodeと自動配置で観測したcodeを累積し、`opening-placement.mjs:112` が全対象の予定位置への移動を確認する。以前の対象が消えるケースと未移動の直前対象を拒否する。
- **解消済み — pin照合の永久cache:** 前版は初回のhash一致を永久に使い回した。fs/cryptoをメモリ内へ置換し、初回trueの後で内容を変更しても2回目に読取が行われずtrueになることを再現した。現版の `opening-placement.mjs:15` は適用条件を満たすblockの構築ごとに両scriptを再hashする。実assetを変更せず、片方ずつ内容変更・読取失敗を注入する回帰で拒否を確認した。

native側の完了は、2枚が予定した位置・表示形式に存在し、全ownが予定終端と一致し、chainが空で、先攻Main1のメインフェイズ行動requestである場合だけ許可される。進行中はAccord単独chainと配置候補集合も一致させる。

独立実行した `node --test tests/opening-placement.test.mjs` は **45件PASS、失敗0、skip0**。正常な両蘇生順、捕捉済みnative request 94のTranscode配置、source event/chain/合法maskの不一致、余分なDRAW、盤面の変化、累積履歴、pin変更、完了条件を確認した。対象2ファイルの修正後readbackと `git diff --check -- opening-policy.mjs` もPASS。対象の具体的反例は解消済みであり、この限定監査に追加の指摘はない。全native代表12例の完走は別担当の検証範囲で、ここで成功とは扱っていない。

## 高速探索とreference移行の独立監査（2026-09-08）

`scripts/search-kernel-fast.mjs`、`scripts/search-multi-pairs-fast.mjs`、`tests/multi-pair-fast-migration.test.mjs` と集約器のfast対応差分を読み取り専用で監査した。今回の対象に具体的な不具合は見つからなかった。

高速kernelは、次に処理する最初の子に限り、同じ実DuelとLink取引のclosureを保持する。兄弟は以前と同じprefix全体を再生する。子の応答前にnode/time/重複の判定を行い、未生成tailのnextCandidateと残frontierを保持する。列挙、終端、DRAW境界、局所Link循環の条件はreferenceと同じであり、盤面による枝の合流を追加していない。使用済み効果等の状態は実Duel内に残り、盤面から再構成しない。

`finishRoute`が返すsteps配列と、snapshotが参照するchain等が後続応答で増える問題に対して、継続前にroute.stepsとlog/chain/lp/inputs/errorsの各配列を分離する実装を確認した。現engineはこれらの要素を後から変更せず、配列への追加・置換で更新するため、既に公開した履歴へ継続操作が混入しない。論理上の訪問数・生成数はreferenceの定義を保ち、実Duelの生成回数と応答回数はexecutionで区別する。

移行はreferenceと異なる保存先を要求し、sourceとdestinationの両方を排他的にlockする。現reference identity、preset、pair、seed=123、空rootPrefix、既定deck順、protocol、scopeを照合したうえで、search全体、DRAW除外、best routes、観測数、failureHistoryを保存する。既存の高速checkpointはoriginHash/payloadHashを照合して保持し、再移行で巻き戻さない。コピーだけで旧frontierを処理済みにせず、元の完了状態を引き継ぐ。

集約の `--fast` は高速専用runtimeと高速identityを選び、旧版と高速版を一つの集計へ混ぜない。各routeの実無ドロー再生、同generation、最良routeとの対応、全333組の在庫と未完了表示の検査は維持される。

- 独立実行した `node --test tests/multi-pair-fast-migration.test.mjs tests/multi-search-report.test.mjs`: **4件PASS、失敗0、skip0**。実Allure＋霊王を45nodes探索したreferenceからDRAW除外と残frontierを移行し、高速版40nodes再開後の再移行で進捗が戻らないこと、source bytes不変、異なるseed・競合lock・同じ保存先の拒否を確認した。
- 読み取り専用のfast report identity追試: 正規reference/fast各1件を受理、相互schema混入2件、fastにreference sourceHashを混ぜた1件、必須identity5項目の各欠落をすべて拒否。出力ファイルは作成していない。
- 主担当から、同じ凍結sourceでの全体 `npm test` **164件PASS**が報告された。この中の差分試験は、Wizard全木、node/depth/generated予算、checkpoint再開、Code of Soulの使用済み状態、公開履歴の不変性、Link取引、RETRY、DRAW停止をreferenceと比較している。既に成功した同条件の全体試験は重複実行していない。

この監査は全333組の実移行前に行った。全333組の移行完了や未解決枝の全探索完了を意味しない。referenceのsource/runtime、本番port 8788、稼働中GUIは変更していない。

## 通常召喚取消しの限定縮約と別estate移行の独立監査（2026-09-08）

`scripts/search-kernel-tribute.mjs`、`scripts/search-multi-pairs-tribute.mjs`、対応するkernel/migration試験、集約器の `--tribute` 差分を読み取り専用で監査した。最終kernelのSHA256は `4b3ff3af5f822c4fc9585b5dd1b6b09335fe29248c44dded2125055774ae9f93`。今回の限定対象に未解消の具体的な不具合は見つからなかった。

縮約対象は初期手札に唯一存在し、その後一度も自分の手札を離れていないバルドレイク `72656408` とマグナムート `33854624` だけである。コード別のSetで未離脱を追跡し、不明なMOVEやSWAP等は資格を失わせる。先攻Main1・空chainでの通常召喚action 0、正確な `HINT(3,500) → SELECT_TRIBUTE`、自分の表側モンスター・release_param=1・min=max=1・取消可能という条件から、直後の明示取消しで元のIdleへ戻る2入力だけを扱う。pending、全zone query、field query、LP、phase、chain、logの一致と固定資産pinも必要とする。固定rootPrefixより前・途中にかかる往復は削除しない。シフター、召喚セット、手札に戻った個体、別の召喚手順へは適用しない。

実使用WASMのregistry checksumとwrapper/core revisionの対応を読み、対応する `SummonRule` の取消し位置を照合した。取消しは召喚コストの実行、素材のリリース、召喚回数消費より前に戻る。一方、その前に `material_cards.clear()` があるため、公開盤面の一致だけでは一般化できない。上記の初期未離脱個体の条件、固定41カードLuaと補助scriptのpin、通常召喚proc/cost等の不在が必要である。これは全内部byteの不変や一般のHOPT同値を主張する監査ではない。provenanceは保存された公開registry資料とchecksumの照合であり、独立した再ビルドやRekor署名の暗号学的検証までは行っていない。

`shortenAuditedRoute` は元routeを実coreで監査し、証明された隣接2入力の組だけを除く。残る全入力を最初から再生し、各prompt・元のbefore hash・応答label・無ドローを照合してから、元finalHash/logとの一致と先攻Main1終端を要求する。短縮後のsteps、盤面、log、scoreは再生結果から生成する。探索checkpointの生履歴やfrontierを、この短縮routeで置き換える処理はない。

移行はfastと異なる保存先、両estateの排他的lock、元identity・seed・scope等の照合を要求する。旧search全体、DRAW除外、最良route、failureHistoryを保持し、migrationの祖先も残す。再移行はoriginHash/payloadHashが一致する既存進捗を保持し、巻き戻さない。v4で縮約済みのcheckpointはpolicy/pinが異なる、または縮約を無効にした実行では再開を拒否する。集約の `--tribute` は専用estateとidentityを選び、`--fast` との併用を拒否する。既存の実無ドロー再生、route/generation対応、全333組の在庫・未完了表示の検査は維持される。

- 独立実行した `node --test tests/multi-pair-tribute-migration.test.mjs` は **3件PASS**。実routeの取消し4入力削除、final/log維持と再採点、異なるsource identity拒否、DRAW除外を含むfast checkpointの移行・v4再開・再移行時の非rollback、source bytes不変を確認した。この実行は2枚目の対象追加前であり、最終sourceについては下記の全体試験を再利用した。
- 独立した実core追試で、バルドレイクの取消し86往復を含む182入力を10入力へ短縮し、86組だけの削除、元route不変、final/log一致、短縮routeの独立replay成功を確認した。出力ファイルは作成していない。
- 最終凍結後の読み取り専用追試で、証拠manifest **19件すべてのSHA**、実使用WASM、証拠文書SHA、kernelの上記SHAと有効pinを照合しPASS。マグナムートの取消し0/1/116回の保存済み3継続を読み戻し、9/11/241入力後のfinal（board・pending・log・rawを含む）が完全一致することを確認した。バルドレイクの通常召喚・Dormouse使用済み効果を含む6継続も先に読み戻している。
- kernel担当の最終限定試験 **10件PASS**、主担当の同じ凍結sourceに対する全体 `npm test` **178件PASS、skip0**を受領した。実coreの正のリリース枝、固定root、長い旧prefix、再開、DRAW境界、余分なイベント、未離脱条件、pin変更、追加マグナムートの116往復を含む。成功済みの同条件全体試験は重複実行していない。

全333組の別estateへの実移行と、その後の未解決枝の探索完了は、この監査の完了とは別である。共有実装、既存runtime/routes、本番port 8788、稼働中GUIは監査担当から変更していない。
