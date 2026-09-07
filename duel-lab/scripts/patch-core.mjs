// Compatibility fixes for the pinned MIT wrapper 0.1.2, not game rules.
// OCG_CardData wasm32 layout: lscale@40, rscale@44, link_marker@48.
// Source: https://github.com/edo9300/ygopro-core/blob/master/ocgapi_types.h
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const file=new URL('../node_modules/ocgcore-wasm/dist/index.js',import.meta.url);
const legacyPatches=[
 ['e.setUint32(48,t.rscale??0,!0),e.setUint32(52,t.link_marker??0,!0)):', 'e.setUint32(44,t.rscale??0,!0),e.setUint32(48,t.link_marker??0,!0)):'],
 ['else if(s===u.ALIAS&&o===4)', 'else if(s===u.TYPE&&o===4)t.type=e.u32();else if(s===u.ALIAS&&o===4)'],
 ['return new Uint8Array(o)}u8()', 'return this.off+=t,new Uint8Array(o)}u8()'],
];

// Core wire contract: playerop.cpp SelectSum writes mandatory cards first,
// then optional cards, both with the complete get_info_location() record.
// SortCard/SortChain reads one rank byte per card, without a length prefix.
// https://github.com/edo9300/ygopro-core/blob/master/playerop.cpp
const protocolPatches=[
 ['case 23:return{type:t,player:e.u8(),select_max:e.u8(),amount:e.u32(),min:e.u32(),max:e.u32(),selects:Array.from({length:e.u32()},()=>({code:e.u32(),controller:e.u8(),location:e.u8(),sequence:e.u32(),amount:e.u32()})),selects_must:Array.from({length:e.u32()},()=>({code:e.u32(),controller:e.u8(),location:e.u8(),sequence:e.u32(),amount:e.u32()}))};',
  'case 23:return{type:t,player:e.u8(),select_max:e.u8(),amount:e.u32(),min:e.u32(),max:e.u32(),selects_must:Array.from({length:e.u32()},()=>({code:e.u32(),...p(e),amount:e.u32()})),selects:Array.from({length:e.u32()},()=>({code:e.u32(),...p(e),amount:e.u32()}))};'],
 ['case 15:if(!e.order){t.i8(-1);break}t.i8(e.order.length);for(let r of e.order)t.i8(r);break;',
  'case 15:if(!e.order){t.i8(-1);break}for(let r of e.order)t.i8(r);break;'],
];

export function patchCoreWrapper(source) {
 let s=source;
 for(const [marker,patches] of [
  ['/* Astra Duel Lab wrapper fixes */',legacyPatches],
  ['/* Astra Duel Lab SUM SORT protocol fixes v1 */',protocolPatches],
 ]) {
  if(s.includes(marker)) {
   for(const [,after] of patches)if(!s.includes(after))throw new Error(`Core wrapper marker does not match installed patch: ${marker}`);
   continue;
  }
  for(const [before,after] of patches) {
   if(s.split(before).length!==2)throw new Error(`Core wrapper changed; review compatibility patch: ${marker}`);
   s=s.replace(before,after);
  }
  s=marker+'\n'+s;
 }
 return s;
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url) {
 const before=fs.readFileSync(file,'utf8'),after=patchCoreWrapper(before);
 if(after!==before)fs.writeFileSync(file,after);
}
