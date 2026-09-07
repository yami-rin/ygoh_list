import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startRoute,replay,preset,hash} from '../scripts/route-harness.mjs';

test('one-card fixture preserves the preset inventory',async()=>{
  const code=preset.main[0],g=await startRoute([code]);
  try {
    assert.equal(g.decks[0].main.length,39);
    assert.equal(g.snapshot().players[0].hand.filter(Boolean).length,1);
    assert.equal(g.decks[0].main.filter(x=>x===code).length,2);
  }finally{g.close();}
  await assert.rejects(startRoute([code,code,code,code]),/Hand must/);
});

test('opening book covers all main cards and rejects stale route evidence',async()=>{
  const book=JSON.parse(fs.readFileSync(new URL('../opening-book.json',import.meta.url)));
  assert.equal(book.presetHash,hash(preset));
  assert.deepEqual(book.classifications.map(c=>c.code).sort((a,b)=>a-b),[...new Set(preset.main)].sort((a,b)=>a-b));
  const groups=['malice-monsters','spell-starters','cyberse-starters'].map(name=>
    JSON.parse(fs.readFileSync(new URL(`../routes/${name}.json`,import.meta.url))));
  const originals=groups.flatMap(g=>g.routes);
  assert.deepEqual(book.routes.map(r=>r.id).sort(),originals.map(r=>r.id).sort(),'Published book must contain every verified route');
  for(const original of originals) {
    const published=book.routes.find(r=>r.id===original.id);
    for(const key of ['hand','final','conditions','summary','requiresDraw'])assert.deepEqual(published[key],original[key],`Published ${original.id}/${key} is stale`);
  }
  const probes=groups.flatMap(g=>g.probes||[]).concat(groups.flatMap(g=>g.classifications.flatMap(c=>c.verification?[c.verification]:[])));
  assert.deepEqual(book.probes.map(p=>p.id).sort(),probes.map(p=>p.id).sort());
  const source=JSON.parse(fs.readFileSync(new URL('../routes/cyberse-starters.json',import.meta.url)));
  const route=source.routes[0];
  await assert.rejects(replay({...route,presetHash:'stale'}),/Preset changed/);
  const altered=structuredClone(route);altered.steps[0].before='invalid';
  await assert.rejects(replay(altered),/Route state drift/);
  const fakeBoard=structuredClone(route);fakeBoard.final.lp[0]=99999;
  await assert.rejects(replay(fakeBoard),/Stored final board/);
  const fakeLabel=structuredClone(route);fakeLabel.steps[0].label='架空の展開';
  await assert.rejects(replay(fakeLabel),/Stored decision label/);
});
