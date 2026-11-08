#!/usr/bin/env node
// Duel Lab MCP server (stdio, newline-delimited JSON-RPC). Drives the same EDOPro rules engine as MDPro3,
// one decision at a time, so routes can be tried, undone and saved without the Unity client.
// Register: claude mcp add -s user duel-lab -- node C:/Project/Apps/card_manager_web/duel-lab/mcp/duel-mcp.mjs
import fs from 'node:fs';
import readline from 'node:readline';
import {startDeckRoute,deckHash} from '../scripts/import-replays.mjs';
import {respond,board,hash,finishRoute} from '../scripts/route-harness.mjs';
import {cards,cardInfo} from '../cards.mjs';
import '../custom-cards.mjs';

const DECKS={
  'user-malice':new URL('../presets/user-malice.json',import.meta.url),
  preset:new URL('../preset.json',import.meta.url),
};
const ROUTES=new URL('../routes/mcp-routes.json',import.meta.url);
const ZONES=[['hand','手札'],['monsters','モンスター'],['spells','魔法・罠'],['grave','墓地'],['banished','除外']];
let session=null;

const name=c=>c?.code?cardInfo(c.code).name:c?.hidden?'裏側':'';
function loadDeck(id){
  const file=DECKS[id];if(!file)throw new Error(`deck は ${Object.keys(DECKS).join(' / ')} のどれか`);
  const d=JSON.parse(fs.readFileSync(file));return {main:d.main,extra:d.extra};
}
// Card name (full or partial) or passcode → code present in the deck.
function resolveCard(text,deck){
  if(/^\d+$/.test(String(text)))return Number(text);
  const pool=[...new Set([...deck.main,...deck.extra])];
  const exact=pool.find(c=>cards[c]?.name===text);if(exact)return exact;
  const hits=pool.filter(c=>cards[c]?.name.includes(text));
  if(hits.length===1)return hits[0];
  throw new Error(hits.length?`「${text}」が複数に一致：${hits.map(c=>cards[c].name).join('、')}`:`「${text}」はデッキにありません`);
}

async function build(spec,inputs){
  const g=await startDeckRoute(spec.hand,{seed:spec.seed,deck:spec.deck});
  for(const input of inputs)respond(g,input);
  return g;
}

function describe(g){
  const s=g.snapshot(0),out=[];
  out.push(`ターン${s.turn} ${s.phase} / LP 自分${s.players[0].lp} 相手${s.players[1].lp} / 手順${g.route.steps.length}`);
  for(const [p,label] of [[0,'自分'],[1,'相手']]){
    const pl=s.players[p];
    const zones=ZONES.map(([k,z])=>{const list=pl[k].filter(Boolean).map(c=>name(c)+(c.position&8&&k!=='hand'?'(裏)':''));return list.length?`${z}：${list.join('、')}`:null;}).filter(Boolean);
    if(zones.length||p===0)out.push(`[${label}] ${zones.join(' | ')||'なし'}（デッキ${pl.deckCount}・EX${pl.extra.filter(Boolean).length}）`);
  }
  out.push('ログ：'+g.log.slice(-6).map(e=>e.text).join(' / '));
  if(g.status!=='playing'||!g.pending){out.push(`対戦終了：${g.status}`);return out.join('\n');}
  const p=g.prompt,mine=(g.pending.player^g.first)===0;
  out.push(`${mine?'選択':'相手の選択'}：${p.title}（${p.type}${p.mode==='multi'?` ${p.min}〜${p.max}枚`:''}）`);
  if(p.mode==='single')p.choices.forEach((c,i)=>out.push(`  ${i}. ${c.label}`));
  else (p.cards||[]).forEach((c,i)=>out.push(`  ${i}. ${c.label}${c.detail?` [${c.detail}]`:''}`));
  return out.join('\n');
}

// option: index into the displayed list, or text matched against labels. select: list of indices/texts for multi prompts.
function toInput(g,{option,select}){
  const p=g.prompt;
  const pick=(list,v)=>{
    if(typeof v==='number'||/^\d+$/.test(String(v))){const i=Number(v);if(!list[i])throw new Error(`番号 ${i} はありません`);return i;}
    const i=list.findIndex(x=>x.label===v);if(i>=0)return i;
    const hits=list.map((x,i)=>[x,i]).filter(([x])=>x.label.includes(v));
    if(hits.length===1)return hits[0][1];
    throw new Error(hits.length?`「${v}」が複数に一致：${hits.map(([x])=>x.label).join(' / ')}`:`「${v}」に一致する選択肢がありません`);
  };
  if(p.mode==='single'){if(option===undefined)throw new Error('option を指定してください');return {action:p.choices[pick(p.choices,option)].id};}
  const values=select??(option!==undefined?[option]:null);
  if(!values)throw new Error('select（番号の配列）を指定してください');
  if(p.mode==='order')return {selection:values.map(v=>pick(p.cards,v))};
  if(p.mode==='counter')return {selection:[],counters:values.map(Number)};
  return {selection:values.map(v=>pick(p.cards,v))};
}

