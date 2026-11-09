# 連弾魔女（canon-witch）カードイラスト制作指示 v3 — 遊戯王OCGのカード絵の画風へ寄せる

v2（`PROMPT-canon-witch-v2.md`）は縮小時の見分けやすさは達成したが、ユーザーから「AIっぽさが強すぎる。遊戯王のカード風に寄せて」と言われた。v3 は **割り当て（主色・明暗・構図・キャラの色）は v2 のまま**、**画風・塗り・線・顔・背景の描き方** を近年の遊戯王OCGの人物カードに寄せて13枚を作り直す。

先に `STYLE-GUIDE.md` の「1」「2」と「3. 連弾魔女」を読むこと。下の割り当て表は `STYLE-GUIDE.md` と同じ内容。

## 参照画像の扱い

- 依頼時に添付する画像は **公式OCGの可愛い系カードのイラスト（画風の参照）**。ウィッチクラフト・ピットレ／ポトリー／シュミッタ、ウィッチクラフトマスター・ヴェール、ドラゴンメイド・パルラ／ラドリー／ナサリー、マドルチェ・マジョレーヌ。
- 画像生成のたびに、これらを **style reference（線・塗り・影・ハイライト・光の入れ方・可愛さの出し方だけ）として** 渡す。**キャラクター・顔・髪型・衣装・帽子・武器・ポーズ・構図・背景の建物・ロゴ・紋章はどれも写さない。** 1枚の参照に寄せず、複数の参照に共通する線と塗りだけを使う。連弾魔女の4人はオリジナルのキャラとして描く。
- 試作への指摘の経緯：1回目「ピアノはプリキュアっぽい」「コーダはエクソシスターそのまま」→ 2回目（凛々しい音楽の魔導士）「青と緑がまだプリキュア」「カッコいい寄りになっているので、もう少し可愛く」。3回目は **テーマ名どおりの「魔女」の記号（とんがり帽子・ローブ・ほうき代わりの楽器）でプリキュアから離し、可愛さは表情と仕草で出す**。
- 2回目以降の依頼では、先に作った連弾魔女4人（77700501〜504）の画像も **キャラ設定の参照（髪型・髪色・衣装・顔立ちの一貫性）** として添付する。融合体・魔法・罠に出る4人はこれと同じ見た目にする。

## v2 が「AIっぽい」と言われた理由（直すこと）

- 画面全体が主色1色で塗りつぶされ、光る五線譜と音符が全面に散っている。どの絵も同じ飾り。
- 線画がほぼ無く、エアブラシの滑らかなグラデーション、つるつるの光沢、人物まで全身が発光している。
- 顔が4人とも同じ汎用のアニメ顔。衣装も全員同じ鍵盤柄の裾で、キャラごとの設計が薄い。
- 背景が抽象的な色の霧で、どこにいるのか分からない。

## v3 の画風（遊戯王OCGの人物カードに寄せる）

英語の画像生成プロンプトには、毎回次の **Style block** を入れる（言い回しは変えてよいが要素は落とさない）。

