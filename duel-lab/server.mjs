import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {ROOT,DATA,cards,cardInfo,parseDeck} from './cards.mjs';
import {Duel} from './engine.mjs';
import {Astra,MODEL} from './astra.mjs';

const port=Number(process.env.DUEL_PORT || 8787);
const limits=JSON.parse(fs.readFileSync(path.join(ROOT,'limits-202607.json'),'utf8'));
const preset=JSON.parse(fs.readFileSync(path.join(ROOT,'preset.json'),'utf8'));
const csrf=crypto.randomBytes(24).toString('hex');
let duel=null,astra=new Astra(),aiState='idle',aiError=null,epoch=0,creating=false;
let imageManifest={};
function refreshImages(){try{imageManifest=JSON.parse(fs.readFileSync(path.join(DATA,'images.json'),'utf8'));}catch{}}
refreshImages();
const serialize=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v);
const state=()=>({...(duel?duel.snapshot(0):{status:'setup'}),ai:{model:MODEL,status:aiState,error:aiError,calls:astra.calls,lastMs:astra.lastMs},imageCount:Object.keys(imageManifest).length});
async function runAI() {
  if(!duel||aiState==='thinking'||aiState==='paused'||duel.status!=='playing'||duel.snapshot().waitingFor!==1)return;
  const current=duel,run=epoch;aiState='thinking';aiError=null;
  try {
    let forced=0;
    while(current===duel && run===epoch && current.status==='playing' && current.snapshot().waitingFor===1) {
      const revision=current.revision;
      let input;
      const p=current.prompt;
      if(p.mode==='single'&&p.choices.length===1 && forced++<20)input={action:p.choices[0].id};
      else {input=await astra.choose(current);forced=0;}
      if(current!==duel||run!==epoch)return;
      current.respond(1,revision,input);
      if(current.validationError)throw new Error('Astraの選択がエンジンに拒否されました。再試行してください');
    }
    if(run===epoch)aiState='idle';
  }catch(e){if(run===epoch){aiError=e.message;aiState='paused';}}
}
function send(res,code,value){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(serialize(value));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>100000)throw new Error('入力が大きすぎます');}return JSON.parse(text||'{}');}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
export const server=http.createServer(async(req,res)=>{
  try {
    const host=req.headers.host;
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host))return send(res,403,{error:'Local requests only'});
    const u=new URL(req.url,'http://'+host);
    if(req.method==='POST') {
      if(req.headers['x-duel-token']!==csrf)return send(res,403,{error:'画面を再読込してください'});
      if(req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin))return send(res,403,{error:'Origin rejected'});
      const input=await body(req);
      if(u.pathname==='/api/start') {
        if(creating)throw new Error('デュエル準備中です');
        const decks=[parseDeck(input.human||preset,limits),parseDeck(input.opponent||preset,limits)];
        if(![0,1].includes(input.first??0))throw new Error('先後が無効です');
        creating=true;epoch++;astra.stop();duel?.close();duel=null;astra=new Astra();aiState='idle';aiError=null;
        try{duel=await Duel.create(decks,{first:input.first??0,seed:crypto.randomInt(1,0x7fffffff)});}finally{creating=false;}
        send(res,200,state());void runAI();return;
      }
      if(!duel)throw new Error('デュエルを開始してください');
      if(u.pathname==='/api/action'){duel.respond(0,input.revision,input);send(res,200,state());void runAI();return;}
      if(u.pathname==='/api/retry'){if(aiState!=='paused')throw new Error('再試行待ちではありません');aiState='idle';send(res,200,state());void runAI();return;}
      if(u.pathname==='/api/surrender'){epoch++;astra.stop();duel.surrender(0);aiState='idle';send(res,200,state());return;}
      return send(res,404,{error:'Unknown action'});
    }
    if(u.pathname==='/api/config'){refreshImages();return send(res,200,{csrf,model:MODEL,preset:{main:preset.main.map(cardInfo),extra:preset.extra.map(cardInfo)},imageIds:Object.keys(imageManifest),regulation:'2026年7月1日適用'});}
    if(u.pathname==='/api/state')return send(res,200,state());
    if(u.pathname==='/api/log')return send(res,200,{model:MODEL,regulation:'202607',...state(),exportedAt:new Date().toISOString()});
    if(u.pathname==='/api/cards'){const q=u.searchParams.get('q')||'';return send(res,200,Object.values(cards).filter(c=>!c.alias&&c.name.normalize('NFKC').toLowerCase().includes(q.normalize('NFKC').toLowerCase())).slice(0,50).map(cardInfo));}
    let file;
    if(/^\/images\/\d+\.png$/.test(u.pathname))file=path.join(DATA,u.pathname.slice(1));
    else if(u.pathname==='/')file=path.join(ROOT,'public/index.html');
    else if(/^\/[a-z-]+\.(js|css)$/.test(u.pathname))file=path.join(ROOT,'public',u.pathname.slice(1));
    if(!file||!fs.existsSync(file))return send(res,404,{error:'Not found'});
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});
    fs.createReadStream(file).pipe(res);
  } catch(e){send(res,400,{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Astra Duel Lab: http://127.0.0.1:${port}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{epoch++;astra.stop();duel?.close();server.close();});
