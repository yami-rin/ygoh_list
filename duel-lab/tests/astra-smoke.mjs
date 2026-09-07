// Explicit live integration test. Consumes Codex usage; excluded from npm test.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Duel} from '../engine.mjs';
import {Astra,MODEL} from '../astra.mjs';
const deck=JSON.parse(fs.readFileSync(new URL('../preset.json',import.meta.url)));
const g=await Duel.create([deck,deck],{seed:123,first:1}),a=new Astra(),evidence=[];
try {
 for(let i=0;i<6&&g.status==='playing';i++) {
  if(g.snapshot().waitingFor===0){
   const pass=g.prompt.choices.find(c=>c.label==='発動しない'||c.response.yes===false);
   if(!pass)break;g.respond(0,g.revision,{action:pass.id});continue;
  }
  const type=g.prompt.type,rev=g.revision;
  const input=await a.choose(g);
  const label=g.prompt.choices.find(c=>c.id===input.action)?.label || g.prompt.title;
  g.respond(1,rev,input);assert.equal(g.validationError,null);assert.equal(g.errors.length,0);
  evidence.push({model:MODEL,type,label,elapsedMs:a.lastMs,result:'accepted'});
  console.log(JSON.stringify(evidence.at(-1)));
 }
 assert(evidence.length>=3);
 fs.mkdirSync(new URL('./artifacts/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('./artifacts/astra-smoke.json',import.meta.url),JSON.stringify(evidence,null,2));
}finally{a.stop();g.close();}