```
Style: modern Yu-Gi-Oh! OCG trading-card character illustration style (as in the attached style-reference card art), Japanese TCG anime illustration.
Clean confident line art: thin-to-medium uniform outlines in dark brown / dark navy (not pure black) around every figure, costume seam and hair strand group; a thin pale rim halo just outside the character silhouette separating her from the background.
Cel shading with 2-3 crisp tone steps; hard-edged shadows; anime hair with band-shaped highlight; small sharp white specular dots only. No airbrush gradients, no glossy plastic skin, no painterly blur, no bloom over the character, no volumetric haze over the figure.
Faces and figure: cute Japanese card-game illustration faces (as in cute Yu-Gi-Oh! OCG witch and maid cards): slightly rounded soft face, clear eyes with simple highlights (no star-shaped sparkles in the eyes), small nose and mouth, a soft smile, playful or mischievous expression; petite, youthful early-teen witch proportions about 5.5-6 heads tall, NOT chibi; each witch has her own face shape and expression, not the same generic face. Cuteness comes from expression and gesture: happily playing music, teasing, waving, playing with floating notes; no stern battle stance, no sharp glare.
Characters are original little music witches: pointed witch hats with music ornaments, capes, robes or long coats, and instruments used like witches' brooms or wands (a broom with a keyboard along its handle, a big tuning-fork staff ridden like a broom, a flute wand, a conductor's-baton wand with a crystal tip), with simple, readable costume construction (collars, clasps, belts, wide sleeves), consistent across the series.
Avoid: magical-girl-anime transformation-heroine look (puffy frilly mini dress, big chest bow, heart brooch, transformation-heroine boots silhouette, layers of frills, huge voluminous decorated hair, pastel palette, star sparkles in eyes, transformation pose), nun or church motifs (veil, wimple, cross, habit, prayer pose), maid apron, military cap, and any signature costume item of existing Yu-Gi-Oh! archetypes (Witchcraft, Dragonmaid, Madolche, Live Twin, Elfnote and others).
Background: a concrete place drawn simpler and slightly softer, lower contrast than the figure; the figure is the sharpest, most saturated element. Magic effects are drawn as graphic outlined shapes (a few bold note shapes, one or two ribbon staves), not glowing particles everywhere. Small four-point sparkle stars at most.
Color: the character keeps natural local colors (skin, white, hair, accent metal); the key color comes from the setting, lighting and effect shapes; do not tint the whole picture one hue.
```

- 人物カードは **全身（足先まで）または膝上が画面高の80〜90％** の「カードの見栄えポーズ」。3/4向きでこちらを見るか、技を出す瞬間。
- 光る五線譜・音符は1枚につき **太いリボン状の五線譜1〜2本と大きな音符3〜5個まで**。全面に散らさない。
- 鍵盤柄は4人で場所を変える（下の設定）。全員の裾を同じ鍵盤柄にしない。

## 4人のキャラ設定（全カード共通。融合体・魔法・罠でも同じ）

全員：小柄な「音楽の魔女」（10代前半〜半ばの見た目、約5.5〜6頭身、ちびキャラにはしない）。少し丸みのある顔、柔らかい笑顔・いたずらっぽい表情、楽しそうに演奏する・音符と戯れる仕草。4人とも **形の違うとんがり帽子** をかぶり、ローブ・ケープ・ロングコートを着て、楽器をほうきや杖の代わりに使う。露出は少なく、スカートは膝下。襟元の留め具に「2つの音符が重なって円を描く」小さな金の紋章。

避けること：プリキュア風（ふくらんだミニスカの変身ドレス、胸の大きなリボン、ハートのブローチ、変身衣装のブーツのシルエット、大量のフリル、極端な髪のボリュームと飾り、パステル、星の瞳、変身ポーズ）、凛々しい戦闘ポーズや鋭い目つき、修道女・教会の意匠（ベール、頭巾、十字、修道服、祈り）、メイドのエプロン、軍帽、既存の遊戯王テーマ（ウィッチクラフト、ドラゴンメイド、マドルチェ、Live☆Twin、エルフェンノーツ等）の固有の衣装・記号。

| 名前 | 髪 | 帽子 | 目・表情 | 衣装 | 持ち物 |
| --- | --- | --- | --- | --- | --- |
| フォルテ | 緋色の短いボブ、毛先が少し外はね | 先が後ろへ折れた紅のとんがり帽子、橙の帯と真鍮の小さな音叉のピン | 赤い目、八重歯の見えるいたずらっぽい笑顔、元気 | 紅のフード無しの短いケープ＋膝下丈の紅と橙のローブ（ゆったりしたA字、フリル無し）、茶色の太いベルト、黒いタイツ、茶色の短い編み上げ靴 | 真鍮の大きな音叉の杖（ほうきのようにまたがる／振る）。先の二股に小さな炎 |
| ピアノ | 腰までの真っ直ぐな青髪、ぱっつん前髪（飾り無し） | つばの広い濃紺のとんがり帽子、つばに白黒の鍵盤柄の帯 | 青いたれ目、眠たげで柔らかい微笑み、おっとり | 足首までの濃紺のゆったりしたローブ、広い袖、象牙色の大きな丸襟、ローブの片側に縦の鍵盤柄 | 柄に鍵盤が並んだほうき（横座りで乗り、柄の鍵盤を弾く）。水滴の音符 |
| ソナタ | 翠のポニーテール（ふつうの量、後ろで1つに結ぶ） | 先が横に曲がった短い翠のとんがり帽子、白い羽根1本と銀の小さなフルートの飾り | 緑の目、ウインクや口を開けた明るい笑顔、おてんば | 翠のポンチョ型ケープ（裾に五線譜の刺繍）、白いブラウス、膝下丈の翠のキュロット、白いハイソックスと茶色の靴 | 銀のフルートの杖（吹く／ほうきのように腰掛ける）。風の五線譜 |
| コーダ | 琥珀色の長い一本三つ編み（肩から前へ垂らす）、小さな丸眼鏡 | 背の高いまっすぐな焦げ茶のとんがり帽子、琥珀の結晶の音符飾りとメトロノームの振り子の飾り | 琥珀の目、丸眼鏡の奥で穏やかににっこり、しっかり者 | 焦げ茶と琥珀のロングコート（広い袖、前を留めた2列ボタン、ケープ・ポーチ無し）、琥珀色のロングスカート、焦げ茶の靴 | 先に琥珀の結晶が付いた長い指揮棒の杖。結晶の音符 |

