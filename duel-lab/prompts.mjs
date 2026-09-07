import {OcgMessageType as M,OcgResponseType as R,cardMatchesOpcode} from 'ocgcore-wasm';
import {cardInfo,cards,description} from './cards.mjs';
export const promptTypes = new Set([10,11,12,13,14,15,16,18,19,20,21,22,23,24,25,26,132,140,141,142,143]);
const locName = {1:'山札',2:'手札',4:'モンスター',8:'魔法・罠',16:'墓地',32:'除外',64:'EX'};
function choiceCard(c, extra='') {
  return {...c, ...cardInfo(c.code), label:`${cardInfo(c.code).name} ${extra}`.trim(), detail:`${c.controller===0?'P1':'P2'} ${locName[c.location] || ''} ${c.sequence+1}`};
}
export function makePrompt(m, hint='') {
  const p = {type:M[m.type], player:m.player, title:hint || '行動を選択', mode:'single', choices:[]};
  const add = (label,response,c) => p.choices.push({id:p.choices.length,label,...(c?{card:choiceCard(c)}:{}),response});
  switch(m.type) {
    case M.SELECT_IDLECMD:
      p.title='メインフェイズ — 行動を選択';
      [['summons',0,'召喚'],['special_summons',1,'特殊召喚'],['pos_changes',2,'表示形式変更'],['monster_sets',3,'モンスターセット'],['spell_sets',4,'魔法・罠セット'],['activates',5,'効果発動']].forEach(([key,action,label]) => m[key].forEach((c,index)=>add(`${label}：${cardInfo(c.code).name}${c.description?` / ${description(c.description)}`:''}`,{type:R.SELECT_IDLECMD,action,index},c)));
      if(m.to_bp)add('バトルフェイズへ',{type:R.SELECT_IDLECMD,action:6,index:0});
      if(m.to_ep)add('ターンを終了',{type:R.SELECT_IDLECMD,action:7,index:0});
      break;
    case M.SELECT_BATTLECMD:
      p.title='バトルフェイズ — 行動を選択';
      m.chains.forEach((c,index)=>add(`効果発動：${cardInfo(c.code).name}`,{type:R.SELECT_BATTLECMD,action:0,index},c));
      m.attacks.forEach((c,index)=>add(`攻撃：${cardInfo(c.code).name}`,{type:R.SELECT_BATTLECMD,action:1,index},c));
      if(m.to_m2)add('メインフェイズ2へ',{type:R.SELECT_BATTLECMD,action:2,index:0});
      if(m.to_ep)add('ターンを終了',{type:R.SELECT_BATTLECMD,action:3,index:0});
      break;
    case M.SELECT_CHAIN:
      p.title='チェーン — 効果を発動しますか？';
      m.selects.forEach((c,index)=>add(`発動：${cardInfo(c.code).name} / ${description(c.description)}`,{type:R.SELECT_CHAIN,index},c));
      if(!m.forced)add('発動しない',{type:R.SELECT_CHAIN,index:null});
      break;
    case M.SELECT_EFFECTYN: case M.SELECT_YESNO:
      p.title=(m.code?cardInfo(m.code).name+' — ':'')+description(m.description);
      add('はい',{type:m.type===M.SELECT_EFFECTYN?R.SELECT_EFFECTYN:R.SELECT_YESNO,yes:true},m.code?m:null);
      add('いいえ',{type:m.type===M.SELECT_EFFECTYN?R.SELECT_EFFECTYN:R.SELECT_YESNO,yes:false});break;
    case M.SELECT_OPTION:
      m.options.forEach((v,index)=>add(description(v),{type:R.SELECT_OPTION,index}));break;
    case M.SELECT_UNSELECT_CARD:
      p.title=hint || '素材を選択（選択済みカードを押すと解除）';
      [...m.select_cards,...m.unselect_cards].forEach((c,index)=>add(`${index<m.select_cards.length?'選択':'解除'}：${cardInfo(c.code).name}`,{type:R.SELECT_UNSELECT_CARD,index},c));
      if(m.can_finish || m.can_cancel)add(m.can_finish?'選択を確定':'キャンセル',{type:R.SELECT_UNSELECT_CARD,index:null});break;
    case M.SELECT_CARD: case M.SELECT_TRIBUTE: case M.SELECT_SUM:
      p.mode='multi';p.min=m.min;p.max=m.max;p.title=hint || (m.type===M.SELECT_SUM?`合計 ${m.amount} になるカードを選択`:'カードを選択');
      p.cards=m.selects.map(c=>choiceCard(c));p.canCancel=!!m.can_cancel;
      if(m.type===M.SELECT_SUM){p.amount=m.amount;p.must=m.selects_must.map(c=>choiceCard(c));p.sumMode=m.select_max;}
      break;
    case M.SELECT_PLACE: case M.SELECT_DISFIELD:
      p.mode='multi';p.min=p.max=m.count || 1;p.title='ゾーンを選択';p.cards=[];
      for(let half=0;half<2;half++) for(let loc=0;loc<2;loc++) for(let sequence=0;sequence<(loc?8:7);sequence++) {
        const bit=half*16+loc*8+sequence;
        if(!(m.field_mask & (1<<bit)))p.cards.push({label:`${half?'相手':'自分'} ${loc?'魔法・罠':'モンスター'} ${sequence>=5?(loc?'フィールド':'EX '+(sequence-4)):sequence+1}`,place:{player:m.player^half,location:loc?8:4,sequence}});
      }break;
    case M.SELECT_POSITION:
      p.title=cardInfo(m.code).name+' — 表示形式';
      for(const [position,label] of [[1,'攻撃表示'],[4,'守備表示'],[2,'裏側攻撃'],[8,'裏側守備']])if(m.positions&position)add(label,{type:R.SELECT_POSITION,position});break;
    case M.SORT_CARD: case M.SORT_CHAIN:
      p.mode='order';p.cards=m.cards.map(c=>choiceCard(c));p.title='上から順に選択してください';p.min=p.max=p.cards.length;break;
    case M.ANNOUNCE_NUMBER:
      m.options.forEach((value,index)=>add(String(value),{type:R.ANNOUNCE_NUMBER,value:index}));break;
    case M.ANNOUNCE_CARD:
      p.mode='announce';p.title='カード名を宣言';
      p.cards=Object.values(cards).filter(c=>cardMatchesOpcode({...c,race:BigInt(c.race)},m.opcodes)).map(c=>({code:c.code,label:c.name}));break;
    case M.ANNOUNCE_RACE: case M.ANNOUNCE_ATTRIB: {
      p.mode='multi';p.min=p.max=m.count;p.title=m.type===M.ANNOUNCE_RACE?'種族を選択':'属性を選択';p.cards=[];
      const mask=BigInt(m.available ?? m.races ?? m.attributes ?? 0);
      const names=m.type===M.ANNOUNCE_RACE?['戦士','魔法使い','天使','悪魔','アンデット','機械','水','炎','岩石','鳥獣','植物','昆虫','雷','ドラゴン','獣','獣戦士','恐竜','魚','海竜','爬虫類','サイキック','幻神獣','創造神','幻竜','サイバース','幻想魔']:['地','水','炎','風','光','闇','神'];
      names.forEach((name,i)=>{if(mask&(1n<<BigInt(i)))p.cards.push({label:name,value:String(1n<<BigInt(i))});});break;}
    case M.SELECT_COUNTER:
      p.mode='counter';p.title=`カウンターを合計${m.count}個取り除く`;p.count=m.count;p.cards=m.cards.map(c=>choiceCard(c));break;
    case M.ROCK_PAPER_SCISSORS:
      ['グー','チョキ','パー'].forEach((label,index)=>add(label,{type:R.ROCK_PAPER_SCISSORS,value:index+1}));break;
    default:throw new Error(`未対応の選択要求: ${M[m.type] || m.type}`);
  }
  return p;
}

