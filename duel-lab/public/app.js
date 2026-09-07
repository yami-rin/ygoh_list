const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let config,state,revision=-1,selected=[],busy=false,inspected=null,lastLog=0;
let imageIds=new Set(),cardIndex=new Map();
const typeClass=c=>c.type&4?'trap':c.type&2?'spell':c.type&0x4000000?'link':c.type&0x800000?'xyz':c.type&0x2000?'synchro':c.type&0x40?'fusion':c.type&0x80?'ritual':'';
function art(c){return imageIds.has(String(c.cid))?`<img class="art" src="/images/${c.cid}.png" alt="${esc(c.name)}" loading="lazy">`:'<span class="art-fallback">◇</span>';}
function card(c,extra='') {
  if(!c)return '';
  if(c.hidden)return '<div class="card-back" aria-label="非公開カード"></div>';
  cardIndex.set(c.code,c);
  const stats=c.type&1?`ATK ${c.attack??'?'} / ${c.type&0x4000000?'LINK '+(c.link?.rating||c.level):'DEF '+(c.defense??'?')}`:c.type&2?'SPELL':'TRAP';
  const markers=c.link?.marker||c.link_marker||0;
  const arrows=c.type&0x4000000?`<span class="link-arrows">${[[1,'bl'],[2,'b'],[4,'br'],[8,'l'],[32,'r'],[64,'tl'],[128,'t'],[256,'tr']].filter(([bit])=>markers&bit).map(([,dir])=>`<i class="${dir}">▲</i>`).join('')}</span>`:'';
  return `<button class="mini-card ${typeClass(c)} ${extra}" data-card="${c.code}" title="${esc(c.name)}" aria-label="${esc(c.name)}"><span class="name">${esc(c.name)}</span>${art(c)}${arrows}<span class="stats">${stats}</span></button>`;
}
function inspect(code) {
  const c=cardIndex.get(Number(code));if(!c)return;inspected=c;
  $('preview').className='';$('preview').innerHTML=card(c);$('card-name').textContent=c.name;
  $('card-stats').textContent=c.type&1?`ATK ${c.attack}  /  ${c.type&0x4000000?'LINK '+(c.link?.rating||c.level):'DEF '+c.defense}`:'魔法・罠';
  $('card-text').textContent=c.text;
  $('image-source').textContent=imageIds.has(String(c.cid))?'画像：このPCのMaster Duelから抽出':'MD画像未取得：名前と効果全文で表示';
  if(matchMedia('(max-width:1150px)').matches) {
    $('pile-title').textContent=c.name;$('pile-cards').innerHTML=`<div style="max-width:600px;line-height:1.9">${card(c)}<p>${esc(c.text)}</p></div>`;
    if(!$('pile-dialog').open)$('pile-dialog').showModal();
  }
}
function zone(c,label,player,location,sequence,kind='') {
  const p=state?.prompt;
  const allowed=p?.cards?.findIndex(x=>x.place?.player===player && x.place.location===location&&x.place.sequence===sequence)??-1;
  return `<div class="zone ${!c?'empty ':''}${kind}${allowed>=0?' allowed':''}" ${allowed>=0?`data-place="${allowed}"`:''}>${c?card(c,(c.position&12)&&!c.hidden?'defense':''):''}<span class="zone-label">${label}</span></div>`;
}
function pile(player,key,label,kind='') {
  const list=state?.players?.[player]?.[key]?.filter(Boolean)||[];
  return `<button class="zone pile ${kind}" data-pile="${player}:${key}" aria-label="${label} ${list.length}枚"><span class="zone-label">${label}</span><span class="count">${list.length}</span>${list.length?'<span class="card-back"></span>':''}</button>`;
}
function half(player) {
  const p=state?.players?.[player]||{monsters:[],spells:[],deckCount:0};
  const indices=player===1?[4,3,2,1,0]:[0,1,2,3,4];
  const mrow=`<div class="zone-row">${pile(player,'grave','GRAVE','grave')}${indices.map(i=>zone(p.monsters[i],`M${i+1}`,player,4,i)).join('')}${pile(player,'banished','BANISH','banished')}</div>`;
  const srow=`<div class="zone-row">${pile(player,'extra','EX DECK','extra')}${indices.map(i=>zone(p.spells[i],`S${i+1}`,player,8,i)).join('')}<div class="zone pile"><span class="zone-label">DECK</span><span class="count">${p.deckCount}</span><span class="card-back"></span></div></div>`;
  const fzone=`<div class="field-spell">${p.spells[5]?`<button data-card="${p.spells[5].code}">FIELD：${esc(p.spells[5].name||'伏せカード')}</button>`:''}</div>`;
  return (player===1?srow+mrow:mrow+srow)+fzone;
}
function renderBoard() {
  cardIndex=new Map();
  $('enemy-field').innerHTML=half(1);$('your-field').innerHTML=half(0);
  $('extra-zones').innerHTML=[0,1].map(i=>{
    const own=state?.players?.[0]?.monsters?.[5+i],opp=state?.players?.[1]?.monsters?.[6-i];
    return zone(own||opp,`EX ${i+1}`,own?0:opp?1:0,4,own?5+i:opp?6-i:5+i,'extra');
  }).join('');
  $('enemy-hand').innerHTML=(state?.players?.[1]?.hand||[]).filter(Boolean).map(c=>c.hidden?'<div class="card-back" aria-label="相手の手札（非公開）"></div>':card(c)).join('');
  $('your-hand').innerHTML=(state?.players?.[0]?.hand||[]).filter(Boolean).map(c=>card(c)).join('');
  for(const p of state?.players||[]) {$('lp-'+p.player).textContent=p.lp;$('lp-fill-'+p.player).style.width=Math.max(0,Math.min(100,p.lp/80))+'%';}
  $('turn-label').textContent=`TURN ${state?.turn||'—'}`;$('phase').textContent=state?.phase||'STANDBY';
  $('priority').textContent=state?.waitingFor===0?'YOUR ACTION':state?.turnPlayer===0?'YOUR TURN':'WAIT';
  document.querySelectorAll('.phase-track span').forEach(el=>el.classList.toggle('active',el.textContent===state?.phase));
  $('chain').innerHTML=(state?.chain||[]).map(c=>`<span>CHAIN ${c.size}<br>${esc(cardIndex.get(c.code)?.name||'効果発動')}</span>`).join('');
  if(inspected){const c=cardIndex.get(inspected.code)||inspected;$('preview').innerHTML=card(c);}
}
function renderActions() {
  const p=state?.prompt;
  $('selection-footer').innerHTML='';
  if(state?.status==='ended') {$('prompt-title').textContent='DUEL FINISHED';$('prompt-sub').textContent='ログを保存するか、新しい対戦を始められます。';$('actions').innerHTML=`<div class="result">${state.winner===0?'YOU WIN':state.winner===1?'ASTRA WIN':'DRAW'}</div><button id="rematch">もう一度対戦</button>`;return;}
  if(state?.ai?.status==='paused') {$('prompt-title').textContent='Astraの応答待ち';$('prompt-sub').textContent=state.ai.error;$('actions').innerHTML='<button id="retry-ai">Astraに再接続</button>';return;}
  if(state?.status==='error'){$('prompt-title').textContent='効果処理を停止しました';$('prompt-sub').textContent=state.error||'ログを保存してエラーを確認してください。';$('actions').innerHTML='';return;}
  if(!p){$('prompt-title').textContent=state?.status==='playing'?'Astraが考えています':'デュエルを始めよう';$('prompt-sub').textContent=state?.status==='playing'?'相手の判断を待っています。盤面とカードの効果は確認できます。':'上の「デッキ・新規対戦」から開始できます。';$('actions').innerHTML=state?.status==='playing'?'<div class="waiting">ASTRA THINKING</div>':'';return;}
  $('prompt-title').textContent=p.title;
  $('prompt-sub').textContent=state.validationError || (p.mode==='multi'?`${p.min}〜${p.max}枚を選び、確定してください。`:p.mode==='order'?'希望する順番にクリックして確定。再クリックで解除。':'実行したい行動を選んでください。');
  if(p.mode==='single') {
    $('actions').innerHTML=p.choices.map(c=>{if(c.card)cardIndex.set(c.card.code,c.card);return `<button data-action="${c.id}" class="card-choice">${c.card&&imageIds.has(String(c.card.cid))?`<img src="/images/${c.card.cid}.png" alt="">`:''}<span>${esc(c.label)}${c.card?`<small>${esc(c.card.detail||'')}</small>`:''}</span></button>`;}).join('');
  } else {
    if(p.mode==='announce')$('actions').innerHTML='<input id="announce-filter" class="filter-input" aria-label="宣言するカード名" placeholder="カード名で絞り込み"><div id="announce-options"></div>';
    else $('actions').innerHTML=p.cards.map((c,i)=>{if(c.code)cardIndex.set(c.code,c);return `<button data-select="${i}" class="${selected.includes(i)?'selected':''}">${p.mode==='order'&&selected.includes(i)?`${selected.indexOf(i)+1}. `:''}${esc(c.label)}${c.detail?`<small>${esc(c.detail)}</small>`:''}${p.mode==='counter'?`<input data-counter="${i}" type="number" min="0" max="${c.count}" value="0">`:''}</button>`;}).join('');
    $('selection-footer').innerHTML='<button id="confirm" class="primary">選択を確定</button>'+(p.canCancel?'<button id="cancel-selection">キャンセル</button>':'');
    if(p.mode==='announce')renderAnnounce('');
  }
}
function renderAnnounce(q){const p=state.prompt;$('announce-options').innerHTML=p.cards.map((c,i)=>({...c,index:i})).filter(c=>c.label.normalize('NFKC').toLowerCase().includes(q.normalize('NFKC').toLowerCase())).slice(0,60).map(c=>`<button data-select="${c.index}" class="${selected.includes(c.index)?'selected':''}">${esc(c.label)}</button>`).join('');}
function applyState(next) {
  const changed=next.revision!==revision || next.status!==state?.status || next.ai?.status!==state?.ai?.status;
  state=next;
  $('ai-state').textContent=state.ai?.status==='thinking'?'THINKING':state.ai?.status==='paused'?'PAUSED':'CONNECTED';
  $('connection').textContent=`GPT-6 Astra · ${state.ai?.calls||0} 回の判断${state.ai?.lastMs?' · 前回 '+Math.round(state.ai.lastMs/1000)+'秒':''}`;
  if(changed){if(revision!==next.revision)selected=[];revision=next.revision;renderBoard();renderActions();}
  const log=state.log||[];
  if(log.at(-1)?.id!==lastLog){lastLog=log.at(-1)?.id||0;$('log').innerHTML=log.map(e=>`<li class="${esc(e.event||'')}">${esc(e.text)}</li>`).join('');$('log').scrollTop=$('log').scrollHeight;$('log-count').textContent=lastLog;}
}
async function api(route,data) {
  const res=await fetch('/api/'+route,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Duel-Token':config.csrf},body:JSON.stringify(data)});
  const result=await res.json();if(!res.ok)throw new Error(result.error||'接続エラー');return result;
}
function toast(text){$('toast').hidden=false;$('toast').textContent=text;setTimeout(()=>$('toast').hidden=true,6500);}
async function act(input) {
  if(busy)return;busy=true;
  const buttons=[...$('actions').querySelectorAll('button'),...$('selection-footer').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{applyState(await api('action',{revision,...input}));}catch(e){toast(e.message);}finally{busy=false;buttons.forEach(b=>b.disabled=false);}
}
document.addEventListener('click',async e=>{
  const action=e.target.closest('[data-action]');if(action){await act({action:Number(action.dataset.action)});return;}
  const select=e.target.closest('[data-select]');if(select && !e.target.matches('input')){const i=Number(select.dataset.select);if(selected.includes(i))selected=selected.filter(x=>x!==i);else selected.push(i);if(state.prompt.mode==='announce'){selected=[i];renderAnnounce($('announce-filter').value);}else renderActions();return;}
  const place=e.target.closest('[data-place]');if(place){selected=[Number(place.dataset.place)];renderActions();return;}
  const c=e.target.closest('[data-card]');if(c){inspect(c.dataset.card);return;}
  const pile=e.target.closest('[data-pile]');if(pile){const [p,key]=pile.dataset.pile.split(':');$('pile-title').textContent=`${p==='0'?'あなた':'Astra'} / ${key}`;$('pile-cards').innerHTML=state.players[p][key].filter(Boolean).map(c=>card(c)).join('')||'カードはありません';$('pile-dialog').showModal();return;}
  if(e.target.id==='confirm')await act({selection:selected,counters:[...$('actions').querySelectorAll('[data-counter]')].map(el=>Number(el.value))});
  if(e.target.id==='cancel-selection')await act({cancel:true});
  if(e.target.id==='retry-ai'){try{applyState(await api('retry',{}));}catch(err){toast(err.message);}}
  if(e.target.id==='rematch')$('setup').showModal();
});
document.addEventListener('input',e=>{if(e.target.id==='announce-filter')renderAnnounce(e.target.value);});
$('new-game').onclick=()=>$('setup').showModal();$('close-setup').onclick=()=>$('setup').close();$('close-pile').onclick=()=>$('pile-dialog').close();
$('start').onclick=async()=>{
  if(busy)return;busy=true;$('start').disabled=true;$('setup-error').textContent='';
  try{const s=await api('start',{human:$('human-deck').value,opponent:$('astra-deck').value,first:Number($('first').value)});$('setup').close();lastLog=0;revision=-1;applyState(s);}catch(e){$('setup-error').textContent=e.message;}finally{busy=false;$('start').disabled=false;}
};
$('surrender').onclick=async()=>{if(state?.status!=='playing')return;if(!confirm('降参してこのデュエルを終了しますか？'))return;try{applyState(await api('surrender',{}));}catch(e){toast(e.message);}};
$('save-log').onclick=async()=>{try{const data=await api('log');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='astra-duel-log.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){toast(e.message);}};
function deckText(p){const lines=[];for(const key of ['main','extra']){lines.push('#'+key);const counts=new Map();for(const c of p[key])counts.set(c.name,(counts.get(c.name)||0)+1);for(const [name,n]of counts)lines.push(`${name} ${n}`);}return lines.join('\n');}
try {
  config=await api('config');imageIds=new Set(config.imageIds);const text=deckText(config.preset);
  $('human-deck').value=text;$('astra-deck').value=text;$('human-count').textContent=$('astra-count').textContent='プリセット：メイン40 / EX15';
  applyState(await api('state'));if(state.status==='setup')$('setup').showModal();
  setInterval(async()=>{if(busy)return;try{applyState(await api('state'));}catch{$('connection').textContent='サーバーとの接続が切れました。起動状態を確認してください。';}},1200);
}catch(e){toast(e.message);}
