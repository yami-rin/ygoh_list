# 魔法・罠の1枚初動検証

固定 `preset.json` の魔法4種類、罠5種類を対象とする。先攻1ターン目、相手は空盤面で妨害しない。初手は対象カード1枚だけとし、その1枚を元の40枚から除いた39枚を山札に入れる。追加の手札コストを初期状態へ混入しない。

実ルールエンジンで25本の展開・不成立例と41本の初回除外先probeを生成し、別のデュエルから入力・途中状態ハッシュ・最終盤面を再照合した。初回除外先はエンジンが提示したカード名別の全合法候補を検査した。以後の全合法手順木や最大盤面を網羅したという意味ではない。

| カード | 判定 | 実証した確定到達例 |
| --- | --- | --- |
| M∀LICE IN UNDERGROUND | 1枚初動 | I:P＋WHITE BINDER＋MTP伏せ、手札Rabbit、6800LP |
| 封印の黄金櫃 | 1枚初動 | Accord＋WHITE BINDER、6200LP。S:P＋Dormouse/CatやWHITE BINDER＋MTPの7100LP分岐も実証 |
| テラ・フォーミング | 1枚初動 | UNDERGROUNDを経由し同じ盤面。6800LP |
| 闇の誘惑 | ドロー依存 | 唯一の手札では展開を保証しない。闇属性を引かず手札が全て墓地へ行く反例を実証 |
| 霊王の波動 | 先攻単独では展開不可 | 空盤面ではセットまで |
| MTP－07 | 先攻単独では展開不可 | セット当日の発動に表側M∀LICEが必要 |
| GWC－06 | 先攻単独では展開不可 | 蘇生対象と、セット当日なら表側M∀LICEが必要 |
| TB－11 | 先攻単独では展開不可 | セット当日の発動に表側M∀LICEが必要 |
| 神の密告 | 先攻単独では展開不可 | 空盤面ではセットまで。展開効果を持たない |

この分類は先攻の展開開始能力についてのもの。罠の妨害性能や、前のターンからセットしていた場合の働きを否定しない。

## UNDERGROUND・テラ・フォーミングのContract分岐

テラ・フォーミングなら、最初にUNDERGROUNDをサーチする。以下のドロー回数は0回。

1. UNDERGROUNDの発動時処理でRabbitを除外。300LPで帰還し、MTPをセット。
2. MTPの当日発動コストでRabbitを除外し、Dormouseをサーチ。Rabbitの帰還は使用済みなのでここでは戻らない。
3. Dormouseを通常召喚。その効果でCatを除外し、300LPで帰還。
4. Dormouse＋CatでContractをEXモンスターゾーン5へL召喚。場のUNDERGROUNDを墓地へ送り、Code Magicianをサーチ。
5. Contractと手札のCode MagicianでWickedをゾーン5へL召喚。Code MagicianでDotを墓地へ送り、DotをWickedのリンク先であるメインモンスターゾーン1へ帰還。
6. Wickedのコストで墓地のDormouseを除外し、Backupをサーチ。通常召喚していたDormouseの帰還は未使用なので、300LPで特殊召喚。
7. Backupを特殊召喚し、HareをサーチしてそのHareを捨てる。他の初期手札は使わない。
8. Dot＋BackupでI:Pをゾーン1へL召喚。
9. Wicked＋DormouseでWHITE BINDERをゾーン5へL召喚。墓地のHareを除外し、Hareの効果に300LPを払い、除外中のRabbitを手札へ回収。
10. WHITE BINDERで墓地のMTPを再セットする。

到達盤面はI:P、WHITE BINDER、MTP伏せ。手札Rabbit1枚、6800LP。MTPはこのターンに既に使用したため、この到達点から同ターン中にもう一度発動する想定ではない。

**配置と順番に制約がある。** WHITE BINDERのリンクマーカーは上・左・右で、EXゾーンから自分のメインモンスターゾーンへ下向きに伸びない。Wickedを先にWHITE BINDERへ変換すると、残ったDot＋BackupからI:Pを追加L召喚できない。検証済み手順はWickedがいる間にI:Pを先に作る。

この到達盤面からのI:PやMTPの相手ターン運用は別の選択になる。相手の行動に関係なく同じ妨害を機械的に使う手順にはしていない。

