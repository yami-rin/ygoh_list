import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSourceDocuments,buildSearchReport} from '../scripts/build-search-report.mjs';

const snapshot=loadSourceDocuments();
const build=documents=>buildSearchReport({...snapshot,documents},{generatedAt:'2026-09-08T00:00:00.000Z'});
const changed=(name,change)=>({...snapshot.documents,[name]:change(structuredClone(snapshot.documents[name]))});

test('real publications assign every preset card exactly once and keep total completion conservative',()=>{
  const result=build(snapshot.documents);
  assert.deepEqual(result.starters.map(row=>row.code),[...new Set(snapshot.preset.main)]);
  assert.equal(result.starters.reduce((n,row)=>n+row.copies,0),snapshot.preset.main.length);
  assert.equal(result.sources.length,9);
  assert.equal(result.complete,false,'Current chance publications do not prove all later gameplay');
  assert.equal(result.totals.cumulativeVisited,result.starters.reduce((n,row)=>n+row.work.visited,0)+result.chance.optional.work.visited);
});

test('a mismatched preset source is rejected rather than silently mixed',()=>{
  const documents=changed('exhaustive-rabbit.json',value=>(value.presetHash='0'.repeat(64),value));
  assert.throws(()=>build(documents),/presetHash mismatch: exhaustive-rabbit/);
});

test('a duplicate or missing starter owner is rejected',()=>{
  const duplicate=changed('exhaustive-others.json',value=>(value.searches.push(structuredClone(value.searches[0])),value));
  assert.throws(()=>build(duplicate),/Duplicate starter assignment/);
  const missing=changed('exhaustive-others.json',value=>(value.searches.shift(),value));
  assert.throws(()=>build(missing),/Missing starter assignments/);
});

test('completed Gold subtrees and top-level claims cannot complete its unresolved root',()=>{
  const documents=changed('exhaustive-gold.json',value=>{
    value.complete=true;
    for(const [key,entry] of Object.entries(value.searches)) {
      entry.summary.complete=key!=='root';entry.summary.frontier=key==='root'?1:0;entry.summary.failures=0;
    }
    return value;
  });
  const row=build(documents).starters.find(entry=>entry.code===75500286);
  assert.equal(row.root.complete,false);
});

test('Allure draw-result completion does not skip the initial set branch',()=>{
  const allDone=changed('allure-continuations.json',value=>{
    value.complete=true;
    for(const job of value.jobs){job.complete=true;job.frontier=0;job.failures=0;}
    return value;
  });
  assert.equal(build(allDone).starters.find(entry=>entry.code===1475311).root.complete,true,'All initial successor kinds must be present in this fixture');
  const documents=changed('allure-continuations.json',value=>{
    value.complete=true;
    for(const job of value.jobs) {
      job.complete=job.kind!=='root-set';job.frontier=job.kind==='root-set'?1:0;job.failures=0;
    }
    return value;
  });
  const result=build(documents);
  assert.equal(result.starters.find(entry=>entry.code===1475311).root.complete,false);
  assert.equal(result.chance.allure.continuationComplete,false);
});

test('missing reverse-order or identical-card banish choices prevent full Allure root coverage',()=>{
  for(const kind of ['after-allure-reverse','after-allure-copy']) {
    const documents=changed('allure-continuations.json',value=>{
      const index=value.jobs.findIndex(job=>job.kind===kind);assert(index>=0,`Published fixture needs ${kind}`);
      value.jobs.splice(index,1);value.complete=true;
      for(const job of value.jobs){job.complete=true;job.frontier=0;job.failures=0;}
      return value;
    });
    const result=build(documents);
    assert.equal(result.starters.find(entry=>entry.code===1475311).root.complete,false);
    assert.equal(result.chance.allure.initialSuccessorsCovered,false);
  }
});

test('duplicate references to the same checkpoint do not double the reported work',()=>{
  const expected=build(snapshot.documents).starters.find(entry=>entry.code===75500286).work;
  const documents=changed('exhaustive-gold.json',value=>{
    value.searches.lastSearchAlias=structuredClone(value.searches.root);return value;
  });
  const actual=build(documents).starters.find(entry=>entry.code===75500286).work;
  assert.equal(actual.visited,expected.visited);
  assert.equal(actual.frontierEntries,expected.frontierEntries);
  assert.equal(actual.terminalHistories,expected.terminalHistories);
});

test('Dormouse partition totals retain initial six terminals without recounting alternative frontiers',()=>{
  const documents=changed('exhaustive-dormouse.json',value=>{
    value.rootAlternatives.firstTurnTerminals=6;value.rootAlternatives.unresolvedFrontier=20;
    value.continuationSearch.rootAlternativeCount=20;
    return value;
  });
  const row=build(documents).starters.find(entry=>entry.code===32061192);
  const initial=row.work.units.filter(unit=>unit.id==='dorm:root-alternatives');
  assert.equal(initial.length,1);assert.equal(initial[0].terminals,6);assert.equal(initial[0].frontier,0);
  assert.equal(row.work.terminalHistories,
    documents['exhaustive-dormouse.json'].deepSearch.entries.reduce((n,entry)=>n+entry.terminalCount,0)+
    documents['exhaustive-dormouse.json'].continuationSearch.terminalCount+6);
});
