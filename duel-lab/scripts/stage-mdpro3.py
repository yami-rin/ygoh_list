"""Stage native runtime data beside the built MDPro3 executable."""
from pathlib import Path
import shutil
import os

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'runtime/MDPro3'
target = ROOT / 'runtime/MDPro3-client'
if not (target / 'MDPro3.exe').exists():
    raise SystemExit('Build MDPro3.exe before staging its data')

def link_or_copy(src, dst):
    src, dst = Path(src), Path(dst)
    if dst.exists():
        if os.path.samefile(src, dst):
            return str(dst)
        dst.unlink()
    try:
        os.link(src, dst)
    except OSError:
        shutil.copyfile(src, dst)
    return str(dst)

for folder in ['Data', 'Deck', 'Picture', 'Expansions', 'Puzzle', 'Replay']:
    if not (source / folder).exists():
        continue
    def copy_data(src, dst):
        path = Path(dst)
        # Keep the user's selected settings, decks and replays on subsequent builds.
        if path.exists() and (folder in ['Deck', 'Replay'] or path.name == 'config.conf'):
            return str(dst)
        return shutil.copyfile(src, dst)
    shutil.copytree(source / folder, target / folder, dirs_exist_ok=True,
                    copy_function=link_or_copy if folder == 'Picture' else copy_data)
shutil.copytree(source / 'Platforms/StandaloneWindows64', target / 'MDPro3_Data/StandaloneWindows64',
                dirs_exist_ok=True, copy_function=link_or_copy)
print('Native client data staged at', target)
# Some upstream ygoserver binaries use the original YGOPro root-level path.
shutil.copyfile(source / 'Data/lflist.conf', target / 'lflist.conf')
