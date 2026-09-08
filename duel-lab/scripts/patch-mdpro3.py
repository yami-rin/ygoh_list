"""Apply the Astra adapter to the pinned, disposable MDPro3 source tree."""
from pathlib import Path
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]


def patch_ai_tribute_subtype(source):
    source = source.replace('\r\n', '\n')
    signature = 'public IList<ClientCard> OnSelectTribute(IList<ClientCard> cards, int min, int max, int hint, bool cancelable)'
    prefix = signature + '\n        {\n            if (Astra != null) return Astra.SelectCards(cards, min, max, hint, cancelable'
    old = prefix + ');'
    new = prefix + ', false, -1, true, "SELECT_TRIBUTE");'
    if source.count(new) == 1:
        return source
    return _once(source, old, new, 'OnSelectTribute subtype')


def _method_span(source, name):
    matches = list(re.finditer(r'private void ' + re.escape(name) + r'\([^\n]*\)\s*\{', source))
    if len(matches) != 1:
        raise RuntimeError(f'Expected one GameBehavior method {name}, found {len(matches)}')
    start = matches[0].start()
    opening = source.index('{', matches[0].start())
    depth = 0
    for index in range(opening, len(source)):
        if source[index] == '{':
            depth += 1
        elif source[index] == '}':
            depth -= 1
            if depth == 0:
                return start, index + 1
    raise RuntimeError(f'Unclosed GameBehavior method {name}')


def _once(source, before, after, context):
    if source.count(before) != 1:
        raise RuntimeError(f'Native safety patch anchor changed: {context}')
    return source.replace(before, after, 1)


def patch_behavior_safety(source):
    """Pure, idempotent incremental update; existing base Astra hooks stay intact."""
    source = source.replace('\r\n', '\n')
    events = [
        ('OnStart', '_ai.OnStart();', 'ObserveDuelStart()'),
        ('OnDraw', '_ai.OnDraw(player);', 'ObserveDraw(player, count)'),
        ('OnNewTurn', '_ai.OnNewTurn();', 'ObserveTurn()'),
        ('OnChaining', '_ai.OnChaining(card, cc);', 'ObserveChaining(cc)'),
        ('OnChainNegated', '_duel.NegatedChainIndexList.Add(chainIndex);', 'ObserveNegation()'),
        ('OnChainDisabled', '_duel.NegatedChainIndexList.Add(chainIndex);', 'ObserveNegation()'),
    ]
    for method, anchor, observe in events:
        start, end = _method_span(source, method)
        body = source[start:end]
        marker = f'// ASTRA_SAFETY_V2: {method}'
        replacement = marker + '\n            if (_ai.Astra != null) _ai.Astra.' + observe + ';\n            ' + anchor
        if marker in body:
            if replacement not in body:
                raise RuntimeError(f'Native safety marker does not match its hook: {method}')
        else:
            body = _once(body, anchor, replacement, method)
        source = source[:start] + body + source[end:]

    method = 'InternalOnSelectUnselectCard'
    start, end = _method_span(source, method)
    body = source[start:end]
    marker = '// ASTRA_SAFETY_V2: select-unselect-wire-context'
    old_flag = 'bool cancelable = packet.ReadByte() != 0 || finishable;'
    new_flag = marker + '\n            bool astraWireCancelable = packet.ReadByte() != 0;\n            bool cancelable = astraWireCancelable || finishable;'
    old_select = 'IList<ClientCard> selected = func(cards, (finishable ? 0 : 1), 1, _select_hint, cancelable);'
    new_select = '''IList<ClientCard> selected;
            if (_ai.Astra != null)
                _ai.Astra.SetSelectionContext("SELECT_UNSELECT_CARD", finishable, astraWireCancelable, count, count2);
            try
            {
                selected = func(cards, (finishable ? 0 : 1), 1, _select_hint, cancelable);
            }
            finally
            {
                if (_ai.Astra != null) _ai.Astra.ClearSelectionContext();
            }'''
    if marker in body:
        if new_flag not in body or new_select not in body:
            raise RuntimeError('Native safety marker does not match select/unselect context')
    else:
        body = _once(body, old_flag, new_flag, method + ' flags')
        body = _once(body, old_select, new_select, method + ' callback')
    return source[:start] + body + source[end:]


def apply_safety_patch(target):
    target = Path(target).resolve()
    if (ROOT / 'runtime').resolve() not in target.parents:
        raise RuntimeError('Target must be the disposable duel-lab/runtime checkout')
    game = target / 'Assets/Scripts/Windbot/Game'
    behavior = game / 'GameBehavior.cs'
    before = behavior.read_text(encoding='utf-8-sig')
    after = patch_behavior_safety(before)
    if after != before:
        behavior.write_text(after, encoding='utf-8', newline='\r\n')
    shutil.copyfile(ROOT / 'native/AstraDecisionBridge.cs', game / 'AstraDecisionBridge.cs')
    return after != before



def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        raise SystemExit('Usage: patch-mdpro3.py <runtime source directory>')
    TARGET = Path(argv[0]).resolve()
    if ROOT / 'runtime' not in TARGET.parents:
        raise SystemExit('Target must be the disposable duel-lab/runtime checkout')

    game = TARGET / 'Assets/Scripts/Windbot/Game'
    ai_path = game / 'GameAI.cs'
    ai = ai_path.read_text(encoding='utf-8-sig')
    if 'AstraDecisionBridge Astra' in ai:
        tagged_ai = patch_ai_tribute_subtype(ai)
        if tagged_ai != ai:
            ai_path.write_text(tagged_ai, encoding='utf-8', newline='\r\n')
        changed = apply_safety_patch(TARGET)
        print('Updated Astra safety hooks' if changed else 'Astra safety hooks already current')
        raise SystemExit(0)

    def hook(name, code):
        nonlocal ai
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
    hook('OnSelectTribute', 'return Astra.SelectCards(cards, min, max, hint, cancelable, false, -1, true, "SELECT_TRIBUTE");')
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
    apply_safety_patch(TARGET)
    print('Applied Astra hooks to', TARGET)


if __name__ == '__main__':
    main()
