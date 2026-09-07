// Exercises the compiled product bridge and actual GameBehavior packet handlers.
// No HTTP, native duel server, Astra process, account or card database is used.
using System;
using System.IO;
using System.Reflection;
using System.Runtime.Serialization;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using WindBot.Game;
using WindBot.Game.AI;
using YGOSharp.OCGWrapper.Enums;

public static class NativePatchTest
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;
    private sealed class PassiveExecutor : Executor
    {
        public PassiveExecutor(GameAI ai, Duel duel) : base(ai, duel) { }
    }
    private sealed class StopBeforeNetwork : Exception { }
    private static void Check(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }
    private static JObject Payload(AstraDecisionBridge bridge, object prompt = null)
    {
        return (JObject)typeof(AstraDecisionBridge).GetMethod("BuildPayload", PrivateInstance)
            .Invoke(bridge, new object[] { prompt ?? new { kind = "single", title = "test", choices = new object[0] } });
    }
    private static void Field(object target, string field, object value)
    {
        target.GetType().GetField(field, PrivateInstance).SetValue(target, value);
    }
    private static byte[] Packet(Action<BinaryWriter> write)
    {
        using (var stream = new MemoryStream())
        {
            using (var writer = new BinaryWriter(stream)) { write(writer); writer.Flush(); return stream.ToArray(); }
        }
    }
    private static void Invoke(GameBehavior behavior, string method, byte[] packet)
    {
        using (var reader = new BinaryReader(new MemoryStream(packet)))
            typeof(GameBehavior).GetMethod(method, PrivateInstance).Invoke(behavior, new object[] { reader });
    }
    private static void CardEntry(BinaryWriter writer, int sequence)
    {
        writer.Write(0); writer.Write((byte)1); writer.Write((byte)CardLocation.Hand);
        writer.Write((byte)sequence); writer.Write((byte)1);
    }
    public static int Main()
    {
        string config = Path.GetTempFileName();
        try
        {
            File.WriteAllText(config, "{\"url\":\"http://127.0.0.1:8788/choose\",\"token\":\"unused-test-fixture\"}");
            var duel = new Duel { IsFirst = false };
            duel.Fields[0].Init(6, 0); duel.Fields[1].Init(6, 0);
            var bridge = new AstraDecisionBridge(duel, new Deck(), config);
            var ai = (GameAI)FormatterServices.GetUninitializedObject(typeof(GameAI));
            ai.Astra = bridge; ai.Executor = new PassiveExecutor(ai, duel);
            Field(ai, "_activatedCards", new Dictionary<int, int>());
            var behavior = (GameBehavior)FormatterServices.GetUninitializedObject(typeof(GameBehavior));
            Field(behavior, "_duel", duel); Field(behavior, "_ai", ai);

            var first = Payload(bridge);
            Check((int)first["protocolVersion"] == 2 && (long)first["requestId"] == 1, "Initial protocol/request ID");
            Check((long)first["safety"]["drawEpoch"] == 0, "Initial draw epoch");
            bridge.ObserveDuelStart();
            Invoke(behavior, "OnNewTurn", new byte[] { 1 });
            Invoke(behavior, "OnDraw", new byte[] { 1, 2 }); // Wire player 1 maps to local self.
            Invoke(behavior, "OnDraw", new byte[] { 0, 1 }); // Wire player 0 maps to local opponent.
            Invoke(behavior, "OnDraw", new byte[] { 1, 0 }); // No draw must not invalidate.
            foreach (byte controller in new byte[] { 1, 0 })
                Invoke(behavior, "OnChaining", Packet(writer => {
                    writer.Write(0); writer.Write(controller); writer.Write((byte)CardLocation.Hand);
                    writer.Write((byte)0); writer.Write((byte)0); writer.Write(controller);
                    writer.Write((short)0); writer.Write(0);
                }));
            Invoke(behavior, "OnChainNegated", new byte[] { 1 });
            Invoke(behavior, "OnChainDisabled", new byte[] { 2 });
            var events = Payload(bridge);
            Check((long)events["requestId"] == 2, "Request IDs must increase");
            Check((long)events["safety"]["drawEpoch"] == 2, "Draw events, not card quantity");
            Check((long)events["safety"]["ownDrawEpoch"] == 1 && (long)events["safety"]["opponentDrawEpoch"] == 1, "Local player remap");
            Check((long)events["safety"]["opponentEffectEpoch"] == 1, "Only opponent chain increments");
            Check((long)events["safety"]["negationEpoch"] == 2, "Both negation messages invalidate");
            Check((long)events["safety"]["turnEpoch"] == 1 && (long)events["safety"]["duelEpoch"] == 1, "Turn/duel boundary");
            Check(duel.Fields[0].Hand.Count == 2 && duel.Fields[1].Hand.Count == 1, "Actual draw handlers ran");
            Check((int)events["state"]["players"][0]["hand"][0]["code"] == 0, "Opponent hidden card stays masked");

            for (int test = 0; test < 2; test++)
            {
                bool finishable = test == 0;
                bool wireCancelable = test == 1;
                int unselectCount = test == 0 ? 1 : 0;
                JObject captured = null;
                Func<IList<ClientCard>, int, int, int, bool, IList<ClientCard>> callback = (cards, min, max, hint, cancelable) => {
                    captured = Payload(bridge, new { kind = "multi", min, max, canCancel = cancelable });
                    throw new StopBeforeNetwork();
                };
                var bytes = Packet(writer => {
                    writer.Write((byte)1); writer.Write((byte)(finishable ? 1 : 0)); writer.Write((byte)(wireCancelable ? 1 : 0));
                    writer.Write((byte)1); writer.Write((byte)3); writer.Write((byte)1); CardEntry(writer, 0);
                    writer.Write((byte)unselectCount); if (unselectCount != 0) CardEntry(writer, 1);
                });
                try
                {
                    using (var reader = new BinaryReader(new MemoryStream(bytes)))
                        typeof(GameBehavior).GetMethod("InternalOnSelectUnselectCard", PrivateInstance)
                            .Invoke(behavior, new object[] { reader, callback });
                    throw new Exception("Expected callback to stop before network");
                }
                catch (TargetInvocationException error)
                {
                    if (!(error.InnerException is StopBeforeNetwork)) throw;
                }
                var request = captured["state"]["request"];
                var context = request["selectionContext"];
                Check((string)request["subtype"] == "SELECT_UNSELECT_CARD", "Native prompt subtype");
                Check((bool)context["finishable"] == finishable && (bool)context["cancelable"] == wireCancelable, "Wire flags are distinct");
                Check((int)context["selectCount"] == 1 && (int)context["unselectCount"] == unselectCount, "Both packet group sizes");
                Check((bool)request["canCancel"] == finishable, "Existing native response capability remains explicit");
                Check(Payload(bridge)["state"]["request"]["selectionContext"] == null, "Context cleared even after callback failure");
            }
            long beforeForced = (long)Payload(bridge)["requestId"];
            Check(bridge.Single("forced", new object[] { "only" }) == 0, "Forced choices remain local");
            Check((long)Payload(bridge)["requestId"] == beforeForced + 1, "Forced choices do not issue a request");
            Console.WriteLine("PASS native safety: public packet epochs, monotonic IDs, private-card masking, selector flags and exception cleanup");
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
        finally { File.Delete(config); }
    }
}
