using System;
using System.IO;
using System.Net;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using YGOSharp.OCGWrapper.Enums;

namespace WindBot.Game
{
    // Runs on WindBot's network thread; Unity's presentation thread stays free.
    public sealed class AstraDecisionBridge
    {
        private readonly Duel duel;
        private readonly JObject config;
        private readonly object[] ownDeck;
        private readonly string session = Guid.NewGuid().ToString("N");
        private long requestSequence;
        private long drawEpoch;
        private long ownDrawEpoch;
        private long opponentDrawEpoch;
        private long opponentEffectEpoch;
        private long negationEpoch;
        private long turnEpoch;
        private long duelEpoch;
        private object selectionContext;

        public AstraDecisionBridge(Duel state, Deck deck, string configFile)
        {
            duel = state;
            ownDeck = deck.Cards.Concat(deck.ExtraCards).GroupBy(c => c.Id)
                .OrderBy(g => g.Key).Select(g => (object)new { code = g.Key, count = g.Count() }).ToArray();
            config = JObject.Parse(File.ReadAllText(configFile));
            if ((string)config["url"] != "http://127.0.0.1:8788/choose")
                throw new InvalidOperationException("Invalid local Astra endpoint");
        }

        // These observations come from GameBehavior's public wire messages,
        // never from card-name heuristics or the opponent's private state.
        public void ObserveDuelStart()
        {
            duelEpoch++;
            selectionContext = null;
        }

        public void ObserveTurn()
        {
            turnEpoch++;
            selectionContext = null;
        }

        public void ObserveDraw(int localPlayer, int count)
        {
            if (count <= 0) return;
            drawEpoch++;
            if (localPlayer == 0) ownDrawEpoch++;
            else if (localPlayer == 1) opponentDrawEpoch++;
        }

        public void ObserveChaining(int localController)
        {
            if (localController == 1) opponentEffectEpoch++;
        }

        public void ObserveNegation()
        {
            negationEpoch++;
        }

        public void SetSelectionContext(string subtype, bool finishable, bool cancelable,
            int selectCount, int unselectCount)
        {
            selectionContext = new { subtype, finishable, cancelable, selectCount, unselectCount,
                selectionIndexSpace = "select-only", exposesUnselectChoices = false };
        }

        public void ClearSelectionContext()
        {
            selectionContext = null;
        }

        private object Card(ClientCard c)
        {
            if (c == null) return null;
            // WindBot sees only protocol-public data. Explicitly mask hidden zones again.
            bool hidden = c.Id == 0 || (c.Controller == 1 &&
                (c.Location == CardLocation.Hand || c.Location == CardLocation.Deck ||
                 ((c.Position & 10) != 0 && c.Location != CardLocation.Grave)));
            return new {
                code = hidden ? 0 : c.Id, controller = 1 - c.Controller,
                location = c.Location.ToString(), sequence = c.Sequence,
                position = c.Position, attack = hidden ? 0 : c.Attack,
                defense = hidden ? 0 : c.Defense, level = hidden ? 0 : c.Level,
                link = hidden ? 0 : c.LinkCount, disabled = hidden ? 0 : c.Disabled,
                contribution = new [] { c.OpParam1, c.OpParam2 }
            };
        }

        private object[] Zone(IEnumerable<ClientCard> cards)
        {
            return cards == null ? new object[0] : cards.Select(Card).ToArray();
        }

        private object Field(int p)
        {
            ClientField f = duel.Fields[p];
            return new {
                player = 1 - p, lp = f.LifePoints,
                hand = Zone(f.Hand), monsters = Zone(f.MonsterZone), spells = Zone(f.SpellZone),
                grave = Zone(f.Graveyard), banished = Zone(f.Banished),
                extra = Zone(f.ExtraDeck), deckCount = f.Deck == null ? 0 : f.Deck.Count
            };
        }

        private JObject Ask(object prompt)
        {
            try { return Request(prompt); }
            catch {
                MDPro3.MessageManager.messageFromSubString = "Astra接続に失敗しました。ゲーム設定の「リトライ」で再戦してください。";
                throw;
            }
        }

