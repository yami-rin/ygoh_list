# 追加ドローを使わないCyberse系の2枚展開

固定40枚プリセットから実際に2枚を抜いた手札で、20本の合法入力列を実コアで再生した。残りの初手3枚を仮定せず、相手空盤面・先攻・妨害なしで検証している。全ペア、全順序、全配置を探索した結果ではなく、異なる有用な終点と明示的な負例の記録である。

出力は `routes/multi-cyberse.json`。各ルートには `hand`、`presetHash`、各入力の直前状態ハッシュ `steps[].before`、実際の入力、最終盤面、LP、手札、最終ハッシュを保存する。`finishRoute` 後に新しいコアを作る `replay` で独立検証する。すべて `requiresDraw: false` で、任意ドローを断り、ログにドローがないことと40枚のメインカード保存を検査する。

|初期手札|本数|検証した終点|残LP／残手札|
|---|---:|---|---|
|Backup＋灰流うらら|2|I:P＋Wicked／Accord＋Transcode|8000／0枚|
|Backup＋Cat|3|Crypter＋Binder／Binder＋I:P＋Hare／Accord＋Transcode＋Binder＋Accesscode|6800／0枚|
|コード・マジシャン＋Cat|3|同上3種|6800／0枚|
|Backup＋コード・マジシャン|3|同上3種。BackupでCatを検索して捨てる|6800／0枚|
|コード・マジシャン＋Wizard|2|I:P＋Wicked／Accord＋Transcode|8000／0枚|
|コード・マジシャン＋Code of Soul|2|I:P＋Wicked／Accord＋Transcode|8000／0枚|
|コード・マジシャン＋Dot|2|Transcode＋Wicked／Firewall＋Decoder。どちらも墓地Soul|8000／0枚|
|Dot＋Hare|1|S:P。Hareによるテーマ展開が増えない負例|8000／Hare1枚|
|Backup＋Hare|2|I:P＋Wicked／Accord＋Transcode|7700／Hare1枚|

## Catへアクセスする3系列

Backup＋Catは、Backup通常召喚でコード・マジシャンを検索してCatを捨てる。コード・マジシャン＋Catは、Catを通常召喚してDecoderへ変換する。Backup＋コード・マジシャンは、BackupでCatを検索してそのまま捨て、元の手札のコード・マジシャンを残す。

そこからDecoderと手札のコード・マジシャンでWickedを出す。コード・マジシャンでDotを墓地へ送り、DotをWickedのリンク先へ蘇生。Wickedで墓地Catを除外してBackupを検索し、Catは300LPを払って特殊召喚する。Backupを手札から特殊召喚し、WickedとCatでBinderを作る。コード・マジシャン＋Cat系列では、Backup特殊召喚時の任意の検索・捨て札効果を断っている。

Binderは最初の特殊召喚時に墓地のCatとコード・マジシャンを除外する。Catの帰還効果は使用済みであり、もう一度特殊召喚しない。BinderでMTPをセットし、Binderを除外してセットターンにMTPを発動、Hareを検索する。Binderは900LPで右端メインゾーンへ帰還し、追加ドローを断る。Hareは墓地MTPを除外して特殊召喚する。ここでBinder、Dot、Backup、Hareの4体になり、LPは6800となる。

終点は次の3種を実証した。

- CrypterはDot・Backup・Hareの3体で右EXゾーンへ。右端メインのBinderがCrypterのリンク先を埋め、除外MTPをCrypter①の資源に残す。
- I:PはDot・Backupの2体で左EXゾーンへ。Binder・Hareを残す。相手ターンに行う追加リンク召喚の手順は今回の記録に含めていない。
- AccordはDot・Backup・HareでTranscodeを出し、Decoderを蘇生。Binder＋DecoderでAccesscode、Decoderの帰還を経由してTranscode・Accesscode・DecoderでAccordを出す。AccordでTranscode・Binder・Accesscodeを蘇生する。Accord②の無効は1ターンに1度であり、蘇生3体を3回の無効と数えない。蘇生効果後の追加特殊召喚も行わない。

## 捨て札と復活順序の違い

Backup＋任意手札コストの実証札は灰流うららである。追加の手札を捨てることで検索したコード・マジシャンを保持でき、Wicked成立後のDot蘇生でBackupの再検索へつながる。この記録は全種類の捨て札への置換を検証したものではない。Catを捨てる場合の追加1体を、任意の捨て札にもあるものとして扱わない。

Hareの除外誘発は300LPを払う手札回収で、自己特殊召喚ではない。Backup＋Hareでも回収Hare以外のM∀LICEが手札・墓地にいないため、そのHareを手札から特殊召喚できない。最終的にHareを保持して汎用Cyberse線へ着地する。

Dot＋Hareは、Dot→Decoder→Dot帰還の時点でもHare①を発動できないことをコアの選択肢で検査した。S:P到達後も同様。Dotの墓地帰還と除外帰還は同ターンに併用できず、この2枚をテーマへつながる初動として数えない。この負例はその手順を検証したもので、全合法木を走査した証明ではない。

コード・マジシャン＋Dotでは、Wickedが出る前にDotが帰還済みになる。そのDotが既に場にいることではWickedの検索は誘発しない。そこでコード・マジシャンでSoulを墓地へ送り、TranscodeからWicked蘇生、またはDecoder蘇生→Firewall＋Decoder帰還の2終点を検証した。墓地Soulを使う相手ターン展開自体は未検証で、現在の2体盤面と墓地資源までを記録している。

## 再生成と検証

`duel-lab` で `node scripts/research-multi-cyberse.mjs` を実行すると、20本を実行・独立再生してJSONを再生成する。`--only=backup-cat` のように絞る場合は既存の出力を上書きしない。`--trace` で各合法候補と選択箇所を表示できる。

手札が5枚ある実戦へ入力を移すときには、追加手札による候補順・場所・効果の変化を扱う必要がある。このJSONの数値インデックスを異なる盤面へ無条件に投入してよいとの検証ではない。実戦の自動入力への接続、全ペア集計、最適終点の比較、妨害を受けた分岐は主担当の統合範囲とする。
