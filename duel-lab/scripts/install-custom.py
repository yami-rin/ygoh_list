"""Install original cards (custom/*.json, custom/scripts, custom/art) into the MDPro3 client.

Builds one card database per theme file into Expansions/, copies the Lua scripts into script/
and the artwork into Picture/Art/. Official files of the client are not modified.
Usage: python scripts/install-custom.py [client_dir]
"""
import json
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CUSTOM = ROOT / 'custom'
CLIENT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'runtime' / 'MDPro3-client'


def build_cdb(theme_file: Path, target: Path) -> int:
    cards = json.loads(theme_file.read_text(encoding='utf-8'))['cards']
    if target.exists():
        target.unlink()
    db = sqlite3.connect(target)
    db.execute('create table datas(id integer primary key,ot integer,alias integer,setcode integer,type integer,atk integer,def integer,level integer,race integer,attribute integer,category integer)')
    db.execute('create table texts(id integer primary key,name text,desc text,' + ','.join(f'str{i} text' for i in range(1, 17)) + ')')
    for c in cards:
        setcode = 0
        for i, code in enumerate(c['setcodes'][:4]):
            setcode |= code << (16 * i)
        link = c['type'] & 0x4000000
        db.execute('insert into datas values(?,?,?,?,?,?,?,?,?,?,?)', (
            c['code'], 3, c.get('alias', 0), setcode, c['type'], c['attack'],
            c['link_marker'] if link else c['defense'], c['level'], int(c['race']), c['attribute'], 0))
        strings = (c.get('strings') or []) + [''] * 16
        db.execute('insert into texts values(' + ','.join('?' * 19) + ')', (c['code'], c['name'], c['text'], *strings[:16]))
    db.commit()
    db.close()
    return len(cards)


def main():
    if not (CLIENT / 'MDPro3.exe').exists():
        sys.exit(f'MDPro3 client not found: {CLIENT}')
    (CLIENT / 'Expansions').mkdir(exist_ok=True)
    (CLIENT / 'script').mkdir(exist_ok=True)
    art_dir = CLIENT / 'Picture' / 'Art'
    art_dir.mkdir(parents=True, exist_ok=True)
    for theme in sorted(CUSTOM.glob('*.json')):
        count = build_cdb(theme, CLIENT / 'Expansions' / f'custom-{theme.stem}.cdb')
        print(f'{theme.name}: {count} cards')
    # The scripts are written for EDOPro (Duel Lab); MDPro3 runs the YGOPro API, so prepend the compatibility block.
    compat = (CUSTOM / 'scripts' / 'compat-mdpro3.lua').read_text(encoding='utf-8')
    scripts = sorted((CUSTOM / 'scripts').glob('c[0-9]*.lua'))
    for lua in scripts:
        (CLIENT / 'script' / lua.name).write_text(compat + '\n' + lua.read_text(encoding='utf-8'), encoding='utf-8')
    arts = sorted((CUSTOM / 'art').glob('[0-9]*.png'))
    for art in arts:
        shutil.copyfile(art, art_dir / art.name)
    print(f'{len(scripts)} scripts, {len(arts)} artworks installed into {CLIENT}')


if __name__ == '__main__':
    main()