        private JObject BuildPayload(object prompt)
        {
            JObject requestPrompt = JObject.FromObject(prompt);
            if (selectionContext != null)
            {
                JObject context = JObject.FromObject(selectionContext);
                requestPrompt["selectionContext"] = context;
                requestPrompt["subtype"] = context["subtype"].DeepClone();
            }
            return JObject.FromObject(new {
                protocolVersion = 2, requestId = ++requestSequence, session, ownDeck,
                safety = new { drawEpoch, ownDrawEpoch, opponentDrawEpoch,
                    opponentEffectEpoch, negationEpoch, turnEpoch, duelEpoch },
                state = new { turn = duel.Turn, player = 1 - duel.Player,
                    phase = duel.Phase.ToString(), players = new [] { Field(1), Field(0) },
                    chain = Zone(duel.CurrentChain), request = requestPrompt }
            });
        }

        private JObject Request(object prompt)
        {
            JObject payload = BuildPayload(prompt);
            var request = (HttpWebRequest)WebRequest.Create((string)config["url"]);
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Headers.Add("X-Astra-Token", (string)config["token"]);
            request.Timeout = 200000;
            byte[] data = System.Text.Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(payload));
            request.ContentLength = data.Length;
            using (Stream stream = request.GetRequestStream()) stream.Write(data, 0, data.Length);
            using (var response = request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
                return JObject.Parse(reader.ReadToEnd());
        }

        public int Single(string title, IList<object> choices)
        {
            if (choices.Count == 0) throw new InvalidOperationException("No legal Astra choice");
            if (choices.Count == 1) return 0;
            var rows = choices.Select((c, i) => new { id = i, option = c }).ToArray();
            int index = (int)Ask(new { kind = "single", title, choices = rows })["action"];
            if (index < 0 || index >= choices.Count) throw new InvalidOperationException("Invalid Astra choice");
            return index;
        }

        public bool YesNo(string title, object context)
        {
            return Single(title, new object[] { new { answer = false, context }, new { answer = true, context } }) == 1;
        }

        public IList<ClientCard> SelectCards(IList<ClientCard> cards, int min, int max, int hint, bool cancelable, bool order = false, int sum = -1, bool exact = true)
        {
            if (!order && !cancelable && min == cards.Count && max == cards.Count)
                return cards.ToList();
            JObject response = Ask(new { kind = order ? "order" : "multi", title = "カード選択",
                cards = cards.Select(Card).ToArray(), min, max, canCancel = cancelable, hint, sum, exact });
            if ((bool)response["cancel"] && cancelable) return new List<ClientCard>();
            int[] indexes = response["selection"].ToObject<int[]>();
            if (indexes.Length < min || indexes.Length > max || indexes.Distinct().Count() != indexes.Length ||
                indexes.Any(i => i < 0 || i >= cards.Count)) throw new InvalidOperationException("Invalid Astra card selection");
            return indexes.Select(i => cards[i]).ToList();
        }

        public MainPhaseAction Main(MainPhase main)
        {
            var choices = new List<object>();
            var responses = new List<MainPhaseAction>();
            Action<MainPhaseAction.MainAction, IList<ClientCard>> add = (action, list) => {
                foreach (ClientCard card in list) {
                    choices.Add(new { action = action.ToString(), card = Card(card) });
                    responses.Add(new MainPhaseAction(action, card.ActionIndex));
                }
            };
            add(MainPhaseAction.MainAction.Summon, main.SummonableCards);
            add(MainPhaseAction.MainAction.SpSummon, main.SpecialSummonableCards);
            add(MainPhaseAction.MainAction.Repos, main.ReposableCards);
            add(MainPhaseAction.MainAction.SetMonster, main.MonsterSetableCards);
            add(MainPhaseAction.MainAction.SetSpell, main.SpellSetableCards);
            for (int i = 0; i < main.ActivableCards.Count; i++) {
                ClientCard c = main.ActivableCards[i];
                choices.Add(new { action = "Activate", card = Card(c), description = main.ActivableDescs[i] });
                responses.Add(new MainPhaseAction(MainPhaseAction.MainAction.Activate, c.ActionActivateIndex[main.ActivableDescs[i]]));
            }
            if (main.CanBattlePhase) { choices.Add("Battle Phase"); responses.Add(new MainPhaseAction(MainPhaseAction.MainAction.ToBattlePhase)); }
            if (main.CanEndPhase) { choices.Add("End Phase"); responses.Add(new MainPhaseAction(MainPhaseAction.MainAction.ToEndPhase)); }
            return responses[Single("メインフェイズの行動", choices)];
        }

