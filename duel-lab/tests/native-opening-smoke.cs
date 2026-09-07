// Console entry point only. GameClient, GameBehavior, GameAI and AstraDecisionBridge
// are compiled unchanged from the native MDPro3 source beside this harness.
using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Reflection;
using System.Collections.Generic;
using Newtonsoft.Json;
using WindBot.Game;
using WindBot.Game.AI;
using YGOSharp.OCGWrapper;

namespace MDPro3 {
    // Only the Unity error toast sink is replaced in a headless process.
    public static class MessageManager {
        public static string messageFromSubString {
            set { Console.Error.WriteLine("BRIDGE_ERROR " + value); }
        }
    }
}
namespace WindBot {
    public class Program {
        internal static Random Rand = new Random(1);
        public static FileStream ReadFile(string directory,string filename,string extension) {
            string path=File.Exists(filename)?filename:Path.Combine("Data/Windbot",directory,filename+"."+extension);
            return new FileStream(path,FileMode.Open,FileAccess.Read);
        }
        public static int Main(string[] args) {
            try {
                NamedCardsManager.InitForMulti(new List<string>{Path.GetFullPath("Data/locales/ja-JP/cards.cdb")});
                DecksManager.Init();
                Console.OutputEncoding=System.Text.Encoding.UTF8;
                var info=new WindBotInfo { Name="Native opening smoke",Deck="Astra",DeckFile=Path.GetFullPath("opening.ydk"),Host="127.0.0.1",Port=int.Parse(args[0]),Hand=1,Chat=false,Dialog="Universal.JP" };
                var client=new GameClient(info);client.Start();
                var behaviorField=typeof(GameClient).GetField("_behavior",BindingFlags.NonPublic|BindingFlags.Instance);
                var duelField=typeof(GameBehavior).GetField("_duel",BindingFlags.NonPublic|BindingFlags.Instance);
                var aiField=typeof(GameBehavior).GetField("_ai",BindingFlags.NonPublic|BindingFlags.Instance);
                int mainResponses=0;
                client.Connection.PacketReceived += reader => {
                    long saved=reader.BaseStream.Position;reader.BaseStream.Position=0;
                    int outer=reader.ReadByte();int inner=reader.BaseStream.Length>1?reader.ReadByte():-1;
                    reader.BaseStream.Position=saved;
                    if(outer==1&&inner==11){
                        mainResponses++;
                        if(mainResponses==1){
                            var observed=(WindBot.Game.Duel)duelField.GetValue(behaviorField.GetValue(client));
                            Console.WriteLine("FIRST_MAIN_HAND "+JsonConvert.SerializeObject(observed.Fields[0].Hand.Select(c=>c.Id).ToArray()));
                        }
                    }
                };
                string previous="";var deadline=DateTime.UtcNow.AddSeconds(int.Parse(args[1]));
                while(client.Connection.IsConnected&&DateTime.UtcNow<deadline) {
                    client.Tick();
                    var duel=(WindBot.Game.Duel)duelField.GetValue(behaviorField.GetValue(client));
                    if(duel.Fields[0].Hand==null){Thread.Sleep(2);continue;}
                    var ai=(GameAI)aiField.GetValue(behaviorField.GetValue(client));
                    var sequenceField=typeof(AstraDecisionBridge).GetField("requestSequence",BindingFlags.NonPublic|BindingFlags.Instance);
                    long requestCount=sequenceField==null?0:Convert.ToInt64(sequenceField.GetValue(ai.Astra));
                    // Only own state and opponent counts are observed. Never access the native core's state.
                    var value=new {turn=duel.Turn,player=duel.Player,phase=duel.Phase.ToString(),lp=duel.Fields[0].LifePoints,mainResponses,bridgeRequests=requestCount,
                        hand=duel.Fields[0].Hand.Select(c=>c.Id).ToArray(),
                        monsters=duel.Fields[0].MonsterZone.Where(c=>c!=null).Select(c=>new{code=c.Id,sequence=c.Sequence}).ToArray(),
                        spells=duel.Fields[0].SpellZone.Where(c=>c!=null).Select(c=>new{code=c.Id,sequence=c.Sequence}).ToArray(),
                        opponentHandCount=duel.Fields[1].Hand.Count};
                    var json=JsonConvert.SerializeObject(value);
                    if(json!=previous){Console.WriteLine("STATE "+json);previous=json;}
                    if(duel.Turn>1){Console.WriteLine("OPENING_END "+json);return 0;}
                    Thread.Sleep(2);
                }
                Console.Error.WriteLine("CLIENT_ENDED_OR_TIMEOUT");return 2;
            }catch(Exception error){Console.Error.WriteLine(error.ToString());return 1;}
        }
    }
}
