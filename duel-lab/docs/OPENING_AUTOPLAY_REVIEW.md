# 展開帳の native 自動再生・独立設計監査

本書は接続前の監査記録。後続実装でprotocol v2の履歴番号・素材選択context・意味による入力変換を追加し、実nativeの3展開で終端一致を検証した。現在の対応範囲と残る制限は[OPENING_AUTOPLAY.md](OPENING_AUTOPLAY.md)を参照する。以下の「現在」は監査時点を指す。

監査日: 2026-09-08。対象は `native/AstraDecisionBridge.cs`、`native-bridge.mjs`、`prompts.mjs`、`native-payload.mjs` と現在の WindBot 入力処理。実装は変更していない。以下は接続前に必要な条件をまとめたもので、native 実戦で自動再生が動作したという報告ではない。

実コアで実際の5枚手札から予備再生し、選択の意味とその直前状態を照合する方向は、保存済みの選択肢番号を直接再利用する問題を避けられる。ただし、**現在の native payload だけでは、間にドロー・相手干渉・使用履歴の変化がなかったこと、および省略された選択の内容を完全には確認できない**。完全一致した「盤面＋prompt」だけを、経路履歴の一致として扱うことはできない。

## 実装から確認した相違

| 対象 | 現在の事実と根拠 | 自動再生に必要な扱い |
| --- | --- | --- |
| 選択肢番号 | WASM は YES=0、NO=1 (`prompts.mjs:30-33`)。native は false=0、true=1 (`native/AstraDecisionBridge.cs:103-105`)。 | `{yes:true}` などの意味へ変換後、現在の native 候補から応答番号を再生成する。保存番号の転記は禁止。 |
| 効果識別 | WASM の効果説明は `code << 20` と下位20bit (`cards.mjs:19-22`)。native の説明解釈は `code * 16 + offset` (`native-payload.mjs:13-15`)。 | カード効果は code と effectIndex、汎用システム説明は systemId に分ける。日本語ラベルだけで同一視しない。不明な説明値は不一致にする。 |
| 主体・場所 | native は WindBot の自分0を payload の player1へ変換する (`AstraDecisionBridge.cs:38,56,76-78`)。WASM fixture の自分は core0 (`scripts/route-harness.mjs:23`)。場所は native enum文字列、WASM数値。phase も `Main1` と `MAIN 1` のように表現が異なる。 | 対応を明示して正規化する。盤面だけでなく候補、配置先、chain にも同じ主体変換を適用する。 |
| 素材の選択・解除 | native `GameBehavior.cs:1097-1143` は `SELECT_UNSELECT` の第2群を読み捨て、finishable/cancelableを統合し、第1群だけを通常の multi として渡す。WASM は両群と確定/取消を保持する (`prompts.mjs:36-39`)。 | native subtype、両群、canFinish/canCancel が取得できるまでは、解除や曖昧な確定/取消を自動対応したとしない。標準Linkで選択を追加するだけの経路でも、各段階と終了条件の明示的な対応証拠が必要。 |
| 省略される選択 | native `Single` は候補1件ならHTTPなし、`SelectCards` は全件必須ならHTTPなし (`AstraDecisionBridge.cs:93-111`)。表示形式1通りもHTTPなし (`GameBehavior.cs:1566-1574`)。 | nativeと同じ条件で強制応答を証明できるステップだけ省略する。将来の似たpromptへ自由に飛ばすlookaheadは禁止。省略列を進めた結果、一意に次要求へ一致した場合だけ使用する。 |
| 任意選択もnativeが省略する | `HINTMSG_FIELD_FIRST` の取消を即時送信 (`GameBehavior.cs:1059-1063`)。`SORT_CHAIN` は常に -1 (`GameBehavior.cs:884-887`)。 | 「HTTPに来なかった＝選択肢が1つ」は成立しない。これらは別途nativeの実応答を追跡するか対象外にする。 |
| 合計・リリース | native SUM は必須素材の寄与を合計から引き、optionalだけをBridgeへ渡す (`GameBehavior.cs:1588-1659`)。CARD/TRIBUTEも同一multi形へ変換される (`GameAI.cs:309-311,802-804`)。 | raw subtypeと必須素材情報が不足したままWASM SUM/TRIBUTEと等しいと扱わない。合計・exact・寄与・枚数の別を保つ。native側は枚数min/max検証なので、重み付き合法選択が別途拒否される可能性もある。 |
| 配置・順序 | native PLACEは候補を一つの主体/ゾーン種へ絞り、maskへ変換し、要求枚数を読み捨てる (`GameBehavior.cs:1471-1558`)。`code`へ入る値は `_select_hint`。SORT_CARDは選択順をnative側で逆置換へ変換する (`GameBehavior.cs:838-876`)。 | 配置は controller/location/sequence の意味で照合し、hintを配置カード本体と誤認しない。1枠限定等の対応範囲を明示。順序応答はnative候補indexの並びを返し、WASMのwire用逆置換を転記しない。 |
| 応答形式 | native multi は `response["cancel"]` のbool変換を先に評価する (`AstraDecisionBridge.cs:114-117`)。 | 通常選択も `{selection:[...],cancel:false}` を返す。UNSELECTのWASM単一actionをそのまま返さない。型・個数・重複・範囲を送信直前に再確認する。 |

