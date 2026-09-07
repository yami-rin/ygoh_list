// Compatibility fixes for the pinned MIT wrapper 0.1.2, not game rules.
// OCG_CardData wasm32 layout: lscale@40, rscale@44, link_marker@48.
// Source: https://github.com/edo9300/ygopro-core/blob/master/ocgapi_types.h
import fs from 'node:fs';
const file=new URL('../node_modules/ocgcore-wasm/dist/index.js',import.meta.url);
let s=fs.readFileSync(file,'utf8');
const patches=[
 ['e.setUint32(48,t.rscale??0,!0),e.setUint32(52,t.link_marker??0,!0)):', 'e.setUint32(44,t.rscale??0,!0),e.setUint32(48,t.link_marker??0,!0)):'],
 ['else if(s===u.ALIAS&&o===4)', 'else if(s===u.TYPE&&o===4)t.type=e.u32();else if(s===u.ALIAS&&o===4)'],
 ['return new Uint8Array(o)}u8()', 'return this.off+=t,new Uint8Array(o)}u8()'],
];
if(!s.includes('/* Astra Duel Lab wrapper fixes */')) {
  for(const [before,after] of patches){if(!s.includes(before))throw new Error('Core wrapper changed; review compatibility patch');s=s.replace(before,after);}
  fs.writeFileSync(file,'/* Astra Duel Lab wrapper fixes */\n'+s);
}