const TOOLS={
  duel_start:{
    description:'先攻1ターン目の対戦を始める。deck: user-malice（ユーザーのM∀LICE、既定）/ preset。hand: 手札のカード名（部分一致可）またはパスコードの配列。相手は手札なし。',
    inputSchema:{type:'object',properties:{hand:{type:'array',items:{type:['string','number']}},deck:{type:'string'},seed:{type:'number'}},required:['hand']},
    async run({hand,deck='user-malice',seed=123}){
      const d=loadDeck(deck),codes=hand.map(h=>resolveCard(h,d));
      session?.g.close();
      const spec={deck:d,deckId:deck,hand:codes,seed};
      session={spec,inputs:[],g:await build(spec,[])};
      return describe(session.g);
    }},
  duel_state:{description:'現在の盤面と、選べる行動を番号付きで返す。',inputSchema:{type:'object',properties:{}},
    async run(){need();return describe(session.g);}},
  duel_act:{
    description:'1手進める。1つ選ぶ選択は option（番号か選択肢の文字列・部分一致）、カードを複数選ぶ選択は select（番号か名前の配列）。エンジンが拒否した手は戻す。',
    inputSchema:{type:'object',properties:{option:{type:['number','string']},select:{type:'array',items:{type:['number','string']}}}},
    async run(args){
      need();const g=session.g,input=toInput(g,args);
      try{respond(g,input);}catch(e){session.g=await build(session.spec,session.inputs);throw new Error(`エンジンが拒否：${e.message}`);}
      session.inputs.push(input);return describe(g);
    }},
  duel_undo:{description:'steps 手戻す（既定1）。',inputSchema:{type:'object',properties:{steps:{type:'number'}}},
    async run({steps=1}){need();session.inputs=session.inputs.slice(0,Math.max(0,session.inputs.length-steps));session.g.close();session.g=await build(session.spec,session.inputs);return describe(session.g);}},
  duel_history:{description:'ここまでの手順を一覧で返す。',inputSchema:{type:'object',properties:{}},
    async run(){need();const g=session.g;return [`手札：${session.spec.hand.map(c=>cards[c].name).join('、')}（${session.spec.deckId}）`,...g.route.steps.map((s,i)=>`${i+1}. ${s.label}`)].join('\n');}},
  duel_save_route:{description:'現在の手順を routes/mcp-routes.json に保存する（同じidは上書き）。',
    inputSchema:{type:'object',properties:{id:{type:'string'},title:{type:'string'}},required:['id']},
    async run({id,title=id}){
      need();const g=session.g;
      const route=finishRoute(g,{id,title,deck:session.spec.deckId,deckHash:deckHash(session.spec.deck)});
      const saved=fs.existsSync(ROUTES)?JSON.parse(fs.readFileSync(ROUTES)):{schemaVersion:1,routes:[]};
      const i=saved.routes.findIndex(r=>r.id===id);if(i>=0)saved.routes[i]=route;else saved.routes.push(route);
      fs.writeFileSync(ROUTES,JSON.stringify(saved,null,1)+'\n');
      return `保存しました：${id}（${route.steps.length}手、最終盤面 ${route.finalHash.slice(0,12)}）`;
    }},
};
function need(){if(!session)throw new Error('先に duel_start で対戦を始めてください');}

const send=msg=>process.stdout.write(JSON.stringify(msg)+'\n');
async function handle(msg){
  const {id,method,params}=msg;
  if(method==='initialize')return send({jsonrpc:'2.0',id,result:{protocolVersion:params?.protocolVersion||'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'duel-lab',version:'0.1.0'}}});
  if(method==='tools/list')return send({jsonrpc:'2.0',id,result:{tools:Object.entries(TOOLS).map(([name,t])=>({name,description:t.description,inputSchema:t.inputSchema}))}});
  if(method==='tools/call'){
    const tool=TOOLS[params?.name];
    if(!tool)return send({jsonrpc:'2.0',id,error:{code:-32602,message:`unknown tool ${params?.name}`}});
    try{const text=await tool.run(params.arguments||{});return send({jsonrpc:'2.0',id,result:{content:[{type:'text',text}]}});}
    catch(e){return send({jsonrpc:'2.0',id,result:{content:[{type:'text',text:`エラー：${e.message}`}],isError:true}});}
  }
  if(method==='ping')return send({jsonrpc:'2.0',id,result:{}});
  if(id!==undefined)send({jsonrpc:'2.0',id,error:{code:-32601,message:`unsupported ${method}`}});
}
// Requests are handled one at a time so the single duel session is never used concurrently.
let queue=Promise.resolve();
readline.createInterface({input:process.stdin}).on('line',line=>{
  if(!line.trim())return;
  let msg;try{msg=JSON.parse(line);}catch{return;}
  queue=queue.then(()=>handle(msg)).catch(e=>process.stderr.write(String(e)+'\n'));
});
