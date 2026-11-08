// Original cards: custom/*.json definitions are added to the card pool in memory, and their Lua scripts are
// copied to data/scripts/unofficial/ where the engine already looks. cards.mjs, engine.mjs and data/cards.json
// stay untouched because the search evidence pins their hashes.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,DATA,cards,byName,normalize} from './cards.mjs';

export const CUSTOM=path.join(ROOT,'custom');
export const customCards=[];

if(fs.existsSync(CUSTOM)){
  for(const file of fs.readdirSync(CUSTOM).filter(f=>f.endsWith('.json'))){
    for(const card of JSON.parse(fs.readFileSync(path.join(CUSTOM,file),'utf8')).cards){
      const entry={alias:0,lscale:0,rscale:0,cid:null,script:true,strings:[],...card,custom:file};
      cards[card.code]=entry;
      byName.set(normalize(entry.name),entry);
      if(entry.enName)byName.set(normalize(entry.enName),entry);
      customCards.push(entry);
    }
  }
  const source=path.join(CUSTOM,'scripts'),target=path.join(DATA,'scripts','unofficial');
  if(fs.existsSync(source)&&fs.existsSync(path.join(DATA,'scripts'))){
    fs.mkdirSync(target,{recursive:true});
    for(const lua of fs.readdirSync(source).filter(f=>/^c\d+\.lua$/.test(f))){
      const from=path.join(source,lua),to=path.join(target,lua);
      if(fs.existsSync(to)&&fs.readFileSync(to,'utf8')===fs.readFileSync(from,'utf8'))continue;
      // Parallel test processes copy at the same time: write aside and rename so no process reads a half-written script.
      const tmp=`${to}.${process.pid}.tmp`;
      fs.copyFileSync(from,tmp);
      try{fs.renameSync(tmp,to);}catch(e){fs.rmSync(tmp,{force:true});if(!fs.existsSync(to))throw e;}
    }
  }
}
