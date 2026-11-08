import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

// Drive the MCP server over stdio exactly as a client would.
async function session(calls) {
  const child=spawn(process.execPath,[new URL('../mcp/duel-mcp.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{stdio:['pipe','pipe','inherit']});
  const replies=new Map();let buffer='';
  child.stdout.on('data',d=>{buffer+=d;let i;while((i=buffer.indexOf('\n'))>=0){const m=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);replies.set(m.id,m);}});
  const messages=[{jsonrpc:'2.0',id:0,method:'initialize',params:{protocolVersion:'2025-06-18'}},
    ...calls.map(([name,args],i)=>({jsonrpc:'2.0',id:i+1,method:'tools/call',params:{name,arguments:args}}))];
  for(const m of messages)child.stdin.write(JSON.stringify(m)+'\n');
  child.stdin.end();
  await new Promise(resolve=>child.on('close',resolve));
  return calls.map((_,i)=>replies.get(i+1).result);
}

test('MCP starts a duel, acts by name, undoes and lists history',async()=>{
  const [start,summon,zone,undo,history]=await session([
    ['duel_start',{hand:['Dormouse','霆王','霆王','霆王']}],
    ['duel_act',{option:'召喚：M∀LICE＜P＞Dormouse'}],
    ['duel_act',{select:[0]}],
    ['duel_undo',{steps:1}],
    ['duel_history',{}],
  ]);
  assert.match(start.content[0].text,/0\. 召喚：M∀LICE＜P＞Dormouse/);
  assert.match(summon.content[0].text,/ゾーンを選択/);
  assert.match(zone.content[0].text,/Dormouse を召喚/);
  assert.match(undo.content[0].text,/ゾーンを選択/);
  assert.match(history.content[0].text,/1\. 召喚：M∀LICE＜P＞Dormouse/);
});

test('MCP reports unknown cards and actions as tool errors',async()=>{
  const [bad,ok,wrong]=await session([
    ['duel_start',{hand:['存在しないカード']}],
    ['duel_start',{hand:['Dormouse']}],
    ['duel_act',{option:'アクセスコード'}],
  ]);
  assert.equal(bad.isError,true);
  assert.equal(ok.isError,undefined);
  assert.equal(wrong.isError,true);
});
