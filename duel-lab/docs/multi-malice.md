# Catを中心とする複数枚初動

固定 `preset.json` の40＋15枚から指定した2枚を抜き取って検証した。先攻、相手無妨害・空盤面、通常召喚権と各効果の回数未使用が前提。9本の保存ルートと2本のprobeを実coreで生成し、別の新規デュエルで全入力を再生した。

**8本は2枚が相互作用するM∀LICE展開、1本はDotだけが展開してCatを保持する小展開。** 全組合せ・全手順木の網羅、最善性、対妨害性能の測定は行っていない。任意ドローは全て辞退し、ドロー結果の探索を行わない。

## 保存した到達点

| 初手2枚 | 到達点 | 残る手札/魔法罠 | LP | 入力数 |
| --- | --- | --- | ---: | ---: |
| Cat＋コード・マジシャン | Crypter＋Binder＋I：P | GWC伏せ | 6200 | 73 |
| Cat＋Hare | アコード＋Binder | Cat | 6500 | 44 |
| Cat＋Rabbit | Crypter＋Binder | Rabbit | 6200 | 74 |
| Cat＋Dormouse | Crypter＋Binder＋リングリボー | Rabbit | 5900 | 89 |
| Cat＋封印の黄金櫃 | Crypter＋Binder＋リングリボー | Rabbit | 5900 | 89 |
| Cat＋UNDERGROUND | Crypter＋Binder＋リングリボー | Rabbit、UNDERGROUND | 5900 | 89 |
| Cat＋テラ・フォーミング | Crypter＋Binder＋リングリボー | Rabbit、UNDERGROUND | 5900 | 92 |
| Cat＋ウィザード | Crypter＋Binder | なし | 6800 | 43 |
| Cat＋ドットスケーパー | S：Pのみ | Cat | 8000 | 13 |

Crypterは《M∀LICE＜Q＞HEARTS OF CRYPTER》、Binderは《M∀LICE＜Q＞WHITE BINDER》。アコードの発動無効は1ターンに1度であり、残したリンク数を無効回数に数えない。I：P・GWC・リングリボー等の相手ターン処理は、この先攻到達検証では実行していない。

## Cat＋コード・マジシャン

`cat-mag-crypter-binder-ip-gwc`。

1. Catを通常召喚してデコーダーへ。デコーダーと手札のコード・マジシャンでウィキッドをリンク召喚。
2. コード・マジシャンでドットを墓地へ送り、ウィキッドのリンク先へ特殊召喚。ウィキッドで墓地のCatを除外し、バックアップをサーチ。Catは300LPで帰還。
3. バックアップを特殊召喚し、Dormouseをサーチして、そのDormouse自身を捨てる。初手の追加捨て札は使わない。
4. ウィキッド＋CatでBinder。墓地のDormouseを除外し、300LPで帰還させる。
5. DormouseでRabbitをデッキ除外、300LPで帰還してMTPをセット。
6. Binderを除外してMTPを発動し、Hareをサーチ。Binderは900LPでメインモンスターゾーン4へ帰還し、任意ドローは辞退。
7. バックアップ・ドット・Dormouseの3体でCrypterを右EXモンスターゾーン6へ出す。
8. Hareで墓地のMTPを除外して特殊召喚。Rabbit＋HareでI：Pをゾーン2へ。
9. まだ未使用のBinder②でGWCをセットする。

Crypterのリンク先にBinderとI：Pを残す。Catの手札交換効果を使わず、コード・マジシャンを最初から持っていることで、バックアップの検索先を「捨てて後で帰還させるDormouse」に回せる。コード・マジシャン適用後はサイバース族だけを特殊召喚する。

## Cat＋Hare / Cat＋ウィザード

`cat-hare-accord-binder` は、Catを先にデコーダーへ変え、墓地のCatをHare①のコストにする。HareとCatが特殊召喚され、デコーダーを含む物理素材3体が揃う。Binderへ進むとデコーダーが帰還し、BinderでHareとCatを除外してHare③でCatを手札へ回収できる。TBでDormouseを特殊召喚し、Binderの帰還も使ってアコード＋Binderにする。TBで呼んだDormouseの効果は禁止されたままなので発動せず、リンク素材にする。

`cat-wizard-crypter-binder` はCatをデコーダーへ変えると、ウィザード①が要求する「EX由来のサイバース」と「墓地の闇属性サイバース」が揃う。ウィザード＋Catを蘇生し、3体でBinder、デコーダー帰還、BinderでCatを除外帰還。MTPからHareを出し、デコーダー・Cat・HareでCrypterを作ってBinderを残す。この線はドットもコード・マジシャンも使わない。

## Catの手札除外を使う線

`cat-rabbit-crypter-binder` はCatを通常召喚し、Cat①で手札Rabbitを除外する。2ドローは辞退するがRabbitの帰還と罠セットは成立する。その後はMTP・Hare・ウィキッドを経由し、バックアップで検索したコード・マジシャンを捨ててドットへ接続。BinderとGWCからCrypter＋Binder、手札Rabbitまで進む。

Cat＋Dormouseは同じくCat①でDormouseを除外してドロー辞退。黄金櫃・UNDERGROUND・テラの場合は相方の魔法からDormouseを除外帰還させ、通常召喚権をCatに使う。この4種は「Dormouse帰還済み＋通常召喚したCat」の共通盤面へ入り、Rabbit/MTP・ウィキッド・バックアップ・ドットへ接続する。追加のCatを最後まで素材として残すことで、Crypter＋Binderにリングリボーを追加できる。

Cat＋Rabbit/Dormouseを、Cat単独の1枚初動として数えない。Cat①の発動にはもう1枚のM∀LICEを要する。

## 小展開とドロー境界

- Cat＋Dotの保存線は、Dot通常召喚→デコーダー→Dot帰還→S：P。Catは手札で保持されるだけで、2枚が連動したM∀LICE初動ではない。
- `cat-cat-no-draw-sp` probeは、Catが別個体Catを除外し、ドローを辞退して帰還→デコーダー/S：Pまで。帰還効果の名称ターン1は個体間で共有し、2枚目だからもう一度使えるとは扱わない。全ての後続線を否定する証明ではない。
- `cat-hare-before-optional-draw` probeはCat①でHareを除外した直後の「2ドローするか」の選択前で停止する。**ドローは実行せず、結果も列挙しない。** このprobeは自動入力の完走ルートへ登録しない。ドローなしのCat＋Hare本線は別途保存してある。

ローカル `data/cards.json` のCatのstrings index 2は「特殊召喚」だが、`data/scripts/official/c96676583.lua` は同じ識別子を任意2ドローの選択に使っている。検証スクリプトは表示文字列に頼らず、`SELECT_YESNO` のカードコード96676583・効果index 2を識別して辞退する。この研究では共有カードデータを変更しない。

## 再生成と自動入力への条件

```powershell
node scripts/research-multi-malice.mjs --write
```

開始手札を本来のデッキから取り除き、40枚の総数、最終モンスター・手札・魔法罠・LP、ドロー0をassertする。保存する全stepsには実coreの要求と盤面のハッシュを持たせ、新規デュエルで入力ラベルと最終ハッシュまで照合する。`--trace` で具体的な選択を表示できる。

実戦の5枚手札では、残り3枚や相手の妨害で合法選択肢が変わる。固定fixtureのaction番号をそのまま入力せず、必要カード・対象・配置・効果回数を実際の要求と照合する。例えばCat＋Mag線のDormouseやDotが既に手札にある場合、ここに保存した検索・送墓手順とは一致しない。条件に合わないところは再判断へ戻す。
