import {cardInfo,cards} from './cards.mjs';

// Card rules occur once per code. Dynamic zone/position/status fields stay in place.
export function compactNativePayload(input) {
  const catalog={};
  function visit(value) {
    if(Array.isArray(value))return value.map(visit);
    if(!value || typeof value!=='object')return value;
    const result=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v)]));
    if(Number.isInteger(value.code)&&value.code>0) {
      catalog[value.code] ??= cardInfo(value.code);
    }
    if(Number.isInteger(value.description)) {
      const code=Math.floor(value.description/16),offset=value.description%16;
      result.effectText=cards[code]?.strings?.[offset] || `選択 ${value.description}`;
    }
    return result;
  }
  const state=visit(input);
  return {cardCatalog:catalog,...state};
}
