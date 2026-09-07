"""Apply the Astra adapter to the pinned, disposable MDPro3 source tree."""
from pathlib import Path
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
TARGET = Path(sys.argv[1]).resolve()
if ROOT / 'runtime' not in TARGET.parents:
    raise SystemExit('Target must be the disposable duel-lab/runtime checkout')

game = TARGET / 'Assets/Scripts/Windbot/Game'
ai_path = game / 'GameAI.cs'
ai = ai_path.read_text(encoding='utf-8-sig')
if 'AstraDecisionBridge Astra' in ai:
    raise SystemExit('Already patched; rebuild from the pinned source to update')

def hook(name, code):
    global ai
    pattern = r'(public (?:virtual )?[^\n]+ ' + name + r'\([^)]*\)\s*\{)'
    ai, count = re.subn(pattern, lambda m: m[1] + '\n            if (Astra != null) ' + code, ai)
    if count != 1:
        raise RuntimeError(f'Expected one method {name}, found {count}')

ai = ai.replace('private Dialogs _dialogs;', 'public AstraDecisionBridge Astra { get; set; }\n\n        private Dialogs _dialogs;')
hook('OnSelectIdleCmd', 'return Astra.Main(main);')
hook('OnSelectBattleCmd', 'return Astra.Battle(battle);')
hook('OnSelectCard', 'return Astra.SelectCards(cards, min, max, hint, cancelable);')
hook('OnSelectChain', 'return Astra.Chain(cards, descs, forces);')
hook('OnSelectEffectYn', 'return Astra.Effect(card, desc);')
hook('OnSelectOption', 'return Astra.Option("効果の選択", options);')
hook('OnSelectPlace', 'return Astra.Place(cardId, player, location, available);')
hook('OnSelectPosition', 'return positions[Astra.Single("表示形式", positions.Select(p => (object)new { code = cardId, position = p.ToString() }).ToList())];')
hook('OnSelectSum', 'return Astra.SelectCards(cards, min, max, hint, false, false, sum, mode);')
hook('OnSelectTribute', 'return Astra.SelectCards(cards, min, max, hint, cancelable);')
hook('OnSelectYesNo', 'return Astra.YesNo("はい／いいえ", new { description = desc });')
hook('OnSelectBattleReplay', 'return Astra.YesNo("攻撃を続けるか", null);')
hook('OnSelectHand', 'return Astra.YesNo("先攻を選ぶか", null);')
hook('OnAnnounceNumber', 'return Astra.Single("数値を宣言", numbers.Select(n => (object)n).ToList());')
hook('OnCardSorting', 'return Astra.SelectCards(cards, cards.Count, cards.Count, 0, false, true);')
hook('OnSelectCounter', 'return Astra.Counters(type, quantity, cards, counters);')
hook('OnAnnounceAttrib', 'return Astra.Values(attributes, count, "属性を宣言");')
hook('OnAnnounceRace', 'return Astra.Values(races, count, "種族を宣言");')
hook('OnAnnounceCard', 'return avail[Astra.Single("カードを宣言", avail.Select(n => (object)new { cardId = n, name = YGOSharp.OCGWrapper.NamedCard.Get(n).Name }).ToList())];')
ai_path.write_text(ai, encoding='utf-8', newline='\r\n')

behavior_path = game / 'GameBehavior.cs'
behavior = behavior_path.read_text(encoding='utf-8-sig')
anchor = 'Deck = Deck.Load(Game.DeckFile ?? _ai.Executor.Deck);'
assert behavior.count(anchor) == 1
behavior = behavior.replace(anchor, anchor + '''
            if (Game.Deck == "Astra")
            {
                string bridgeFile = Environment.GetEnvironmentVariable("ASTRA_BRIDGE_CONFIG");
                if (string.IsNullOrEmpty(bridgeFile) || Deck == null)
                    throw new InvalidOperationException("Start MDPro3 through the Astra launcher.");
                _ai.Astra = new AstraDecisionBridge(_duel, Deck, bridgeFile);
            }''')
behavior_path.write_text(behavior, encoding='utf-8', newline='\r\n')
shutil.copyfile(ROOT / 'native/AstraDecisionBridge.cs', game / 'AstraDecisionBridge.cs')
executor = game / 'AI/Decks/AstraExecutor.cs'
executor.write_text('''using WindBot.Game;
namespace WindBot.Game.AI.Decks
{
    [Deck("Astra", "AI_Astra", "Test")]
    public class AstraExecutor : DefaultExecutor
    {
        public AstraExecutor(GameAI ai, Duel duel) : base(ai, duel) { }
    }
}
''', encoding='utf-8', newline='\r\n')

solo_path = TARGET / 'Assets/Scripts/MDPro3/Servant/SoloSelector.cs'
solo = solo_path.read_text(encoding='utf-8-sig')
anchor = 'string args = port + " -1 5 0 F "'
assert solo.count(anchor) == 1
solo = solo.replace(anchor, '''bool astraDuel = command.Split(' ').Contains("Deck=Astra");
            if (astraDuel) { noCheck = false; noShuffle = false; }
            string args = port + (astraDuel ? " 0 5 0 F " : " -1 5 0 F ")''')
if 'using System.Linq;' not in solo:
    solo = 'using System.Linq;\n' + solo
solo_path.write_text(solo, encoding='utf-8', newline='\r\n')
print('Applied Astra hooks to', TARGET)
