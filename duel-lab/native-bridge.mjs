import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Astra} from './astra.mjs';
import {ROOT} from './cards.mjs';
import {compactNativePayload} from './native-payload.mjs';
import {loadOpeningTemplates,NativeOpeningPolicy} from './opening-policy.mjs';

// Only the native WindBot client's visible state enters this process.
// It never reads the local duel server's complete game state.
export async function startNativeBridge({astra=new Astra(),onDecision=()=>{},port=8788,configPath=path.join(ROOT,'runtime','astra-bridge.json')}={}) {
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local bridge port');
const productionConfig=path.resolve(ROOT,'runtime','astra-bridge.json');
configPath=path.resolve(configPath);
if(port!==8788&&configPath.toLowerCase()===productionConfig.toLowerCase())throw new Error('A test bridge requires a separate configPath');
const token=crypto.randomBytes(32).toString('hex');
const openings=new NativeOpeningPolicy(await loadOpeningTemplates());
let busy=false;
let session=null;
const runtime=path.join(ROOT,'runtime');
fs.mkdirSync(runtime,{recursive:true});
fs.mkdirSync(path.dirname(configPath),{recursive:true});
let boundPort=port;
const server=http.createServer(async(req,res)=>{
  const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  if(req.headers.host!==`127.0.0.1:${boundPort}` || req.headers.origin || req.headers['x-astra-token']!==token)return reply(403,{error:'Forbidden'});
  if(req.method!=='POST'||req.url!=='/choose')return reply(404,{error:'Not found'});
  if(busy)return reply(409,{error:'Astra is already choosing'});
  busy=true;
  try {
    const chunks=[];let bytes=0;
    for await(const chunk of req){bytes+=chunk.length;if(bytes>2_000_000)throw new Error('Request too large');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!input.state?.request)throw new Error('Missing selection request');
    if(input.session!==session){astra.plan='';session=input.session;}
    const started=Date.now();
    console.log(`Astra: ${input.state.request.title || input.state.request.kind}`);
    const opening=process.env.ASTRA_OPENING_DISABLED==='1'?null:await openings.choose(input);
    if(opening){
      astra.plan=opening.plan;
      const source=openings.retired?'astra':'opening';
      console.log(`Astra: ${source==='astra'?'cached model response':`verified opening ${openings.plan?.id||'first-player'}`} (${Date.now()-started} ms)`);
      const result={...opening,source,routeId:openings.plan?.id||null,elapsedMs:Date.now()-started};
      await onDecision(input,result,openings);reply(200,result);
    }else{
      const result=await astra.choosePayload({...compactNativePayload(input),openingContext:openings.context()});
      openings.rememberFallback(input,result);
      console.log(`Astra: response (${Math.round(astra.lastMs/1000)} s; ${openings.reason})`);
      const response={...result,source:'astra',elapsedMs:Date.now()-started};
      await onDecision(input,response,openings);reply(200,response);
    }
  }catch(e){console.error(e.message);reply(502,{error:e.message});}
  finally{busy=false;}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{
  boundPort=server.address().port;
  try{fs.writeFileSync(configPath,JSON.stringify({url:`http://127.0.0.1:${boundPort}/choose`,token}),{flag:port===8788?'w':'wx'});}
  catch(error){server.close();reject(error);return;}
  console.log(`MDPro3 Astra bridge ready at 127.0.0.1:${boundPort}`);
  resolve();
});});
function stop(){astra.stop();server.close();if(fs.existsSync(configPath)&&JSON.parse(fs.readFileSync(configPath)).token===token)fs.unlinkSync(configPath);}
return {server,astra,openings,configPath,port:boundPort,stop};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const bridge=await startNativeBridge();
  process.on('SIGINT',()=>{bridge.stop();process.exit(0);});
  process.on('SIGTERM',()=>{bridge.stop();process.exit(0);});
}