## 出力

- 13枚。各 1024×1024 の正方形 PNG。保存先はこのフォルダ（`custom/art/`）の `<カード番号>.png`。このテーマの既存ファイルは上書きする（旧画像は統括側で退避済み）。**他テーマの画像・他のファイルには触れない。**
- 使った画像生成プロンプトを `custom/art/prompts-canon-witch.json` に保存する（`{"<番号>": "...", ...}`、修正パスがあれば追記）。依頼が2回に分かれるときは、2回目は既存のキーを残して追記する。
- commit・pushはしない。

## v2 から維持すること

- 主色が画面の40％以上（背景の場所・照明・空・水・炎・幕・効果の形）を占める。主色以外の強い色は副色1つまで。ただし **人物の肌・白・髪・金具は自然な色のまま**（画面を主色で染めない）。
- 縮小（イラスト約56px四方）で見分けがつく：大きな色面2〜3個、人物と背景の明暗差、カードごとに違うシルエット。
- 文字・数字・ロゴ・署名・透かし・カード枠・読める楽譜を入れない。既存の遊戯王カードのキャラ・衣装・構図に似せない。露出の多い衣装にしない。
- 種類ごとの描き分け：下級＝1人を全身で／融合＝2人が画面いっぱい、見上げる構図／魔法＝場所・道具（人物は小さく）／速攻魔法＝動きの一瞬／罠＝発動の瞬間・断つ・止める。

## 割り当て表（主色・背景・構図）と v3 の具体的な場面

