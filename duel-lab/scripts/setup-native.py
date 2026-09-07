"""Fetch pinned MDPro3 sources/assets and prepare the local Astra client build."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import shutil
import subprocess
import sys
import tarfile
import requests

ROOT = Path(__file__).resolve().parents[1]
runtime = ROOT / 'runtime'
runtime.mkdir(exist_ok=True)
lock = json.loads((ROOT / 'native-sources.lock.json').read_text(encoding='utf-8'))

def digest(path, algorithm='sha256'):
    if algorithm == 'tar-tree':
        records = []
        with tarfile.open(path) as archive:
            for member in archive:
                if member.isfile():
                    with archive.extractfile(member) as stream:
                        sha = hashlib.file_digest(stream, 'sha256').hexdigest()
                    records.append('/'.join(Path(member.name).parts[1:]) + '\0' + sha)
        return hashlib.sha256('\n'.join(sorted(records)).encode()).hexdigest()
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()

def download(url, path, expected, algorithm='sha256'):
    if path.exists() and digest(path, algorithm) == expected:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.part')
    print('Downloading', path.name, flush=True)
    with requests.get(url, stream=True, timeout=120) as response:
        response.raise_for_status()
        with temporary.open('wb') as output:
            for chunk in response.iter_content(1024 * 1024):
                output.write(chunk)
    if digest(temporary, algorithm) != expected:
        raise RuntimeError(f'Integrity check failed: {path.name}')
    temporary.replace(path)

source = runtime / 'MDPro3'
revision = lock['mdpro3']['commit']
if not (source / 'Assets/Scripts/Windbot/Game/GameAI.cs').exists():
    archive = runtime / 'mdpro3-source.tar.gz'
    download(f'https://code.moenext.com/api/v4/projects/8324/repository/archive.tar.gz?sha={revision}',
             archive, lock['mdpro3']['archiveTreeSha256'], 'tar-tree')
    with tarfile.open(archive) as contents:
        for member in contents:
            destination = (source / Path(*Path(member.name).parts[1:])).resolve()
            if destination != source.resolve() and source.resolve() not in destination.parents:
                raise RuntimeError('Unsafe archive path')
            if member.isdir():
                destination.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                destination.parent.mkdir(parents=True, exist_ok=True)
                with contents.extractfile(member) as input_file, destination.open('wb') as output:
                    shutil.copyfileobj(input_file, output)

def asset_download(entry):
    project, revision, remote, local, sha = entry
    url = f'https://code.moenext.com/api/v4/projects/{project}/repository/files/'
    url += requests.utils.quote(remote, safe='') + '/raw?ref=' + revision
    download(url, runtime / 'native-assets' / local, sha)

entries = []
for asset in lock.get('interfaceImages', {}).get('files', []):
    group = lock['interfaceImages']
    entries.append((group['project'], group['commit'], asset['path'], asset['path'], asset['sha256']))
for asset in lock['assets']['files']:
    prefix = 'StandaloneWindows64/MasterDuel/'
    entries.append((lock['assets']['project'], lock['assets']['commit'], prefix + asset['path'],
                    prefix + asset['path'], asset['sha256']))
for asset in lock['missingCardArt']['files']:
    entries.append((lock['missingCardArt']['project'], lock['missingCardArt']['commit'], asset['file'],
                    'Picture/Art/' + Path(asset['file']).name, asset['sha256']))
list(ThreadPoolExecutor(max_workers=4).map(asset_download, entries))

editor = runtime / 'unity-6000.0.24/Editor/Unity.exe'
if not editor.exists():
    installer = runtime / 'UnitySetup64-6000.0.24f1.exe'
    download('https://download.unity3d.com/download_unity/11fa355cd605/Windows64EditorInstaller/' + installer.name,
             installer, lock['unity']['installerMd5'], 'md5')
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    subprocess.run([str(installer), '/S', '/D=' + str(editor.parents[1])], startupinfo=startup, check=True)
    if not editor.exists():
        raise RuntimeError('Unity installation did not finish')

ai = source / 'Assets/Scripts/Windbot/Game/GameAI.cs'
subprocess.run([sys.executable, str(ROOT / 'scripts/patch-mdpro3.py'), str(source)], check=True)
shutil.copyfile(ROOT / 'native/AstraDecisionBridge.cs', ai.parent / 'AstraDecisionBridge.cs')
# Unity's Mono player lacks the framework's configuration-based serializer types.
dialogs = ai.parent / 'AI/Dialogs.cs'
dialog_text = dialogs.read_text(encoding='utf-8-sig')
dialog_text = dialog_text.replace('DialogsData data = (DialogsData)serializer.ReadObject(fs);',
    'DialogsData data = Newtonsoft.Json.JsonConvert.DeserializeObject<DialogsData>(new StreamReader(fs).ReadToEnd());')
dialogs.write_text(dialog_text, encoding='utf-8')
program = source / 'Assets/Scripts/MDPro3/Game/Program.cs'
program.write_text(program.read_text(encoding='utf-8-sig').replace('_ = Initialize();', 'Initialize().Forget();'), encoding='utf-8')
(source / 'Assets/Editor').mkdir(exist_ok=True)
shutil.copyfile(ROOT / 'native/BuildAstra.cs', source / 'Assets/Editor/BuildAstra.cs')
subprocess.run([sys.executable, str(ROOT / 'scripts/prepare-mdpro3.py')], check=True)
print('Ready. Build with native/BuildAstra.cs using', editor)
