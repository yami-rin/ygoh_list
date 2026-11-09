# 友だち対戦セット

友だちにzipで渡すMDPro3一式の原本と、部屋主（このPC）の手順。

## 配布物を作る

```powershell
.venv/Scripts/python.exe scripts/build-friend-kit.py            # fetch-arts → assemble → zip
.venv/Scripts/python.exe scripts/build-friend-kit.py clean      # 大きな中間物（runtime/friend-kit-build）を消す
```

- 本体（exe・Unityランタイム・画面素材）は`runtime/MDPro3-client`から取る。Unityのライセンスが無いと作り直せないため。
  中のAstraフックは「Windbotデッキ`Astra`を`start-native.ps1`経由で起動した時」しか動かない。配布物にはそのbot枠・デッキ・起動器が無いので動かない。
  デバッグ情報（`*.pdb`・`*_DoNotShip`）は入れず、ウィンドウ題名は同じ長さのまま「MDPro3」へ戻す。
- Dataは固定コミットのupstream原本（`runtime/mdpro3-source.tar.gz`）。自作の禁止制限・AI用bot・FileGroupsの変更は入らない。
  `Data/config.conf`は日本語・プレイヤー名`Player`・接続先`127.0.0.1:7911`・壁紙と背景（同梱素材にある1番）だけ。`Data/hosts2.conf`の先頭に「部屋主 127.0.0.1 7911」を足す。
- カード画像はmycard/hd-arts（固定コミット、gitのblobハッシュで検証）。オリカはcustom/のDB・スクリプト（互換ブロック付き）・イラスト（JPEGへ変換）、新カードは`latest-ja.cdb`と対応スクリプト、デッキはオリカ中心のydkだけ。
- zipは`C:/Project/artifacts/card_manager_web/friend-kit/`へ。書く前に個人情報・秘密値・Astra関連の文字列検査を行い、許可リスト外が見つかれば作らない。

| ファイル | zip内 | 役割 |
| --- | --- | --- |
| `遊ぶ.bat` | `遊ぶ.bat` | `tools\play.ps1`を非表示で起動（ExecutionPolicy Bypass） |
| `play.ps1` | `tools\play.ps1` | 中継を起動→MDPro3を起動→終了時に中継を止める |
| `duel-bridge.ps1` | `tools\duel-bridge.ps1` | 127.0.0.1:7911をTLSで部屋主のTailscale Funnelへ中継 |
| `はじめに.txt` | `はじめに.txt` | 友だち向けの説明 |

## 部屋主の手順

1. Tailscaleを起動しておく。`tailscale funnel status`で`tcp://desktop-euas96s.tail26dd2a.ts.net:10000`が`localhost:7911`へ転送されていることを確認する。
2. 自分のMDPro3（`runtime/MDPro3-client/MDPro3.exe`）で「ネット対戦」→「LAN対戦」。リミットレギュレーションは友だちにもある「2026.7」など（「Astra OCG」は友だち側に無い）を選び「部屋を建てる」。ポート7911で建つこと（このPCで`遊ぶ.bat`を起動しない。7911が埋まると別ポートになり届かない）。
3. 友だちが入ったら両者「準備完了」→「ゲーム開始」。LANの部屋にパスワードは無い。Funnelのアドレスを知る人は誰でも入れるので、遊ぶ時だけ部屋を建てる。