export function responseFor(m,p,input) {
  if(p.mode==='single') {
    const c=p.choices.find(c=>c.id===input.action);if(!c)throw new Error('選択肢が無効です');return c.response;
  }
  if(input.cancel && p.canCancel)return {type:m.type===M.SELECT_TRIBUTE?R.SELECT_TRIBUTE:R.SELECT_CARD,indicies:null};
  const indices=input.selection;
  if(!Array.isArray(indices)||indices.some(i=>!Number.isInteger(i)||i<0||i>=p.cards.length)||new Set(indices).size!==indices.length)throw new Error('カード選択が無効です');
  if(p.mode==='announce') {
    if(indices.length!==1)throw new Error('1枚を宣言してください');return {type:R.ANNOUNCE_CARD,card:p.cards[indices[0]].code};
  }
  if(p.mode==='counter') {
    const values=input.counters;
    if(!Array.isArray(values)||values.length!==p.cards.length||values.some((n,i)=>!Number.isInteger(n)||n<0||n>p.cards[i].count)||values.reduce((a,b)=>a+b,0)!==p.count)throw new Error('カウンター数が無効です');
    return {type:R.SELECT_COUNTER,counters:values};
  }
  if(m.type!==M.SELECT_TRIBUTE && m.type!==M.SELECT_SUM && (indices.length<p.min||indices.length>p.max))throw new Error(`${p.min}〜${p.max}枚を選択してください`);
  switch(m.type) {
    case M.SELECT_CARD:return {type:R.SELECT_CARD,indicies:indices};
    case M.SELECT_TRIBUTE:return {type:R.SELECT_TRIBUTE,indicies:indices};
    case M.SELECT_SUM:return {type:R.SELECT_SUM,indicies:[...m.selects_must.map((_,i)=>i),...indices.map(i=>i+m.selects_must.length)]};
    case M.SELECT_PLACE:case M.SELECT_DISFIELD:return {type:m.type===M.SELECT_PLACE?R.SELECT_PLACE:R.SELECT_DISFIELD,places:indices.map(i=>p.cards[i].place)};
    case M.SORT_CARD:case M.SORT_CHAIN:return {type:R.SORT_CARD,order:p.cards.map((_,i)=>indices.indexOf(i))};
    case M.ANNOUNCE_RACE:return {type:R.ANNOUNCE_RACE,races:indices.map(i=>BigInt(p.cards[i].value))};
    case M.ANNOUNCE_ATTRIB:return {type:R.ANNOUNCE_ATTRIB,attributes:indices.map(i=>Number(p.cards[i].value))};
    default:throw new Error('応答を変換できません');
  }
}

export function publicPrompt(p) {
  if(!p)return null;
  return {...p,choices:p.choices.map(({response,...c})=>c)};
}