## 黄金櫃のRabbit先除外からの2分岐

1. 黄金櫃でRabbitを除外し、300LPで帰還。MTPをセット。
2. MTPでRabbitを除外し、Dormouseをサーチして通常召喚。
3. DormouseでCatを除外し、300LPで帰還。
4. DormouseをDecoderへ変換。Decoder＋CatでS:PをL召喚。
5. S:PのL召喚時効果で墓地のDormouseを除外し、未使用だった帰還効果で300LPを払って特殊召喚。

ここで止めるとS:P＋Dormouse、手札0、7100LP。さらに両方を素材としてWHITE BINDERをL召喚し、墓地除外の任意効果は使わず、MTPを墓地から再セットする分岐も実証した。こちらはWHITE BINDER＋MTP、手札0、7100LP。

UNDERGROUNDやテラ・フォーミングでも同じ2分岐を実証した。その場合はUNDERGROUNDが場に残る。したがって、Contract分岐で特定のEXカードや墓地送りを使えない場面の比較材料にもなる。ただし、その妨害後の状態自体は今回の無妨害テストとは別である。

**通常召喚Dormouse始動と黄金櫃始動の違いを無視しない。** Dormouseを通常召喚して始める経路では、MTPでDormouseを除外して帰還させ、Hareを手札に保持する手順が取れる。一方、この黄金櫃のRabbit先除外経路では、MTPをRabbitの再除外とDormouseの確保に既に使う。さらにRabbitの帰還も使用済み。Wickedのリンク先への追加特殊召喚を同じ頭数で再現することはできず、強いDormouse始動手順をそのまま接ぎ木できない。黄金櫃でDormouseを先に除外した場合も、今度はDormouseの帰還を序盤に使用する点が異なる。

黄金櫃自身は解決後に墓地へ行くため、場に残るUNDERGROUNDをContractのコストにする分岐とも同一ではない。他の手札魔法を足せば別条件となり、今回の純粋な1枚初動には含めない。

## Dormouseを最初に除外する分岐

黄金櫃・UNDERGROUND・テラ・フォーミングの各始動で、Dormouseを先に除外する場合も次の分岐を実証した。

1. Dormouseを除外し、300LPで帰還。その効果でRabbitを除外し、300LPで帰還してMTPをセット。
2. MTPのコストでRabbitを除外し、Catをサーチして通常召喚する。
3. 黄金櫃のS:P分岐ではCatをDecoderへ変換し、Decoder＋DormouseでS:Pを出す。S:Pで墓地のCatを除外すると、通常召喚したCatの帰還は未使用なので300LPで戻せる。S:P＋Cat、7100LPになる。
4. さらにS:P＋CatをWHITE BINDERへ変換しMTPを再セットする分岐も、7100LPで到達する。
5. UNDERGROUNDが場にある場合はContract分岐に進める。Wickedのコストと後のWHITE BINDERの素材を、未使用の帰還を持つCatに置き換える。それ以外はRabbit先除外のContract線と同じで、I:P＋WHITE BINDER＋MTP＋手札Rabbit、6800LPに到達する。

このように、最初に帰還を使った下級と通常召喚した下級を記憶すれば、別の初回除外先でも同型の有用盤面へ接続できる。

## Rabbit→MTP→DormouseからHareを除外するAccord分岐

黄金櫃・UNDERGROUND・テラ・フォーミングのいずれからも、次のドローを使わない代替経路を実証した。

1. Rabbitを最初に除外して帰還し、MTPをセット・発動する。Rabbitを再除外してDormouseをサーチし、通常召喚。
2. DormouseでHareを除外し、300LPを払ってHare自身を手札へ回収。
3. DormouseをDecoderへ変換。Hareの手札効果で墓地のDormouseを除外し、Hareを特殊召喚。通常召喚したDormouseの帰還は未使用なので300LPで戻る。
4. Decoder・Dormouse・HareでWHITE BINDERをL召喚。攻撃力2300のサイバース族の素材になったDecoderも帰還する。
5. WHITE BINDERでTBをセット。TBのコストでWHITE BINDERを除外してCatをデッキから特殊召喚し、WHITE BINDERも900LPで帰還する。WHITE BINDERの任意ドローは辞退。
6. WHITE BINDERをリンク3、DecoderとCatを各1としてAccordをL召喚。Accordで墓地のWHITE BINDERをリンク先へ蘇生する。

