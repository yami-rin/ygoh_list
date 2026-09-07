"""取得済みHTMLで補完CLIの全体動作を検証する（外部通信なし）。"""
import csv
import io
from pathlib import Path
import subprocess
import sys
import tempfile

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'fill_card_texts.py'

with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    master = root / 'master.csv'
    cache = root / 'cache'
    cache.mkdir()
    html = '''<div id="card_list">
      <div class="t_row"><input class="cid" value="1"><input class="cnm" value="通常">
      <dd class="box_card_text">説明&lt;br&gt;続き, &quot;引用&quot;</dd></div>
      <div class="t_row"><input class="cid" value="2"><input class="cnm" value="Ｐ">
      <span class="box_card_pen_effect">Ｐ効果<br>続き</span>
      <dd class="box_card_text">モンスター効果</dd></div>
      <div class="t_row"><input class="cid" value="3"><input class="cnm" value="既存">
      <dd class="box_card_text">新本文</dd></div>
    </div>'''
    page = cache / 'page-001.html'
    page.write_text(html, encoding='utf-8')
    initial = 'カードID,名前,レベル,カードテキスト\n1,通常,8,\n2,Ｐ,7,\n3,既存,1,保持する本文\n'.encode('utf-8-sig')
    master.write_bytes(initial)
    command = [sys.executable, str(SCRIPT), '--master', str(master), '--cache-dir', str(cache)]

    def run(*options):
        return subprocess.run(command + list(options), capture_output=True)

    assert run().returncode == 0
    assert master.read_bytes() == initial, '検証モードでCSVを変更した'
    result = run('--apply')
    assert result.returncode == 0, result.stderr
    rows = list(csv.DictReader(io.StringIO(master.read_text(encoding='utf-8-sig'))))
    assert rows[0]['カードテキスト'] == '説明 続き, "引用"'
    assert rows[1]['カードテキスト'] == '【ペンデュラム効果】Ｐ効果 続き 【カードテキスト】モンスター効果'
    assert rows[2]['カードテキスト'] == '保持する本文'
    assert [r['レベル'] for r in rows] == ['8', '7', '1']
    assert next(cache.glob('master-before-*.csv')).read_bytes() == initial
    filled = master.read_bytes()
    assert run('--apply').returncode == 0
    assert master.read_bytes() == filled, '再実行で結果が変化した'
    for invalid in [html.replace('value="通常"', 'value="別名"'),
                    html.replace('value="1"', 'value="99"'),
                    html.replace('モンスター効果', '')]:
        page.write_text(invalid, encoding='utf-8')
        assert run('--apply').returncode != 0, '照合不良で更新した'
        assert master.read_bytes() == filled
print('PASS: dry-run, ID/name matching, empty-source rejection, pendulum, CSV quoting, backup, preservation, rerun')
