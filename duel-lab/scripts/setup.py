"""Pinned local data preparation; requires requests."""
import csv
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import unicodedata
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)

def fetch(url):
    import requests
    r = requests.get(url, timeout=90)
    r.raise_for_status()
    return r.content

def norm(s):
    return ''.join(unicodedata.normalize('NFKC', s).split())

def prepare():
    manifest = {}
    wasm_url = 'https://jsr.io/@n1xx1/ocgcore-wasm/0.1.4/lib/ocgcore.sync.wasm'
    wasm = fetch(wasm_url)
    assert hashlib.sha256(wasm).hexdigest() == '68e0ddde6932df1dc9de39e6eff8afae10a5db0f18ea8a0870a6b7eb80073ea8', 'WASM integrity mismatch'
    (DATA / 'ocgcore.sync.wasm').write_bytes(wasm)
    manifest['ocgcore-wasm'] = {'version':'0.1.4','url':wasm_url,'sha256':hashlib.sha256(wasm).hexdigest()}
    for repo, branch, target in [('ProjectIgnis/BabelCDB','master','cards.cdb'), ('mycard/ygopro-database','master','japanese.cdb'), ('ProjectIgnis/CardScripts','master','scripts')]:
        lock_path = ROOT / 'sources.lock.json'
        lock = json.loads(lock_path.read_text()) if lock_path.exists() else {}
        sha = lock.get(repo, {}).get('revision') or json.loads(fetch(f'https://api.github.com/repos/{repo}/commits/{branch}'))['sha']
        url = f'https://codeload.github.com/{repo}/zip/{sha}' if target == 'scripts' else f'https://raw.githubusercontent.com/{repo}/{sha}/' + ('locales/ja-JP/cards.cdb' if target == 'japanese.cdb' else 'cards.cdb')
        payload = fetch(url)
        manifest[repo] = {'revision': sha, 'url': url, 'sha256': hashlib.sha256(payload).hexdigest()}
        if target == 'scripts':
            with zipfile.ZipFile(io.BytesIO(payload)) as z:
                for entry in z.infolist():
                    rel = Path(*Path(entry.filename).parts[1:])
                    if entry.is_dir() or '..' in rel.parts or rel.is_absolute():
                        continue
                    dest = DATA / 'scripts' / rel
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(z.read(entry))
        else:
            (DATA / target).write_bytes(payload)
        if target == 'japanese.cdb':
            (DATA / 'strings.conf').write_bytes(fetch(f'https://raw.githubusercontent.com/{repo}/{sha}/locales/ja-JP/strings.conf'))
    (DATA / 'sources.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    if not (ROOT / 'sources.lock.json').exists():
        (ROOT / 'sources.lock.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    generate()

def generate():
    with (ROOT.parent / 'yugioh_cards_master.csv').open(encoding='utf-8-sig') as f:
        master = {norm(r['名前']): r for r in csv.DictReader(f)}
    ja = sqlite3.connect(DATA / 'japanese.cdb')
    ja.row_factory = sqlite3.Row
    translations = {r['id']: dict(r) for r in ja.execute('select * from texts')}
    db = sqlite3.connect(DATA / 'cards.cdb')
    db.row_factory = sqlite3.Row
    cards = {}
    for r in db.execute('select datas.*,texts.name,texts.desc from datas join texts using(id)'):
        d = dict(r)
        t = translations.get(d['id'], {})
        display = t.get('name') or d['name']
        m = master.get(norm(display), {})
        sc = d['setcode'] & ((1 << 64) - 1)
        cards[d['id']] = {'code': d['id'], 'alias': d['alias'], 'setcodes': [(sc >> i) & 65535 for i in range(0,64,16) if (sc >> i) & 65535],
            'type': d['type'], 'level': d['level'] & 255, 'lscale': (d['level'] >> 24) & 255, 'rscale': (d['level'] >> 16) & 255,
            'race': str(d['race']), 'attribute': d['attribute'], 'attack': d['atk'], 'defense': 0 if d['type'] & 0x4000000 else d['def'],
            'link_marker': d['def'] if d['type'] & 0x4000000 else 0, 'name': m.get('名前', display), 'enName': d['name'],
            'text': m.get('カードテキスト') or t.get('desc') or d['desc'], 'strings': [t.get(f'str{i}', '') for i in range(1,17)],
            'cid': int(m['カードID']) if m.get('カードID','').isdigit() else None,
            'script': (DATA / 'scripts' / 'official' / f"c{d['alias'] or d['id']}.lua").exists() or bool(d['type'] & 0x10)}
    (DATA / 'cards.json').write_text(json.dumps(cards, ensure_ascii=False), encoding='utf-8')
    print(f'Prepared {len(cards)} cards; {sum(c["cid"] is not None for c in cards.values())} Japanese master matches')

if __name__ == '__main__':
    import sys
    generate() if '--generate-only' in sys.argv else prepare()
