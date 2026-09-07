import fs from 'node:fs';
import assert from 'node:assert/strict';
import {preset,hash,replay} from './route-harness.mjs';
import {cards} from '../cards.mjs';

const root=new URL('../',import.meta.url);
const filenames=['malice-monsters','spell-starters','cyberse-starters'];
const groups=filenames.map(name=>JSON.parse(fs.readFileSync(new URL(`routes/${name}.json`,root))));
const classifications=groups.flatMap(g=>g.classifications);
const routes=groups.flatMap(g=>g.routes);
const probes=groups.flatMap(g=>g.probes||[]).concat(classifications.flatMap(c=>c.verification?[c.verification]:[]));
const codes=[...new Set(preset.main)];
assert.deepEqual(classifications.map(c=>c.code).sort((a,b)=>a-b),codes.sort((a,b)=>a-b),'Every main-deck card must be classified exactly once');
assert.equal(new Set(routes.map(r=>r.id)).size,routes.length,'Duplicate route id');
for(const route of routes) {
  assert(route.verified && route.steps.length,'Route needs engine evidence');
  route.final=await replay(route);
  console.log(`PASS ${route.id} (${route.steps.length} decisions)`);
}
for(const probe of probes) {
  assert(probe.verified,'Probe needs engine evidence');
  await replay(probe);
}
const book={version:1,presetHash:hash(preset),engineSources:JSON.parse(fs.readFileSync(new URL('sources.lock.json',root))),scope:'固定40+15枚・先攻空盤面・無妨害。全メイン26種類の分類と有用ルートの実証。全合法手順の総当たりではない。',
  probes:probes.map(p=>({id:p.id,hand:p.hand,summary:p.summary,steps:p.steps.length})),
  classifications:classifications.map(({code,name,classification,reason})=>({code,name,classification,reason})),routes:routes.map(r=>({id:r.id,starter:r.starter||r.hand[0],hand:r.hand,name:r.name,conditions:r.conditions,summary:r.summary,
    requiresDraw:r.requiresDraw,verified:true,steps:r.steps.length,
    actions:r.steps.filter(s=>['SELECT_IDLECMD','SELECT_CHAIN','SELECT_EFFECTYN','SELECT_CARD'].includes(s.prompt)).map(s=>s.label),
    final:r.final}))};
fs.writeFileSync(new URL('opening-book.json',root),JSON.stringify(book,null,2)+'\n');
const lines=['# 固定M∀LICE：1枚初動の展開帳','',book.scope,'',`分類 ${classifications.length} 種類／検証ルート ${routes.length} 件／初期分岐などの確認 ${probes.length} 件。全記録を実coreで再生し、各選択前の要求・カード配置・LPと最終盤面のハッシュ、選択ラベルを確認。`,'',
  'ドロー結果に依存する例と、追加の捨て札を要する例は確定1枚初動に数えない。','',
  '| カード | 採用枚数 | 分類 | 根拠 |','|---|---:|---|---|'];
const labels={'standalone-starter':'1枚初動','one-card':'1枚初動','not-one-card':'単独初動にならない','hand-cost-starter':'追加の捨て札で伸びる初動','conditional-extender':'条件付きの展開札','limited-one-card-line':'単独で小展開','hand-trap':'手札誘発','one-card-starter':'1枚初動','draw-dependent':'ドロー依存','not-starter':'単独初動にならない'};
for(const c of classifications)lines.push(`| ${c.name||cards[c.code].name} | ${preset.main.filter(x=>x===c.code).length} | ${labels[c.classification]||c.classification} | ${String(c.reason||'').replaceAll('|','／').replaceAll('\n',' ')} |`);
for(const r of book.routes) {
  lines.push('',`## ${r.name||r.id}`,'',`ID: ${r.id} ／ 初期手札: ${r.hand.map(c=>cards[c].name).join('、')}`,'',
    `条件: ${typeof r.conditions==='string'?r.conditions:JSON.stringify(r.conditions||[])}`,'',
    `${typeof r.summary==='string'?r.summary:JSON.stringify(r.summary||[])}`,'',
    `自分LP: ${r.final.lp[0]} ／ モンスター: ${r.final.players[0].monsters.filter(Boolean).map(c=>cards[c.code]?.name||'?').join('、')||'なし'}`,'',
    `魔法・罠: ${r.final.players[0].spells.filter(Boolean).map(c=>cards[c.code]?.name||'?').join('、')||'なし'}`,'',
    '<details><summary>検証した主要選択</summary>','',...r.actions.map((a,i)=>`${i+1}. ${a}`),'','</details>');
}
fs.writeFileSync(new URL('docs/ONE_CARD_OPENINGS.md',root),lines.join('\n')+'\n');
console.log(`Built ${routes.length} replayed routes, ${probes.length} replayed probes, ${classifications.length} classified cards`);
