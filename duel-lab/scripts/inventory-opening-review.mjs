// Quality-review inventory only. Never converts a card score into interruptions.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT,cards} from '../cards.mjs';
import {hash,preset} from './route-harness.mjs';
import {pairs,searchIdentity} from './search-multi-pairs-tribute.mjs';

const records=[],sources=[];
const read=file=>{const bytes=fs.readFileSync(file,'utf8');sources.push({path:path.relative(ROOT,file).replaceAll('\\','/'),hash:hash(bytes)});return JSON.parse(bytes);};
const names=list=>list.filter(Boolean).map(c=>({code:c.code,name:cards[c.code]?.name??String(c.code),position:c.position}));
for(let shard=0;shard<8;shard++){
  const dir=path.join(ROOT,`runtime/multi-pair-search-tribute/shard-${shard}`);
  assert(!fs.existsSync(path.join(dir,'.search.lock')),'Do not inventory an active shard');
  const summary=read(path.join(dir,'summary.json')),book=read(path.join(dir,'best-routes.json'));
  assert.equal(summary.sourceHash,searchIdentity.sourceHash);
  assert.equal(book.sourceHash,searchIdentity.sourceHash);
  assert.equal(summary.presetHash,hash(preset));assert.equal(book.presetHash,hash(preset));
  assert.equal(summary.generation,hash(summary.pairs));assert.equal(book.generation,summary.generation);
  assert.deepEqual(summary.pairs.map(p=>p.index),pairs.filter(p=>p.index%8===shard).map(p=>p.index));
  assert.equal(new Set(book.routes.map(r=>r.pairIndex)).size,book.routes.length);
  for(const row of summary.pairs){
    const route=book.routes.find(r=>r.pairIndex===row.index);
    assert.equal(Boolean(route),Boolean(row.bestPlayable));
    if(route){assert.equal(route.finalHash,hash(route.final));assert.equal(route.finalHash,row.bestPlayable.finalHash);assert.deepEqual(route.hand,pairs[row.index].hand);}
    const own=route?.final.players[0],monsters=own?.monsters.filter(Boolean)??[];
    records.push({pairIndex:row.index,hand:row.hand,names:row.names,
      searchTreeComplete:row.completeWithinNoDrawScope,unresolved:row.unresolved,
      route:route?{id:route.id,finalHash:route.finalHash,legacyScore:route.score,inputs:route.steps.length,
        monsters:names(own.monsters),spells:names(own.spells),hand:names(own.hand),grave:names(own.grave),banished:names(own.banished)}:null,
      reviewStatus:route?'requires-opponent-turn-resolution-test':'requires-alternative-candidate-review',
      verifiedJointInterruptions:null,maximumProven:false,
      flags:monsters.length===1&&monsters[0].code===65741786?['sole-IP-requires-material-supply-check']:[]});
  }
}
records.sort((a,b)=>a.pairIndex-b.pairIndex);
assert.equal(records.length,333);assert.equal(new Set(records.map(r=>r.pairIndex)).size,333);
for(const source of sources)assert.equal(hash(fs.readFileSync(path.join(ROOT,source.path),'utf8')),source.hash,'Inventory sources changed');
const result={schema:'malice-interruption-review-inventory-v1',generatedAt:new Date().toISOString(),
  goal:'docs/OPENING_REVIEW_GOAL.md',presetHash:hash(preset),sourceIdentity:searchIdentity,
  scope:'Inventory of current saved representatives, not replays or interruption counts. Old best scores do not establish quality. Missing routes do not prove zero interruptions.',
  summary:{pairs:records.length,savedRepresentatives:records.filter(r=>r.route).length,
    soleIP:records.filter(r=>r.flags.length).length,qualityReviewed:0,maximumProven:0,
    searchTreeComplete:records.filter(r=>r.searchTreeComplete).length},sources,pairs:records};
fs.writeFileSync(path.join(ROOT,'docs/OPENING_REVIEW_BASELINE.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.summary));
