"""Add cards released after the MDPro3 build to the MDPro3 client (Japanese texts, YGOPro scripts).

MDPro3 runs the YGOPro (mycard) script API, so the EDOPro data used by Duel Lab cannot be copied. This takes
the cards present in data/japanese.cdb (mycard/ygopro-database ja-JP) but missing from the client's own
database, writes them to Expansions/latest-ja.cdb, and downloads only their scripts from
Fluorohydride/ygopro-scripts into script/. Existing cards and scripts of the client are not replaced.
Usage: python scripts/update-mdpro3-cards.py [scripts_revision]
"""
import json
import sqlite3
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
CLIENT = ROOT / 'runtime' / 'MDPro3-client'
SCRIPTS_REPO = 'Fluorohydride/ygopro-scripts'


def main():
    revision = sys.argv[1] if len(sys.argv) > 1 else requests.get(
        f'https://api.github.com/repos/{SCRIPTS_REPO}/commits/master', timeout=60).json()['sha']
    client_db = sqlite3.connect(CLIENT / 'Data' / 'locales' / 'ja-JP' / 'cards.cdb')
    known = {r[0] for r in client_db.execute('select id from datas')}
    latest = sqlite3.connect(ROOT / 'data' / 'japanese.cdb')
    ids = [r[0] for r in latest.execute('select id from datas order by id') if r[0] not in known]

    target = CLIENT / 'Expansions' / 'latest-ja.cdb'
    if target.exists():
        target.unlink()
    out = sqlite3.connect(target)
    for table in ('datas', 'texts'):
        schema = latest.execute('select sql from sqlite_master where name=?', (table,)).fetchone()[0]
        out.execute(schema)
        cols = len(latest.execute(f'select * from {table} limit 1').fetchone())
        rows = latest.execute(f'select * from {table} where id in ({",".join("?" * len(ids))})', ids).fetchall()
        out.executemany(f'insert into {table} values({",".join("?" * cols)})', rows)
    out.commit()

    script_dir = CLIENT / 'script'
    script_dir.mkdir(exist_ok=True)
    fetched, missing = [], []
    for cid in ids:
        alias = latest.execute('select alias from datas where id=?', (cid,)).fetchone()[0]
        if alias and alias in known:
            continue  # alternate artwork: uses the original card's script
        name = f'c{cid}.lua'
        if (script_dir / name).exists():
            continue
        r = requests.get(f'https://raw.githubusercontent.com/{SCRIPTS_REPO}/{revision}/{name}', timeout=60)
        if r.status_code == 200:
            (script_dir / name).write_bytes(r.content)
            fetched.append(cid)
        else:
            missing.append(cid)
    # Cards without a YGOPro script yet would play without effects: leave them out.
    if missing:
        marks = ','.join('?' * len(missing))
        for table in ('datas', 'texts'):
            out.execute(f'delete from {table} where id in ({marks})', missing)
        out.commit()
    (CLIENT / 'Expansions' / 'latest-ja.json').write_text(json.dumps(
        {'scripts': SCRIPTS_REPO, 'revision': revision, 'cards': ids, 'scriptsFetched': fetched, 'scriptsMissing': missing},
        ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(ids)} new cards, {len(fetched)} scripts fetched, {len(missing)} without script ({revision[:10]})')


if __name__ == '__main__':
    main()