        public BattlePhaseAction Battle(BattlePhase battle)
        {
            var choices = new List<object>();
            var responses = new List<BattlePhaseAction>();
            for (int i = 0; i < battle.ActivableCards.Count; i++) {
                ClientCard c = battle.ActivableCards[i];
                choices.Add(new { action = "Activate", card = Card(c), description = battle.ActivableDescs[i] });
                responses.Add(new BattlePhaseAction(BattlePhaseAction.BattleAction.Activate, c.ActionIndex));
            }
            foreach (ClientCard c in battle.AttackableCards) {
                choices.Add(new { action = "Attack", card = Card(c), directAttackAllowed = c.CanDirectAttack });
                responses.Add(new BattlePhaseAction(BattlePhaseAction.BattleAction.Attack, c.ActionIndex));
            }
            if (battle.CanMainPhaseTwo) { choices.Add("Main Phase 2"); responses.Add(new BattlePhaseAction(BattlePhaseAction.BattleAction.ToMainPhaseTwo)); }
            if (battle.CanEndPhase) { choices.Add("End Phase"); responses.Add(new BattlePhaseAction(BattlePhaseAction.BattleAction.ToEndPhase)); }
            return responses[Single("バトルフェイズの行動", choices)];
        }

        public int Chain(IList<ClientCard> cards, IList<int> descs, IList<bool> forces)
        {
            var choices = cards.Select((c, i) => (object)new { card = Card(c), description = descs[i] }).ToList();
            bool forced = forces.Any(x => x);
            if (!forced) choices.Add("チェーンしない");
            int selected = Single("チェーンの選択", choices);
            return selected == cards.Count ? -1 : selected;
        }

        public int Place(int cardId, int player, CardLocation location, int available)
        {
            var values = new List<int>();
            for (int i = 0; i < 8; i++) if ((available & (1 << i)) != 0) values.Add(1 << i);
            int selected = Single("配置先", values.Select((mask, i) => (object)new {
                code = cardId, controller = 1 - player, location = location.ToString(), mask }).ToList());
            return values[selected];
        }

        public int Option(string title, IList<int> values)
        {
            return Single(title, values.Select(v => (object)new { description = v }).ToList());
        }

        public bool Effect(ClientCard card, int desc)
        {
            return YesNo("効果を発動するか", new { card = Card(card), description = desc });
        }

        public IList<T> Values<T>(IList<T> values, int count, string title)
        {
            JObject response = Ask(new { kind = "multi", title, min = count, max = count,
                cards = values.Select(v => v.ToString()).ToArray(), canCancel = false });
            int[] indexes = response["selection"].ToObject<int[]>();
            if (indexes.Length != count || indexes.Distinct().Count() != count ||
                indexes.Any(i => i < 0 || i >= values.Count)) throw new InvalidOperationException("Invalid Astra declaration");
            return indexes.Select(i => values[i]).ToList();
        }

        public IList<int> Counters(int type, int quantity, IList<ClientCard> cards, IList<int> counters)
        {
            JObject response = Ask(new { kind = "counter", title = "カウンターを取り除く",
                type, quantity, cards = cards.Select((c, i) => new { card = Card(c), available = counters[i] }).ToArray() });
            int[] amounts = response["counters"].ToObject<int[]>();
            if (amounts.Length != counters.Count || amounts.Sum() != quantity ||
                amounts.Where((v, i) => v < 0 || v > counters[i]).Any()) throw new InvalidOperationException("Invalid Astra counters");
            return amounts;
        }
    }
}
