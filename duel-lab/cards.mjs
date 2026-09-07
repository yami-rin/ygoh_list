import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const DATA = path.join(ROOT, 'data');
export const cards = JSON.parse(fs.readFileSync(path.join(DATA, 'cards.json'), 'utf8'));
const systemStrings=new Map();
const stringsFile=path.join(DATA,'strings.conf');
if(fs.existsSync(stringsFile))for(const line of fs.readFileSync(stringsFile,'utf8').split('\n')){const m=line.match(/^!system (\d+) (.*)/);if(m)systemStrings.set(Number(m[1]),m[2].trim());}
export const normalize = value => value.normalize('NFKC').replace(/\s/g, '').toLowerCase();
export const byName = new Map();
for (const card of Object.values(cards)) {
  if (!card.alias) for (const name of [card.name, card.enName]) byName.set(normalize(name), card);
}
export function cardInfo(code) {
  const c = cards[code];
  return c ? {code:c.code, name:c.name, text:c.text, cid:c.cid, attack:c.attack, defense:c.defense, type:c.type, level:c.level, attribute:c.attribute, link_marker:c.link_marker} : {code:0, name:'非公開カード'};
}
export function description(value) {
  if (value === undefined) return '';
  const v = BigInt(value), code = Number(v >> 20n), index = Number(v & 0xfffffn);
  return code ? (cards[code]?.strings[index] || `${cards[code]?.name || code}：効果 ${index+1}`) : index===221?'誘発した効果を発動しますか？':(systemStrings.get(index)?.replace(/\[%l?s\]|%\w+/g,'対象') || `選択 ${index}`);
}
export function parseDeck(input, limits = {}) {
  const result = {main:[], extra:[]};
  let section = 'main';
  if (typeof input === 'string') {
    for (const raw of input.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#created')) continue;
      if (line === '#extra' || /^EX(?:TRA)?$/i.test(line)) {section='extra';continue;}
      if (line.startsWith('!side')) break;
      if (line.startsWith('#')) continue;
      const match = line.match(/^(.*?)(?:\s+[x×]?([1-3]))?$/);
      const name = match[1], count = Number(match[2] || 1);
      const c = /^\d+$/.test(name) ? cards[Number(name)] : byName.get(normalize(name));
      if (!c) throw new Error(`カードが見つかりません: ${name}`);
      const canonical = cards[c.alias] || c;
      result[section].push(...Array(count).fill(canonical.code));
    }
  } else {
    for (const key of ['main','extra']) {
      if (!Array.isArray(input?.[key])) throw new Error('main / extra 配列が必要です');
      result[key] = input[key].map(code => cards[code]?.alias || code);
    }
  }
  if (result.main.length < 40 || result.main.length > 60 || result.extra.length > 15) throw new Error('メイン40〜60枚、EX15枚以下にしてください');
  const counts = new Map();
  for (const [section, list] of Object.entries(result)) for (const code of list) {
    const c = cards[code];
    if (!c?.script) throw new Error(`効果スクリプトがありません: ${c?.name || code}`);
    const isExtra = !!(c.type & (0x40 | 0x2000 | 0x800000 | 0x4000000));
    if (isExtra !== (section==='extra')) throw new Error(`デッキ区分が違います: ${c.name}`);
    counts.set(code, (counts.get(code)||0)+1);
    if (counts.get(code) > (limits[normalize(c.name)] ?? 3)) throw new Error(`枚数制限に違反しています: ${c.name}`);
  }
  return result;
}
