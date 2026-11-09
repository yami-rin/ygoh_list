"""Build the friend kit zip: default MDPro3 + original cards + launcher for online duels via the host's bridge.

Steps (default: all, in this order):
  fetch-arts    card art of mycard/hd-arts (pinned commit) -> runtime/friend-kit-build/hd-arts
  assemble      kit folder runtime/friend-kit-build/MDPro3-orika
  zip           C:/Project/artifacts/card_manager_web/friend-kit/MDPro3-orika-friend-<date>.zip + secret scan
  clean         delete the large intermediates (kit folder, art cache, upstream Data)

The player binaries come from runtime/MDPro3-client (build-native.ps1); a clean rebuild needs a Unity license.
Their Astra hooks only run for the Windbot deck "Astra" started through start-native.ps1; the kit removes that
bot entry, its deck and every other Astra file, takes Data from the pinned upstream archive and renames the
window title back to "MDPro3". Needs Pillow (duel-lab/.venv): .venv/Scripts/python.exe scripts/build-friend-kit.py
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import re
import shutil
import sys
import tarfile
import time
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'runtime'
WORK = RUNTIME / 'friend-kit-build'
HOST_CLIENT = RUNTIME / 'MDPro3-client'     # player binaries, latest-ja.cdb + scripts, original-card decks
PRISTINE = WORK / 'pristine'
ARTS = WORK / 'hd-arts'
KIT = WORK / 'MDPro3-orika'
KIT_SRC = ROOT / 'friend-kit'
OUT_DIR = Path('C:/Project/artifacts/card_manager_web/friend-kit')
OFFICIAL_PATCH = RUNTIME / 'mdpro3-1.4.6-patch.zip'   # official MDPro3 update package (Data/cards*.json)
HD_ARTS = {'project': 362, 'commit': 'cc8f64a55cf2eefec17a3a42c01e2941a97ac78d'}
API = 'https://code.moenext.com/api/v4/projects/'
DEFAULT_PORT = 7911
PLAYER_NAME = 'Player'
PLAYER_FILES = ['MDPro3.exe', 'UnityPlayer.dll', 'UnityCrashHandler64.exe', 'MonoBleedingEdge', 'D3D12', 'MDPro3_Data']
ASTRA_TITLE = b'MDPro3 - Astra Duel'
TITLE = b'MDPro3'.ljust(len(ASTRA_TITLE))   # same length keeps the serialized Unity data layout intact
# Personal or project-specific strings (regex, case-insensitive) that must not appear in the distributed files.
FORBIDDEN = [r'(?<![a-z])tofu(?![a-z])', 'wadopasu', r'yami-?rin', 'Astra ?Duel', 'Astra ?OCG', 'AstraDecision',
             'AstraExecutor', 'AI_Astra', 'ASTRA_', 'Claude', 'anthropic', 'Opus 5', 'GPT-6', r'C:[\\/]+Users[\\/]',
             'card_manager_web', 'duel-lab', 'tskey-', 'MyCardToken->', 'DISCORD_', 'secrets\\.env',
             'tail26dd2a', 'desktop-euas96s', 'gmail\\.com']
# Explained occurrences (pattern regex, path regex, reason); anything else stops the zip.
KNOWN = [
    ('tail26dd2a|desktop-euas96s', r'^tools/duel-bridge\.ps1$', "the bridge must name the host's Funnel address"),
    ('tofu', r'\.(jpg|zip)$|^MDPro3_Data/StandaloneWindows64/', 'chance byte match inside compressed upstream data'),
    ('Astra|ASTRA', r'^MDPro3_Data/(Managed/Assembly-CSharp\.dll|globalgamemanagers\.assets)$',
     'dormant Astra hook code compiled into the player (runs only for the bot deck "Astra" via start-native.ps1)'),
    ('card_manager_web|duel-lab', r'^MDPro3_Data/(Managed/[^/]+\.dll|resources\.assets)$',
     'build folder path (no user name) in PE debug directories and a shader include path'),
]


def log(*args):
    print(*args, flush=True)


# ---------------------------------------------------------------- fetch-arts
def http_get(url, retries=4):
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=120) as response:
                return response.read(), response.headers
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2 + attempt * 3)


def list_arts():
    cache = WORK / f'hd-arts-{HD_ARTS["commit"][:8]}.json'
    if cache.exists():
        return json.loads(cache.read_text(encoding='utf-8'))
    entries, url = [], (f'{API}{HD_ARTS["project"]}/repository/tree?path=arts&per_page=100&pagination=keyset'
                        f'&order_by=path&ref={HD_ARTS["commit"]}')
    while url:
        body, headers = http_get(url)
        entries += [{'name': e['name'], 'sha1': e['id']} for e in json.loads(body) if e['type'] == 'blob']
        match = re.search(r'<([^>]+)>; rel="next"', headers.get('Link') or '')
        url = match[1] if match else None
    cache.write_text(json.dumps(entries), encoding='utf-8')
    return entries


def git_blob_sha1(data):
    return hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest()


def fetch_arts():
    ARTS.mkdir(parents=True, exist_ok=True)
    entries = [e for e in list_arts() if e['name'].lower().endswith('.jpg')]

    def fetch(entry):
        target = ARTS / entry['name']
        if target.exists():
            return 0
        path = urllib.parse.quote('arts/' + entry['name'], safe='')
        for _ in range(3):
            data, _headers = http_get(f'{API}{HD_ARTS["project"]}/repository/files/{path}/raw?ref={HD_ARTS["commit"]}')
            if git_blob_sha1(data) == entry['sha1']:
                part = target.with_suffix('.part')
                part.write_bytes(data)
                part.replace(target)
                return len(data)
        raise RuntimeError('Integrity check failed: ' + entry['name'])

    done = 0
    with ThreadPoolExecutor(max_workers=12) as pool:
        for index, _size in enumerate(pool.map(fetch, entries), 1):
            done = index
            if index % 1000 == 0:
                log(f'arts {index}/{len(entries)}')
    log(f'hd-arts {HD_ARTS["commit"][:10]}: {done} files in {ARTS}')


# ---------------------------------------------------------------- upstream Data
def extract_pristine():
    """Data/ of the pinned upstream MDPro3 commit (setup-native.py verified the archive when downloading it)."""
    marker = PRISTINE / '.complete'
    if marker.exists():
        return
    with tarfile.open(RUNTIME / 'mdpro3-source.tar.gz') as archive:
        for member in archive:
            relative = '/'.join(member.name.split('/')[1:])
            if not member.isfile() or not relative.startswith('Data/'):
                continue
            destination = (PRISTINE / relative).resolve()
            if PRISTINE.resolve() not in destination.parents:
                raise RuntimeError('Unsafe archive path')
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(member) as stream:
                destination.write_bytes(stream.read())
    marker.write_text('ok', encoding='utf-8')


def copy_player():
    """Engine files of the built client; no debug symbols, burst debug info, logs or user data."""
    for name in PLAYER_FILES:
        source = HOST_CLIENT / name
        if source.is_dir():
            shutil.copytree(source, KIT / name, copy_function=link_or_copy,
                            ignore=shutil.ignore_patterns('*.pdb', '*.log'))
        else:
            link_or_copy(source, KIT / name)
    for name in ['MDPro3_Data/globalgamemanagers', 'MDPro3_Data/app.info']:
        path = KIT / name
        data = path.read_bytes()
        if data.count(ASTRA_TITLE) != 1:
            raise RuntimeError(f'Unexpected title in {name}')
        path.unlink()  # hard link: never write through to the host client
        path.write_bytes(data.replace(ASTRA_TITLE, TITLE if name.endswith('globalgamemanagers') else b'MDPro3'))


# ---------------------------------------------------------------- assemble
def link_or_copy(src, dst):
    try:
        os.link(src, dst)
    except OSError:
        shutil.copyfile(src, dst)
    return dst


def load_install_custom():
    spec = importlib.util.spec_from_file_location('install_custom', ROOT / 'scripts/install-custom.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def custom_codes():
    codes = set()
    for theme in (ROOT / 'custom').glob('*.json'):
        codes |= {c['code'] for c in json.loads(theme.read_text(encoding='utf-8'))['cards']}
    return codes


def write_text(path, text, bom=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((b'\xef\xbb\xbf' if bom else b'') + text.replace('\r\n', '\n').replace('\n', '\r\n').encode('utf-8'))


def assemble():
    from PIL import Image  # Pillow from duel-lab/.venv
    import sqlite3

    if not (HOST_CLIENT / 'MDPro3.exe').exists():
        raise SystemExit('Build the client first (build-native.ps1)')
    extract_pristine()
    if KIT.exists():
        shutil.rmtree(KIT)
    KIT.mkdir(parents=True)
    copy_player()  # includes MDPro3_Data/StandaloneWindows64 (upstream mdpro3-assetbundles)

    # Data exactly as upstream (copied, so later edits never reach the cache), plus the card id tables of the
    # official release that the source archive lacks, and the join settings.
    shutil.copytree(PRISTINE / 'Data', KIT / 'Data')
    if OFFICIAL_PATCH.exists():
        with zipfile.ZipFile(OFFICIAL_PATCH) as patch:
            for name in ['Data/cards.json', 'Data/cards_Lite.json']:
                if not (KIT / name).exists():
                    (KIT / name).write_bytes(patch.read(name))
    shutil.copyfile(KIT / 'Data/lflist.conf', KIT / 'lflist.conf')  # ygoserver reads the root-level copy
    hosts = (PRISTINE / 'Data/hosts2.conf').read_text(encoding='utf-8-sig')
    write_text(KIT / 'Data/hosts2.conf', f'部屋主 127.0.0.1 {DEFAULT_PORT} \n' + hosts.replace('\r\n', '\n'))

    for folder in ['Deck', 'Expansions', 'Replay', 'Puzzle', 'script', 'Picture/Art', 'Picture/DIY', 'Picture/Closeup']:
        (KIT / folder).mkdir(parents=True, exist_ok=True)

    install = load_install_custom()
    for theme in sorted((ROOT / 'custom').glob('*.json')):
        install.build_cdb(theme, KIT / 'Expansions' / f'custom-{theme.stem}.cdb')
    compat = (ROOT / 'custom/scripts/compat-mdpro3.lua').read_text(encoding='utf-8')
    custom_scripts = sorted((ROOT / 'custom/scripts').glob('c[0-9]*.lua'))
    for lua in custom_scripts:
        (KIT / 'script' / lua.name).write_text(compat + '\n' + lua.read_text(encoding='utf-8'), encoding='utf-8')

    # Cards released after the MDPro3 data (update-mdpro3-cards.py), so both sides know the same cards.
    latest = HOST_CLIENT / 'Expansions/latest-ja.cdb'
    latest_scripts = 0
    if latest.exists():
        shutil.copyfile(latest, KIT / 'Expansions/latest-ja.cdb')
        with sqlite3.connect(latest) as db:
            for (code,) in db.execute('select id from datas'):
                script = HOST_CLIENT / 'script' / f'c{code}.lua'
                if script.exists():
                    shutil.copyfile(script, KIT / 'script' / script.name)
                    latest_scripts += 1

    arts = 0
    for art in sorted(ARTS.glob('*.jpg')):
        link_or_copy(art, KIT / 'Picture/Art' / art.name)
        arts += 1
    for art in sorted((RUNTIME / 'native-assets/Picture/Art').glob('*.jpg')):
        if not (KIT / 'Picture/Art' / art.name).exists():
            link_or_copy(art, KIT / 'Picture/Art' / art.name)
    # MDPro3 reads .jpg illustrations by default; convert instead of changing FileGroups.json.
    custom_arts = sorted((ROOT / 'custom/art').glob('[0-9]*.png'))
    for art in custom_arts:
        with Image.open(art) as image:
            image.convert('RGB').save(KIT / 'Picture/Art' / (art.stem + '.jpg'), quality=92)
    for diy in (RUNTIME / 'native-assets/Picture/DIY').glob('*'):
        link_or_copy(diy, KIT / 'Picture/DIY' / diy.name)

    codes = custom_codes()
    decks = []
    for ydk in sorted((HOST_CLIENT / 'Deck').glob('*.ydk')):
        lines = ydk.read_text(encoding='utf-8-sig').replace('\r\n', '\n').split('\n')
        ids = [int(line) for line in lines if line.strip().isdigit()]
        if ids and sum(i in codes for i in ids) * 2 >= len(ids):
            body = [line for line in lines if not line.startswith('#created')]
            write_text(KIT / 'Deck' / ydk.name, '#created by MDPro3\n' + '\n'.join(body).strip('\n') + '\n')
            decks.append(ydk.stem)

    config = [
        'Language->ja-JP',
        'CardLanguage->ja-JP',
        f'DuelPlayerName0->{PLAYER_NAME}',
        'Host->127.0.0.1',
        f'Port->{DEFAULT_PORT}',
        'Password->@ui',
        # The staged asset bundles hold only the first menu wallpaper (Back0001); the defaults pick missing ones.
        'Wallpaper->1130001',
        'Background->1',
    ]
    if decks:
        config.append(f'DeckInUse->{decks[0]}')
    write_text(KIT / 'Data/config.conf', '\n'.join(config) + '\n')

    shutil.copyfile(KIT_SRC / '遊ぶ.bat', KIT / '遊ぶ.bat')
    shutil.copyfile(KIT_SRC / 'はじめに.txt', KIT / 'はじめに.txt')
    (KIT / 'tools').mkdir()
    shutil.copyfile(KIT_SRC / 'play.ps1', KIT / 'tools/play.ps1')
    shutil.copyfile(KIT_SRC / 'duel-bridge.ps1', KIT / 'tools/duel-bridge.ps1')
    log(f'Kit assembled at {KIT}: {arts} hd-arts, {len(custom_arts)} original arts, '
        f'{len(custom_scripts)} original scripts, {latest_scripts} latest scripts, decks {decks}')


# ---------------------------------------------------------------- zip
STORED = {'.jpg', '.png', '.ogg', '.mp4', '.zip', '.bundle', '.ypk', '.resS'}


def scan(root):
    """Byte search (UTF-8 and UTF-16LE, case-insensitive) for personal or project strings."""
    findings = []
    patterns = [(word, re.compile(word, re.I)) for word in FORBIDDEN]
    media = {'.jpg', '.png', '.ogg', '.mp4'}
    for path in sorted(root.rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        for word, pattern in patterns:
            if pattern.search(relative):
                findings.append((word, relative, 'path'))
        data = path.read_bytes()
        texts = [data.decode('utf-8', errors='ignore')]
        if path.suffix.lower() not in media and len(data) < 64 << 20:
            # UTF-16LE strings (e.g. .NET string literals) at either byte alignment.
            texts += [data[offset:].decode('utf-16-le', errors='ignore') for offset in (0, 1)]
        for word, pattern in patterns:
            if any(pattern.search(text) for text in texts):
                findings.append((word, relative, 'content'))
    return sorted(set(findings))


def explain(finding):
    word, relative, _where = finding
    for word_rule, path_rule, reason in KNOWN:
        if re.search(word_rule, word) and re.search(path_rule, relative):
            return reason
    return None


def make_zip():
    findings = scan(KIT)
    known = {}
    for finding in findings:
        reason = explain(finding)
        if reason:
            known.setdefault(reason, []).append(finding[1])
        else:
            log('FOUND', *finding)
    for reason, paths in known.items():
        log(f'known ({len(paths)} files): {reason}')
    if len(findings) > sum(len(paths) for paths in known.values()):
        raise SystemExit('Secret/personal string scan failed; zip not written')
    log('Scan clean:', len(FORBIDDEN), 'patterns, no unexplained occurrences')
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUT_DIR / f'MDPro3-orika-friend-{date.today():%Y%m%d}.zip'
    partial = target.with_suffix('.zip.part')
    with zipfile.ZipFile(partial, 'w', allowZip64=True) as archive:
        for path in sorted(KIT.rglob('*')):
            name = 'MDPro3-orika/' + path.relative_to(KIT).as_posix()
            if path.is_dir():
                if not any(path.iterdir()):
                    archive.writestr(name + '/', b'')
                continue
            stored = path.suffix in STORED or path.stat().st_size > 64 << 20 and 'StandaloneWindows64' in name
            archive.write(path, name, zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED, None if stored else 6)
    partial.replace(target)
    log(f'Wrote {target} ({target.stat().st_size / 2**30:.2f} GiB)')
    return target


def clean():
    if WORK.exists():
        shutil.rmtree(WORK)
        log('Removed', WORK)


STEPS = {'fetch-arts': fetch_arts, 'assemble': assemble, 'zip': make_zip, 'clean': clean}

if __name__ == '__main__':
    selected = sys.argv[1:] or ['fetch-arts', 'assemble', 'zip']
    unknown = [step for step in selected if step not in STEPS]
    if unknown:
        raise SystemExit(f'Unknown step {unknown}; choose from {list(STEPS)}')
    for step in selected:
        if step != 'clean':
            WORK.mkdir(parents=True, exist_ok=True)
        STEPS[step]()
