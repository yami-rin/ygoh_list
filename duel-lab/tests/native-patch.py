"""Idempotent patch regression checks; --runtime tests compiled native classes."""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('native_patch', ROOT / 'scripts/patch-mdpro3.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
RUN_RUNTIME = '--runtime' in sys.argv
if RUN_RUNTIME:
    sys.argv.remove('--runtime')

FIXTURE = '''class GameBehavior {
    // KEEP_UNRELATED_USER_EDIT
    private void OnStart(BinaryReader packet) { _ai.OnStart(); }
    private void OnDraw(BinaryReader packet) { int player = GetLocalPlayer(packet.ReadByte()); int count = packet.ReadByte(); _ai.OnDraw(player); }
    private void OnNewTurn(BinaryReader packet) { _duel.Turn++; _ai.OnNewTurn(); }
    private void OnChaining(BinaryReader packet) { int cc = GetLocalPlayer(packet.ReadByte()); _ai.OnChaining(card, cc); }
    private void OnChainNegated(BinaryReader packet) { int chainIndex = packet.ReadByte(); _duel.NegatedChainIndexList.Add(chainIndex); }
    private void OnChainDisabled(BinaryReader packet) { int chainIndex = packet.ReadByte(); _duel.NegatedChainIndexList.Add(chainIndex); }
    private void InternalOnSelectUnselectCard(BinaryReader packet, Func<IList<ClientCard>, int, int, int, bool, IList<ClientCard>> func) {
        bool finishable = packet.ReadByte() != 0;
        bool cancelable = packet.ReadByte() != 0 || finishable;
        int count = packet.ReadByte(); int count2 = packet.ReadByte();
        if (count2 == 0) cancelable = false;
        IList<ClientCard> selected = func(cards, (finishable ? 0 : 1), 1, _select_hint, cancelable);
    }
}'''


class PatchTests(unittest.TestCase):
    def test_tribute_tag_is_distinct_and_idempotent(self):
        source = '''public IList<ClientCard> OnSelectTribute(IList<ClientCard> cards, int min, int max, int hint, bool cancelable)
        {
            if (Astra != null) return Astra.SelectCards(cards, min, max, hint, cancelable);
            // KEEP_OTHER_SELECTIONS
        }'''
        result = patch.patch_ai_tribute_subtype(source)
        self.assertIn('"SELECT_TRIBUTE"', result)
        self.assertIn('KEEP_OTHER_SELECTIONS', result)
        self.assertEqual(patch.patch_ai_tribute_subtype(result), result)
        with self.assertRaisesRegex(RuntimeError, 'subtype'):
            patch.patch_ai_tribute_subtype(source.replace('OnSelectTribute', 'Unknown'))

    def test_idempotent_event_hooks_preserve_unrelated_code(self):
        result = patch.patch_behavior_safety(FIXTURE)
        self.assertEqual(patch.patch_behavior_safety(result), result)
        self.assertIn('KEEP_UNRELATED_USER_EDIT', result)
        for call in ['ObserveDuelStart()', 'ObserveDraw(player, count)', 'ObserveTurn()', 'ObserveChaining(cc)']:
            self.assertEqual(result.count('_ai.Astra.' + call), 1)
        self.assertEqual(result.count('_ai.Astra.ObserveNegation()'), 2)
        self.assertIn('finally\n', result)
        self.assertIn('SetSelectionContext("SELECT_UNSELECT_CARD", finishable, astraWireCancelable, count, count2)', result)

    def test_marker_drift_and_missing_anchor_fail_closed(self):
        result = patch.patch_behavior_safety(FIXTURE)
        with self.assertRaisesRegex(RuntimeError, 'marker does not match'):
            patch.patch_behavior_safety(result.replace('ObserveDraw(player, count)', 'ObserveDraw(player, 0)'))
        with self.assertRaisesRegex(RuntimeError, 'anchor changed'):
            patch.patch_behavior_safety(FIXTURE.replace('_ai.OnDraw(player);', '_ai.OnDraw(0);'))

    def test_target_update_is_incremental_and_idempotent(self):
        runtime = ROOT / 'runtime'
        runtime.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='native-patch-fixture-', dir=runtime) as directory:
            game = Path(directory) / 'Assets/Scripts/Windbot/Game'
            game.mkdir(parents=True)
            target = game / 'GameBehavior.cs'
            target.write_text(FIXTURE, encoding='utf-8')
            unrelated = game / 'GameAI.cs'
            unrelated.write_text('AstraDecisionBridge Astra; // KEEP_BASE_PATCH', encoding='utf-8')
            self.assertTrue(patch.apply_safety_patch(directory))
            before = target.read_bytes()
            self.assertFalse(patch.apply_safety_patch(directory))
            self.assertEqual(target.read_bytes(), before)
            self.assertEqual(unrelated.read_text('utf-8'), 'AstraDecisionBridge Astra; // KEEP_BASE_PATCH')
            self.assertEqual((game / 'AstraDecisionBridge.cs').read_bytes(), (ROOT / 'native/AstraDecisionBridge.cs').read_bytes())
        with self.assertRaisesRegex(RuntimeError, 'disposable'):
            patch.apply_safety_patch(ROOT.parent)

    @unittest.skipUnless(RUN_RUNTIME, 'Run with --runtime after native-opening-smoke.py --build-only')
    def test_actual_compiled_bridge_and_packet_handlers(self):
        native = ROOT / 'runtime/native-opening-test'
        manifest = json.loads((native / 'build-manifest.json').read_text('utf-8'))
        records = {entry['path'].replace('\\', '/'): entry['sha256'] for entry in manifest['sources']}
        for relative in ['native/AstraDecisionBridge.cs', 'runtime/MDPro3/Assets/Scripts/Windbot/Game/GameBehavior.cs']:
            self.assertEqual(records[relative], hashlib.sha256((ROOT / relative).read_bytes()).hexdigest(), 'Rebuild native harness after source edits')
        work = ROOT / 'runtime/native-patch-test'
        work.mkdir(parents=True, exist_ok=True)
        for name in ['opening-client.exe', 'Newtonsoft.Json.dll', 'Mono.Data.Sqlite.dll']:
            shutil.copyfile(native / name, work / name)
        mono = ROOT / 'runtime/unity-6000.0.24/Editor/Data/MonoBleedingEdge'
        framework = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Microsoft.NET/Framework64/v4.0.30319'
        references = [framework / (name + '.dll') for name in ['mscorlib', 'System', 'System.Core', 'System.Runtime.Serialization']]
        references += [work / 'opening-client.exe', work / 'Newtonsoft.Json.dll']
        command = [str(mono / 'bin/mono.exe'), str(mono / 'lib/mono/4.5/mcs.exe'), '-nostdlib', '-langversion:latest', '-out:' + str(work / 'native-patch.exe')]
        command += ['-r:' + str(reference) for reference in references] + [str(ROOT / 'tests/native-patch.cs')]
        built = subprocess.run(command, cwd=work, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60)
        (work / 'build.log').write_text(built.stdout + built.stderr, encoding='utf-8')
        self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
        result = subprocess.run([str(work / 'native-patch.exe')], cwd=work, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30,
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        (work / 'result.log').write_text(result.stdout + result.stderr, encoding='utf-8')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('PASS native safety:', result.stdout)
        print(result.stdout.strip())


if __name__ == '__main__':
    unittest.main(verbosity=2)