最終盤面はAccord＋WHITE BINDER、手札0、6200LP。UNDERGROUND始動ではUNDERGROUNDも場に残る。S:P、Contract、Wicked、Backup、Code Magician、Dotを使わない。Accordの発動無効・除外は名称ターン1回であり、複数の素材があるから複数回使えるとは数えない。

TBの特殊召喚先をRabbitにすると、Rabbitの帰還はこのターン既に使用済みで、通常召喚Dormouseから始めた別ルートのような2度目のRabbit帰還・罠セットには接続できない。この経路はCatを呼び、効果を発動せずL素材にする。

## 初回除外先の全候補検査

| 始動 | 実coreが提示した候補 | 検査したカード名数 |
| --- | --- | --- |
| 黄金櫃 | 初手の黄金櫃を除いた山札39枚 | 25/25種類 |
| UNDERGROUND | デッキのM∀LICE13枚 | 8/8種類 |
| テラ・フォーミング→UNDERGROUND | 同じM∀LICE13枚 | 8/8種類 |

UNDERGROUND側の8種類は下級4種類、MTP・GWC・TB、もう1枚のUNDERGROUND。黄金櫃はこれらに加え、デッキ内の残りすべての種類を個別に除外して解決まで実行した。候補名・同名枚数・対応probe IDはJSONの `firstBanishCoverage` に保存している。同名の別コピーは初期状態に差がないためカード名単位で検査し、候補メニュー上の全コピー数も記録した。

| 最初に除外するカード | 実証した反応・継続 |
| --- | --- |
| Rabbit | 帰還→MTPセット。上記の有用展開へ接続 |
| Dormouse | 帰還→Rabbit除外。上記の有用展開へ接続 |
| Cat | 300LPで帰還するが、唯一の初手を使い切っているため除外するM∀LICE手札がない。Decoderへの変換後は追加展開できない |
| Hare | **除外された自身を対象に、300LPで自身を手札へ回収できる。** 通常召喚→Decoderまで実行。別のM∀LICE手札・墓地がなく、展開は伸びない |
| Dot（黄金櫃のみ） | 帰還→Decoderまで実行。墓地送り・除外の効果は同じターンにいずれか一方しか使えず、L素材で墓地へ行ってももう一度戻らない |
| その他 | 除外を起点に発動する展開効果はなく、手札0・自分モンスター0で解決。以後の召喚・特殊召喚・効果発動の選択肢がないことをassert |

Hareの回収対象には「他の」という制限がない。別の除外M∀LICEがないから発動できない、と判定するのは誤り。

## 闇の誘惑と未探索範囲

唯一の手札が闇の誘惑の場合、2枚ドローした後に闇属性がなければ手札を全て墓地へ送る。固定fixtureでは神の密告とTB－11を引くため、空盤面・手札0で終了した。これは通常対戦のドロー確率を測る試験ではなく、確定1枚初動ではないことを示す具体例である。別のM∀LICEを元から手札に持つ場合や、有利な2枚を引く場合は、追加手札・ドロー依存として扱う。

初回除外の全候補は検査済みだが、その後の全EX変換・全対象・全手順順序、任意ドロー後の全分岐、相手誘発への対応、相手ターンの妨害手順、別の初手4枚の活用は未網羅。保存した盤面を最強と断定せず、追加の検証対象として残す。

## 再現

```powershell
node duel-lab/scripts/research-spell-starters.mjs
```

`routes/spell-starters.json` に9種類の分類、25本のルートと41本のprobeの入力列・途中状態ハッシュ・盤面・LP・手札・実行ログを保存する。カード本文は複製せず、`data/cards.json` への参照とカードレコードのSHA-256を保存する。生成コマンド内で各到達盤面をassertし、ルート・probeすべてを独立にreplayする。`ROUTE_TRACE=1` を設定した場合のみ探索用の選択肢を標準出力へ出す。Astra CLIや別のモデルプロセスは起動しない。
