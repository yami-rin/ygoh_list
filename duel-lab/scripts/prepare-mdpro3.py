"""Prepare local MDPro3 data, full-card renderer inputs and the Astra preset."""
from pathlib import Path
import json
import os
import shutil
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'runtime/MDPro3'
assets = ROOT / 'runtime/native-assets'
cards = json.loads((ROOT / 'data/cards.json').read_text(encoding='utf-8'))
preset = json.loads((ROOT / 'preset.json').read_text(encoding='utf-8'))
limits = json.loads((ROOT / 'limits-202607.json').read_text(encoding='utf-8'))
def normalize(name):
    return ''.join(unicodedata.normalize('NFKC', name).split()).lower()
limits = {normalize(name): limit for name, limit in limits.items()}
shutil.copytree(assets / 'StandaloneWindows64', source / 'Platforms/StandaloneWindows64', dirs_exist_ok=True)

art = source / 'Picture/Art'
art.mkdir(parents=True, exist_ok=True)
copied = 0
for card in cards.values():
    image = ROOT / f'data/images/{card["cid"]}.png'
    target = art / f'{card["code"]}.png'
    if image.exists() and not target.exists():
        try:
            os.link(image, target)
        except OSError:
            shutil.copyfile(image, target)
        copied += 1
shutil.copytree(assets / 'Picture/Art', art, dirs_exist_ok=True)
if (assets / 'Picture/DIY').exists():
    shutil.copytree(assets / 'Picture/DIY', source / 'Picture/DIY', dirs_exist_ok=True)
# Master Duel's extracted illustrations are PNG; upstream defaults to JPEG only.
file_groups = source / 'Data/FileGroups.json'
groups = json.loads(file_groups.read_text(encoding='utf-8-sig')) if file_groups.exists() else {}
groups['CardIllust'] = {'Paths': ['Picture/Art/', 'art/'], 'Extensions': ['.jpg', '.png']}
file_groups.write_text(json.dumps(groups, ensure_ascii=False, indent=2), encoding='utf-8')
for directory in ['Deck', 'Expansions', 'Replay', 'Puzzle', 'Picture/DIY', 'Picture/Closeup']:
    (source / directory).mkdir(parents=True, exist_ok=True)

deck = '#created by Astra Duel\n#main\n' + '\n'.join(map(str, preset['main']))
deck += '\n#extra\n' + '\n'.join(map(str, preset['extra'])) + '\n!side\n'
for name in ['Deck/MALICE_202607.ydk', 'Data/Windbot/Decks/AI_Astra.ydk']:
    (source / name).write_text(deck, encoding='utf-8')

ban = ['# Official OCG July 2026 list; applied by Astra solo host index 0', '!Astra OCG 2026.07']
for card in sorted(cards.values(), key=lambda c: c['code']):
    # The native core ignores explicit quantity 3; omit it so client/server hashes agree.
    if normalize(card['name']) in limits and limits[normalize(card['name'])] < 3:
        ban.append(f'{card["code"]} {limits[normalize(card["name"])]} --{card["name"]}')
lf = source / 'Data/lflist.conf'
original = lf.read_text(encoding='utf-8-sig')
if '!Astra OCG 2026.07' in original:
    # Replace only our generated first block, retaining the upstream lists.
    original = original[original.index('!Astra OCG 2026.07') + len('!Astra OCG 2026.07'):]
    original = original[original.index('\n!') + 1:]
lf.write_text('\n'.join(ban) + '\n\n' + original, encoding='utf-8')

bot = '''!Astra — GPT-6
Name=Astra Deck=Astra Dialog=Ghoul.JP Chat=False
GPT-6 Astraが盤面と合法な選択肢を見て考えます。Codex接続が必要です。
SELECT_DECKFILE SUPPORT_MASTER_RULE_2020

'''
bot_file = source / 'Data/locales/ja-JP/bot.conf'
text = bot_file.read_text(encoding='utf-8-sig')
if 'Name=Astra Deck=Astra' not in text:
    bot_file.write_text(bot + text, encoding='utf-8')
config = source / 'Data/config.conf'
if not config.exists():
    config.write_text('Language->ja-JP\nCardLanguage->ja-JP\nDuelPlayerName0->YOU\nDeckInUse->MALICE_202607\nBackground->1\n', encoding='utf-8')
# Zero means a random background, including assets outside this local package.
config_text = config.read_text(encoding='utf-8-sig')
if 'Background->' not in config_text:
    config_text += '\nBackground->1\n'
else:
    config_text = config_text.replace('Background->0\n', 'Background->1\n')
config.write_text(config_text, encoding='utf-8')

# Native Cid2Ydk.Id2Ydk uses only cid and id. Reuse the local master mapping.
mapping = {str(c['cid']): {'cid': c['cid'], 'id': c['code']}
           for c in cards.values() if c.get('cid') and not c.get('alias')}
(source / 'Data/cards_Lite.json').write_text(json.dumps(mapping, ensure_ascii=False), encoding='utf-8')
print(f'Prepared MDPro3, {copied} local MD artwork links, OCG July 2026, Astra preset')
