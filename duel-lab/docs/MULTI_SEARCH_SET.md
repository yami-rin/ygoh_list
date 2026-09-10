# 固定Bystialのセット取消しを縮約する探索器 v5

2026-09-11。バルドレイク・マグナムートの深い保存履歴に残っていた、モンスターセットの選択→リリース選択で取消し、という2入力循環を扱う。通常召喚だけを対象にしたv4では、この循環が残っていた。

`scripts/search-kernel-set.mjs` と `scripts/search-multi-pairs-set.mjs` を明示的に使う場合だけ有効になる。v4、元checkpoint、カード資産、自動対戦の初動集は変更していない。公開盤面の一致による一般的な状態統合は行わない。

## 測定結果

凍結した2本のpending履歴を、それぞれv4/v5で5回ずつ、1nodeの同条件で再生した。

| 固定手札 | 保存された入力数 | v4の実再生入力数 | v5の実再生入力数 |
| --- | ---: | ---: | ---: |
| バルドレイク＋封印の黄金櫃 | 54 | 54 | 11 |
| マグナムート＋UNDERGROUND | 66 | 66 | 11 |

v5は最初の監査済み取消しを11入力目で検出し、その同じ循環を含む後続部分を実行しない。これは2本の保存履歴に対する入力実行数の比較であり、全探索の速度比・戦略的な網羅率・勝率を示さない。

さらに、元checkpointのコピー2組を実際のCLIで移行・再開した。各回は最大1000node/15秒の範囲。

| pair | 未解決prefixの変化 | 検出したセット取消し | 無ドロー範囲 |
| --- | --- | ---: | --- |
| 288 | 343 → 203 | 184 | 未完 |
| 210 | 362 → 270 | 231 | 未完 |

元の2ファイルはSHA-256が不変。移行先の保存winnerは、未知ドローを越えないことも含めて全入力を独立再生した。詳細なハッシュと測定値は [検証記録](evidence/monster-set-cancel-20260911.json)。このv5の2組と、別のv4夜間探索の30組を同じ探索版として合計しない。

## 縮約する条件

すべて満たした、隣り合う2入力だけを扱う。

1. 固定core・preset・Lua・wrapperが監査済みpinと一致する。
2. 初期手札の唯一のバルドレイクまたはマグナムートで、実MOVE履歴上、一度も手札の外へ出ていない。曖昧な移動や盤面再読込などがあれば資格を失う。
3. 自分の先攻Main1、chainなしのIdleから、通常召喚（wire action 0）またはモンスターセット（wire action 3）を選ぶ。UIのchoice idとwire actionを混同しない。
4. 出力が `HINT_SELECTMSG(500)` と `SELECT_TRIBUTE` の2件だけ。取消可・min=max=1、自分の表側モンスター、release_param=1を実queryで照合する。
5. 次の入力が明示的な取消しで、出力は元と同じIdle1件だけ。入口・素材選択時・出口の全query、LP、phase、chain、logを照合し、出口pendingも入口と一致する。
6. 取引の入口が固定root内にある。rootより前、またはrootをまたぐ取消しは縮約しない。

実際にセットする枝、通常召喚する枝、リリース対象を選ぶ枝は残す。ドローを起こす入力は従来どおり境界として保存し、その結果の盤面を評価したり後続を探索したりしない。新しいpolicy/versionと `cancelledMonsterSet` の独立カウンターを用いる。

## 固定coreで確認した境界

対象はWASM SHA-256 `68e0ddde6932df1dc9de39e6eff8afae10a5db0f18ea8a0870a6b7eb80073ea8`、core commit `46779fbe40e6a9bd8967f5dc6a03f4eaa6550d57`。[対応関係の既存監査](MULTI_SEARCH_DEPTH_AUDIT.md)も参照。

[MonsterSet処理](https://github.com/edo9300/ygopro-core/blob/46779fbe40e6a9bd8967f5dc6a03f4eaa6550d57/operations.cpp#L2432)の素材選択後、case 4の取消判定でreturnする。MSET_COSTのoperation、リリース、セットの回数消費、カード移動、SETイベントはその後にある。

一方、取消し前の2472行には `material_cards.clear()` がある。このため、場へ出た後に手札へ戻った個体まで対象を広げられない。初期から未移動の個体の材料履歴が空である条件を保持する。

内部の選択用集合や `summon_cancelable` まで全byte不変とは主張しない。[field.cpp](https://github.com/edo9300/ygopro-core/blob/46779fbe40e6a9bd8967f5dc6a03f4eaa6550d57/field.cpp)のリリース候補・セット可否・使用可能zoneと、[libduel.cpp](https://github.com/edo9300/ygopro-core/blob/46779fbe40e6a9bd8967f5dc6a03f4eaa6550d57/libduel.cpp)の召喚手順入口を確認し、当該固定カード群で旧scratch値を効果条件として使わない範囲に限定した。

今回再照合したのはC++6本、カードLua41本、helper26本、凍結snapshot2本。セット固有のproc/cost/count、リリース修飾、強制zone、効果コピー、材料・operated groupの読出しも対象に含む。Code of Soulの `SetMaterial` はSalamangreatのEX手順に付与されるもので、初期手札の対象Bystialの標準セットには使われない。単純な文字列scanだけで任意Luaの安全性を証明したとは扱わない。

## 検証

- 新規13テスト成功。2種×取消0/1/64回×セット成立/通常召喚の12実Duelで、同じ継続の全query・pending・log・rawイベントを照合。
- v4との非取消し部分木の一致、すべてのセット・召喚・素材選択枝の保持、固定root境界、分割再開と連続実行の一致を確認。
- 移動済み個体、曖昧なMOVE、余分なrawイベント、source pinの変化を拒否。pin変化のテストは読み取りを一時的に差し替え、実資産を変更していない。
- 通常召喚とセットの混在した取消しを短縮し、残したすべての入力を再生。旧版からの移行、draw境界・候補位置・履歴保持、再importで進捗が巻き戻らないことも確認。
- 旧v4へ同じ検査を向けると、セット取消し未検出の箇所で実際に失敗することを確認。v5では成功。
- プロジェクト全体の `node --test --test-concurrency=2 tests/*.test.mjs` は200件成功、失敗・skipなし（99.24秒）。Astraの制御テストは既存の偽CLIを使い、別の推論モデルは起動しない。

実装後の範囲も固定2枚・未知ドロー前・無干渉であり、MDPro3の自動入力が高速化したという測定ではない。

## 再開手順

作業ディレクトリは `C:\Project\card_manager_web\duel-lab`。元shardが停止していることを確認し、未使用の移行先を指定する。移行は元と移行先をlockし、元の検索履歴と候補位置を保持したコピーを作る。

```powershell
node scripts/search-multi-pairs-set.mjs --import-legacy --shard 0 --pair-indices 288 --legacy-root runtime/multi-pair-search-tribute --output-root runtime/multi-pair-search-set
node scripts/search-multi-pairs-set.mjs --shard 0 --pair-indices 288 --nodes-per-pair 1000 --ms-per-pair 15000 --depth 240 --passes 1 --output-root runtime/multi-pair-search-set
```

既にある移行先への再importは、同じ出典の継続結果を保持する。元や資産のハッシュが変わった場合は拒否する。v4/v5のsummaryやroutesを混ぜず、v5用のsource identityを保持する。全体レポート生成器の既定値や、自動対戦の初動集の読込先は切り替えていない。