`compactNativePayload` は観測した実装では元の階層とフィールドを保持し、catalog/effectTextを追加する (`native-payload.mjs:6-20`)。圧縮処理によって動的状態が消えるという根拠はない。ただし安全判定はcatalog内の静的カード情報を現在の盤面状態と混同せず、意味の確定した動的フィールドで行う。

WASMの `choiceCard` は `{...c,...cardInfo(c.code)}` の順で合成するため、promptカードの同名フィールドには印刷上の攻撃力・レベル等が入る (`prompts.mjs:5-6`)。盤面の動的値はquery結果を使う。`engine.snapshot` は逆に `{...cardInfo,...queryResult}` で動的値を優先する (`engine.mjs:116-120`)。

## 盤面一致で不足する情報

native payload は turn、手番、phase、各ゾーン、LP、deckCount、chainのカード一覧を送るが、requestId、イベント履歴、通常召喚/効果使用履歴は送らない (`AstraDecisionBridge.cs:72-79`)。nativeの `Duel.CurrentChainInfo` には発動主体と効果説明が存在し、無効化indexも保存されるが、Bridgeへは送られない (`GameBehavior.cs:773-835`)。chain内のカード名・枚数が同じでも、発動効果や無効化された内容までは一致しない。

公開状態にも欠落がある。`ClientCard` は LinkMarker、Owner、ProcCompleted、Overlays を持つが、BridgeのCardには含まれない (`ClientCard.cs:29-38`, `AstraDecisionBridge.cs:37-43`)。カウンターは更新パケット内で読み捨てられる (`ClientCard.cs:143-147`)。したがって「nativeが今送るフィールドの一致」と「見えるすべての状態の一致」は区別する。省略フィールドの影響を除外できない経路は自動再生の対象に含めない。

ドローは `GameBehavior.OnDraw:425-437` で処理されるが、`GameAI.OnDraw:105-107` はExecutorにだけ通知する。Bridgeが次に受ける手札枚数の差から、途中ドローを一般に検出することはできない。ドロー後に捨てる・除外することで枚数差が消える可能性がある。相手のチェーンも解決後には `CurrentChain` から消える。

既存の実コア反例 `tests/search-enumeration-audit.test.mjs:272` では、コード・オブ・ソウルの効果使用後に表示盤面が同じでも、使用履歴を維持した別の探索先へ進む。これは盤面のみで継続可否を決めない根拠であり、native実戦での同じ反例を今回再現したという意味ではない。

## 5枚手札への再生条件

1. **実際の5枚を最初から配置する。** 5枚すべてをmainから枚数分差し引き、EXを含む使用デッキを確認する。元の1枚初動routeは方針の種であり、その検証済みフラグを5枚版へ引き継がない。他の4枚によって、サーチ先の残数、手札から使える素材、発動可能な誘発、同名候補のindexが変わる。各ステップで現在の合法候補から意味を一意に解決し、実コアの応答拒否がないことを確認する。
2. **相手の初期公開枚数を別途扱う。** 現行 `startRoute` はfixturesモードのため両者の開始ドローが0となり、5枚fixtureでも相手は手札0・山札40 (`engine.mjs:42`, `route-harness.mjs:23`)。実戦の手札5・山札35とそのまま全状態一致しない。相手の未知の手札をサーバーから読み出す、または固定presetの特定カードだと仮定して一致させてはいけない。未知カードの初期枚数をどう投影するかを明示し、相手の行動を含む経路の検証とは区別する。
3. **重複カードと山札順を安易に消さない。** 動的な選択対象はcodeだけでなく現在の場所・sequence・候補内での区別を維持する。デッキ検索候補のsequenceは予備再生の山札順と実戦で異なる可能性がある。同名の複数候補から一意に意味を解決できない場合はfallbackする。未知の山札順を知っている前提でドロー先を選ばない。
4. **ドロー結果を利用する前に停止する。** 闇の誘惑等を発動する前まで、または確定したドロー境界までの経路は別扱いにできるが、fixtureのseed/deckOrderから得たカードを実戦の予測として再生してはいけない。現行 `engine.record` の表示用logも全raw messageの履歴ではないため、chance判定には実コアのDRAW等のイベントを使う (`engine.mjs:63-67,80-98`)。
5. **互換性証拠を固定する。** 現在のrouteにはpresetHashがあるが、nativeのcore/script版との同一性までは示さない (`route-harness.mjs:24,48`)。異なる説明番号・SUM応答形式が実際に存在するため、core、card DB、script、adapterの版/hashと対応範囲を記録し、変更時は再検証する。WASMでの合法応答だけをnativeの実戦完走証拠にしない。

