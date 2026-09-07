"""Read-only Unity extraction. Run with the local venv containing UnityPy."""
import argparse
import json
from pathlib import Path
import re
import UnityPy

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--game', default='C:/Program Files (x86)/Steam/steamapps/common/Yu-Gi-Oh!  Master Duel')
args = parser.parse_args()
game = Path(args.game)
out = ROOT / 'data/images'
out.mkdir(parents=True, exist_ok=True)
cards = json.loads((ROOT / 'data/cards.json').read_text(encoding='utf-8'))
ids = {str(c['cid']) for c in cards.values() if c['cid']}
manifest_path = ROOT / 'data/images.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
files = []
for folder in [game/'LocalData', game/'masterduel_Data/StreamingAssets/AssetBundle']:
    if folder.exists():
        files.extend(p for p in folder.rglob('*') if p.is_file())
count = errors = 0
for n, path in enumerate(files):
    try:
        with path.open('rb') as f:
            if not f.read(8).startswith(b'UnityFS'):
                continue
        env = UnityPy.load(str(path))
        # Container paths identify genuine card illustrations and their official IDs.
        for name, ptr in env.container.items():
            match = re.search(r'card/images/illust/(common|ocg|tcg)/(?:\d+/)?(\d+)(?:\.\w+)?$', name, re.I)
            if not match or match[2] not in ids:
                continue
            cid, region = match[2], match[1].lower()
            if cid in manifest and (manifest[cid]['region'] == 'ocg' or region != 'ocg'):
                continue
            obj = ptr.read()
            if not hasattr(obj, 'image'):
                continue
            obj.image.save(out / f'{cid}.png')
            manifest[cid] = {'source':'Master Duel local assets', 'region':region}
            count += 1
        del env
    except Exception:
        errors += 1
    if n % 500 == 0:
        manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
        print(f'{n}/{len(files)} bundles, extracted {len(manifest)}, unreadable {errors}', flush=True)
manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
print(f'Complete: {len(manifest)} illustrations, {errors} unreadable files', flush=True)