| 番号 | カード名 | 種類 | 主色 | 副色 | 背景 | v3 の場面（主色の出し方） |
| --- | --- | --- | --- | --- | --- | --- |
| 77700501 | フォルテ | 下級・除去 | R 紅 | 橙 | 明（暖かい白） | 明るいリハーサル中の劇場の舞台。背後に大きな紅のビロードの幕（画面の4割）、窓からの暖かい白い光。フォルテが音叉の杖を元気よく斜めに振り、紅と橙の炎の形の音符（輪郭のある図形）が3つ弾け飛ぶ。いたずらっぽい笑顔。全身、斜めの動き。 |
| 77700502 | ピアノ | 下級・サーチ | B 青 | 白 | 暗（夜の水面） | 月夜の静かな湖の上。柄に鍵盤が並んだほうきに横座りして水面すれすれを飛び、柄の鍵盤を両手で弾く。水面に波紋、水滴の音符が数個。夜空と湖が深い青（画面の5割）、人物は明るく線でくっきり。 |
| 77700503 | ソナタ | 下級・展開 | G 翠 | 白 | 明（青空と草原） | 丘の上の草原と白い雲。翠の風のリボン五線譜に乗って斜め上へ舞い上がり、フルート杖を吹く。草原と風の形が翠（画面の5割）、空は淡い。縦長のシルエット。 |
| 77700504 | コーダ | 下級・回収 | Y 琥珀・金 | 茶 | 明（夕陽） | 夕陽の岩の台地。正面に立ち、指揮棒を高く掲げる最後の一振り。足元の岩から琥珀の結晶の音符が数本立ち上がる。金色の夕空（画面の5割）、茶の岩で締める。左右対称に近い落ち着いた構図。 |
| 77700505 | 連弾魔女の即興曲 | 速攻魔法 | P 桃のネオン | 藍 | 暗（夜の街角） | 夜の石畳の街角、藍の建物。桃色に光る太い五線譜の帯が画面を斜めに横切り、それを滑り降りて駆けつける小さなソナタ（画面高の2〜3割）。桃のネオンの光が画面の4割。看板の文字は描かない。 |
| 77700506 | 連弾魔女の音楽堂 | フィールド魔法 | W 白 | 4色 | 明 | 星の薄い白い空に浮かぶ白い石のドームの音楽堂の外観全体。開いたアーチから中の2台のグランドピアノが見える。4色（紅・青・翠・琥珀）の小さなステンドグラス。建物は線画で描いた堅い形。人物なし。 |
| 77700507 | 連弾魔女の協調 | 永続罠 | I 藍の光 | 4色 | 明（淡い藍の空） | 四方から伸びた4本の手（袖の色＝紅・青・翠白・琥珀茶）が中央で重なる接写。重なった手から藍の光の輪と、4色の細い五線譜が4本放射。奥に小さな黒い敵の影が押し返される。手は正確に4本、指は各5本。 |
| 77700508 | 連弾魔女の終止線 | 通常罠 | L 黄緑の光 | 黒 | 暗 | 黒い夜の空間を縦に貫く、太い2本の黄緑の光の柱（終止線）。横から来た敵の魔法の光線がそこで断たれて砕ける。柱の奥に小さなコーダが指揮棒を振り下ろした姿。柱は2本だけ。 |
| 77700509 | フォルテ＆ピアノ | 融合 | M 赤紫 | 白金 | 明 | 赤紫の夕焼け雲の空に浮かぶ1台の巨大な白金のグランドピアノ。フォルテとピアノが並んで座り四手連弾。手は合計4本。低い視点、横長の大きなシルエット。白金の光が遠くの敵の魔法をかき消す。 |
| 77700510 | ソナタ＆コーダ | 融合 | V 紫 | 翠・琥珀 | 暗（夜） | 紫の夜空と月の下の古い塔の屋上。ソナタ（フルート）とコーダ（指揮棒）が背中合わせに立つ。背後に紫の五線譜の大きな円が1つ。全身、見上げる構図。 |
| 77700511 | フォルテ＆ソナタ | 融合 | O 橙 | 翠 | 暗 | 夜の荒野。背後に巨大な橙の炎の竜巻（輪郭のある炎の形、画面の5割）。フォルテとソナタが中央で片手をつなぎ、空いた手に音叉の杖とフルート杖。翠の風の帯が竜巻の縁を走る。 |
| 77700512 | ピアノ＆コーダ | 融合 | C 青緑 | 琥珀 | 明（水晶の光） | 明るい青緑の水晶の洞窟。足元に白と青緑の水晶でできた巨大な鍵盤の階段。ピアノ（両手で水滴の音符を操る）とコーダ（指揮棒のみ）が並んで立つ。楽器は他に持たない。 |
| 77700513 | フォルテ＆コーダ | 融合・切り札 | K 黒 | 紅・金 | 暗 | 黒い空間。フォルテ（音叉の杖）とコーダ（指揮棒）が同時に振り下ろし、着地点の1点が金に光り、紅と金の細い二重の衝撃波の輪が広がる。黒が画面の6割以上。シリーズで最も力強いシルエット。 |

確認：R明・O暗・Y明・L暗・G明／C明・B暗・I明・V暗・M明・P暗（Tは使わない）。

## 生成後の確認

- 原寸で、線画があるか、人物がつるつる・発光していないか、背景が具体的な場所か、顔が4人で描き分けられているかを見る。崩れた手足・指・顔、余分な手、文字・記号の羅列、署名、枠があれば作り直す。
- 4人の髪型・髪色・衣装が全カードで一致しているか確認する。
- 13枚を約56px四方に縮小して並べ、同じ色・同じ構図に見える2枚がないか確認する。