## 接続前に満たす最小条件

- セッションの確かな開始点を設け、初手、先攻、ターン1、主動作前の状態から連続した経路として管理する。途中の似た盤面から再開しない。先攻選択など初手以前の要求は、展開再生をまだ開始していない状態として区別できる。
- native側で requestId と、最後の応答以降の意味のあるイベント/強制応答の連番または履歴を提供する。少なくともドロー、相手の発動・行動、無効化、予測外の移動や状態変化を、次のHTTP要求時にも検出可能にする。枚数差やchainの現在値だけで代用しない。
- 各対応promptを明示的に型分けし、全候補・枚数/合計条件・確定/取消条件まで比較する。選びたいカードが存在するだけでは合格にしない。完全一致が不可能なsubtypeはfallbackする。候補数の増減を黙って無視しない。
- 省略される応答は証明できるものに限定して有限個進める。任意行動、効果処理、ドロー、相手入力を「同じ次promptに見える」という理由で飛ばさない。次に一致する候補が複数なら不一致として扱う。
- 未対応、不一致、相手干渉、ドロー、core拒否、タイムアウトでその再生を無効にする。同じターンで後から似た盤面を見つけても、自動的に再有効化しない。fallbackには直前までに確認した自分の応答履歴を渡し、Astraが展開帳ですでに実行した手順を知れるようにする。
- session変更時はAstraのplanだけでなく、再生cursor、準備中の予備再生、結果cache、失効状態をリセットする。古い非同期結果を新sessionへ適用しない。現在の `native-bridge.mjs` は単一busy制御とsessionごとのplanクリアがあるので、それを維持した同じ要求処理内に接続する。

これらは親担当が実装範囲を判断するための条件であり、今回native側のイベント契約やadapterを実装したわけではない。

## 接続後の確認項目

| 実例 | 必要な観測結果 |
| --- | --- |
| 同じ初動カード＋異なる4枚、サーチ対象を初手に引いた手 | 5枚版を実コアで再検証し、欠ける対象を旧indexで選ばない。 |
| 初手に同名2枚、候補順の変更 | 一意に対応する現在indexを使用。曖昧ならfallback。 |
| YES/NO、複数効果、同一カードの選択と解除 | ネイティブで実際に意図した意味が選ばれ、次状態まで確認できる。 |
| 強制表示形式/全件選択が連続するLink展開 | 省略列のみ同期し、次の任意選択を飛ばさない。 |
| コード・オブ・ソウル使用後、相手発動後に盤面が戻る場合 | 見た目の一致で旧経路を再開しない。 |
| ドロー後に枚数が戻る、展開途中で新sessionへ切替 | 即時再生を失効し、古い結果を応答しない。 |
| core/script/preset/adapter変更 | 旧コンパイル結果を使わず再検証、またはfallback。 |

## 今回の実行証拠と限界

- Nodeの読み取り専用プロトコル確認: `makePrompt(SELECT_YESNO)` が `[true,false]`、nativeソースが `[false,true]`、`compactNativePayload` が元のdescriptionを保持することをassertしPASS。
- `startRoute(preset.main.slice(0,5))` を実行: 自分は手札5・山札35、相手は手札0・山札40、最初のpromptは `SELECT_IDLECMD`。確認後coreをcloseした。
- `node --test --test-name-pattern 'unchanged Code of Soul board' tests/search-enumeration-audit.test.mjs`: 1件PASS、失敗0、skip0。
- native C#のビルド、MDPro3での自動再生、イベント契約の追加、速度計測は今回の範囲外。実装ファイルと他担当の成果物は変更していない。
