// Branches that are never worth searching, shared by the interruption evaluator and the replay importer.
// Add one line per user rule ("this play is garbage") with the date it was given (docs/PRUNE_RULES.md).
import {cards} from '../cards.mjs';

const MALICE=441;
export const isMalice=c=>!!cards[c.code]?.setcodes?.includes(MALICE);

// Target choices per resolving card effect. allow(card, prompt) => false drops the card.
export const TARGET_RULES={
  // 2026-11-08: S:P Little Knight ① banishes only our own M∀LICE card; ② may pair it with an opponent monster.
  29301450:{allow:(c,p)=>c.controller===0?isMalice(c):p.min===2,reason:'リトルナイト①は自分のM∀LICEだけ、②は自分のM∀LICE＋相手モンスター'},
};

// Effects that stop our further Special Summons this turn and summon nothing themselves:
// only worth using once nothing is left to summon. (Accode Talker ① is not one: its own revival summons.)
export const SUMMON_LOCKS={};

// Cards played from the hand or kept for the opponent's turn; setting them during our combo does nothing.
export const NO_SET_IN_COMBO=new Set([6325660,40366667,97045737]);

const SAME_COPY_ZONES=new Set([1,2,16,64]);
// Identical copies in deck, hand, grave or Extra Deck are interchangeable: keep one single-card choice per copy group.
export function dedupeCopies(prompt,inputs) {
  const seen=new Set();
  return inputs.filter(input=>{
    const sel=input.selection;
    if(!sel||sel.length!==1||prompt.type==='SELECT_PLACE')return true;
    const c=prompt.cards?.[sel[0]];
    if(!c||!SAME_COPY_ZONES.has(c.location))return true;
    const key=`${c.controller}:${c.location}:${c.code}`;
    if(seen.has(key))return false;seen.add(key);return true;
  });
}

// Generic combo-time pruning for our own prompts. `ctx.summonsLeft`: summons the line still needs.
export function pointless(prompt,input,ctx={}) {
  if(input.action===undefined)return false;
  const choice=prompt.choices.find(c=>c.id===input.action);
  if(!choice)return false;
  const label=choice.label||'';
  // Unselecting a material only loops back; every material set is reachable by selecting.
  if(prompt.type==='SELECT_UNSELECT_CARD'&&label.startsWith('解除'))return true;
  if(ctx.summonsLeft>0&&/ターンを終了|バトルフェイズへ/.test(label))return true;
  if(/^魔法・罠セット/.test(label)&&NO_SET_IN_COMBO.has(choice.card?.code))return true;
  if(ctx.summonsLeft>0&&choice.card&&SUMMON_LOCKS[choice.card.code]&&(prompt.type==='SELECT_EFFECTYN'?label==='はい':/^(効果)?発動/.test(label)))return true;
  return false;
}
