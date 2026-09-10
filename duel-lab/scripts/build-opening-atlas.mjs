import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {json,digest,hash,describeFrame,publicState,validateReplay} from './opening-atlas-model.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const ASSETS=['index.html','atlas.css','atlas.js','favicon.svg','README.md'];
const SOURCE_FILES=['scripts/build-opening-atlas.mjs','scripts/opening-atlas-model.mjs','preset.json','package.json',
  'opening-sources.mjs','opening-policy.mjs','opening-semantics.mjs','opening-placement.mjs','engine.mjs','prompts.mjs','cards.mjs',
  'scripts/route-harness.mjs','scripts/survey-multi-openings.mjs','scripts/patch-core.mjs','node_modules/ocgcore-wasm/dist/index.js',
  ...ASSETS.map(name=>`scripts/opening-atlas/${name}`)];

export function parseArgs(args) {
  const options={};
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(arg==='--help'){assert.equal(args.length,1,'--help takes no other arguments');return {help:true};}
    assert(arg==='--output'||arg==='--verify',`Unknown option: ${arg}`);
    assert(args[i+1]&&!args[i+1].startsWith('--'),`Missing value for ${arg}`);
    assert(!options.output&&!options.verify,'Choose one output or verification directory');
    options[arg.slice(2)]=args[++i];
  }
  return options;
}

export function resolveOutput(value,{root=ROOT,fresh=true}={}) {
  const runtime=path.resolve(root,'runtime'),target=path.resolve(root,value);
  const inside=(base,file)=>{const relative=path.relative(base,file);return relative!==''&&!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative);};
  assert(inside(runtime,target),'Atlas directories must be inside duel-lab/runtime');
  let ancestor=target;
  while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
  const realRoot=fs.realpathSync(root),realAncestor=fs.realpathSync(ancestor);
  assert(realAncestor===realRoot||inside(realRoot,realAncestor),'Output ancestor resolves outside the repository');
  if(fs.existsSync(runtime)){
    assert.equal(fs.realpathSync(runtime),runtime,'Runtime must not be redirected by a symlink or junction');
    assert(realAncestor===runtime||inside(runtime,realAncestor),'Output ancestor resolves outside runtime');
  }
  if(fresh)assert(!fs.existsSync(target),'Output already exists; choose a new directory');
  else assert(fs.statSync(target).isDirectory(),'Verification target is not a directory');
  return target;
}

async function context() {
  const [{cards},{preset},{loadOpeningTemplates,bestOpening},{openingSources},{enumeratePairs,handUsage}]=await Promise.all([
    import('../cards.mjs'),import('./route-harness.mjs'),import('../opening-policy.mjs'),import('../opening-sources.mjs'),import('./survey-multi-openings.mjs')]);
  const manifest=()=>{
    const sources=[...SOURCE_FILES,...openingSources().map(name=>`routes/${name}.json`)];
    const files=sources.map(file=>({file,sha256:digest(fs.readFileSync(path.join(ROOT,file)))}));
    const lua=fs.readdirSync(path.join(ROOT,'data/scripts'),{recursive:true}).filter(name=>name.endsWith('.lua')).map(name=>name.replaceAll('\\','/')).sort();
    const assets=[...['cards.json','strings.conf','ocgcore.sync.wasm'].map(name=>`data/${name}`),...lua.map(name=>`data/scripts/${name}`)]
      .map(file=>[file,digest(fs.readFileSync(path.join(ROOT,file)))]);
    return {files,assets:{files:assets.length,sha256:hash(assets)}};
  };
  return {cards,preset,loadOpeningTemplates,bestOpening,enumeratePairs,handUsage,manifest};
}

function verifyData(data,output,ctx) {
  const {preset,cards,enumeratePairs,handUsage}=ctx;
  assert.equal(data.version,1);assert.equal(data.presetHash,hash(preset));
  assert.deepEqual(data.preset,preset);
  assert.deepEqual(Object.fromEntries(data.main.map(card=>[card.code,card.count])),preset.main.reduce((map,code)=>(map[code]=(map[code]??0)+1,map),{}));
  assert.deepEqual(data.pairs.map(({id,hand,physicalWeight})=>({id,hand,physicalWeight})),enumeratePairs(preset.main));
  const checked={states:0,steps:0,questions:0,placements:0,placementAfterPosition:0};
  let attempts=0,failures=0,supported=0;
  for(const pair of data.pairs){
    const bytes=fs.readFileSync(path.join(output,'traces',`${pair.id}.json`)),stored=JSON.parse(bytes);
    assert.equal(stored.identity,data.identity);assert.deepEqual(stored.hand,pair.hand);
    const {result}=stored;
    assert.equal(pair.attempted,pair.candidates);assert.equal(pair.attempted,result.attempted);assert.equal(pair.candidates,result.candidates);
    assert.equal(pair.failedApplications,result.failures.length);assert.equal(pair.supported,!!result.plan);assert.equal(!!pair.replay,!!result.plan);
    attempts+=pair.attempted;failures+=pair.failedApplications;
    if(!pair.replay)continue;
    supported++;
    assert.equal(pair.replay.traceSha256,digest(bytes));
    assert.equal(pair.replay.routeId,result.plan.id);assert.equal(pair.replay.source,result.plan.source);
    assert.equal(pair.replay.score,result.plan.score);assert.deepEqual(pair.replay.requiredHand,result.plan.requiredHand);
    assert.deepEqual(pair.replay.usage,handUsage(result.plan,{genericDiscard:result.plan.id.startsWith('backup-discard-')}));
    const current=validateReplay(pair,pair.replay,result.plan,preset,cards);
    for(const key of Object.keys(checked))checked[key]+=current[key];
  }
  assert.equal(data.summary.pairs,data.pairs.length);assert.equal(data.summary.supported,supported);
  assert.equal(data.summary.unsupported,data.pairs.length-supported);assert.equal(data.summary.candidateAttempts,attempts);
  assert.equal(data.summary.failedApplications,failures);assert.equal(data.summary.steps,checked.steps);
  assert.equal(data.summary.physicalCombinations,preset.main.length*(preset.main.length-1)/2);
  return checked;
}

export async function verifyAtlas(output) {
  const complete=JSON.parse(fs.readFileSync(path.join(output,'COMPLETE.json'),'utf8'));
  const bytes=fs.readFileSync(path.join(output,'data.js'));
  assert.equal(digest(bytes),complete.dataSha256,'Atlas data changed');
  const data=JSON.parse(bytes.toString('utf8').replace(/^window\.MALICE_ATLAS = /u,'').replace(/;\s*$/u,''));
  const ctx=await context();assert.deepEqual(ctx.manifest(),data.manifest,'Atlas source or rules assets changed');
  assert.equal(hash(data.manifest),data.identity);assert.equal(complete.identity,data.identity);
  const checked=verifyData(data,output,ctx);
  assert.deepEqual(complete.assets.map(asset=>asset.file),ASSETS,'Atlas asset inventory changed');
  for(const asset of complete.assets)assert.equal(digest(fs.readFileSync(path.join(output,asset.file))),asset.sha256,`Atlas asset changed: ${asset.file}`);
  const verification=JSON.parse(fs.readFileSync(path.join(output,'verification.json'),'utf8'));
  assert.equal(verification.status,'PASS');assert.equal(verification.dataSha256,complete.dataSha256);
  assert.equal(verification.identity,data.identity);assert.deepEqual(verification.summary,data.summary);
  assert.deepEqual(verification.checked,checked);
  assert.deepEqual(ctx.manifest(),data.manifest,'Source or rules assets changed during verification');
  return {status:'PASS',identity:data.identity,summary:data.summary,checked};
}

export async function buildAtlas(output) {
  output=resolveOutput(output);
  const ctx=await context(),{cards,preset,loadOpeningTemplates,bestOpening,enumeratePairs,handUsage}=ctx;
  const manifest=ctx.manifest(),identity=hash(manifest),startedAt=new Date().toISOString();
  fs.mkdirSync(path.dirname(output),{recursive:true});
  // Claim the new directory atomically. Two concurrent builders must not
  // share a BUILDING marker or add a failure marker to another build.
  fs.mkdirSync(output);
  fs.mkdirSync(path.join(output,'traces'));
  fs.writeFileSync(path.join(output,'BUILDING.json'),json({startedAt,identity})+'\n',{flag:'wx'});
  try {
    const templates=await loadOpeningTemplates(),templateMap=new Map(templates.map(template=>[`${template.source}/${template.id}`,template]));
    const pairs=enumeratePairs(preset.main),rows=[];
    for(let index=0;index<pairs.length;index++){
      const pair=pairs[index],result=await bestOpening(templates,pair.hand,{maxCandidates:Infinity});
      const trace=json({identity,hand:pair.hand,result})+'\n',plan=result.plan;
      fs.writeFileSync(path.join(output,'traces',`${pair.id}.json`),trace,{flag:'wx'});
      let replay=null;
      if(plan){
        const template=templateMap.get(`${plan.source}/${plan.id}`);assert(template);
        replay={routeId:plan.id,source:plan.source,requiredHand:plan.requiredHand,score:plan.score,usage:handUsage(plan,template),
          states:[...plan.frames.map(frame=>publicState(frame.state.own)),publicState(plan.finalOwn)],
          steps:plan.frames.map(frame=>({label:describeFrame(frame,cards),prompt:frame.request.title??'カード選択',automatic:frame.automatic})),
          finalHash:hash(plan.final),traceSha256:digest(trace)};
        validateReplay(pair,replay,plan,preset,cards);
      }
      rows.push({...pair,index,supported:!!plan,candidates:result.candidates,attempted:result.attempted,failedApplications:result.failures.length,replay});
      if((index+1)%25===0||index+1===pairs.length)console.log(json({checked:index+1,total:pairs.length,supported:rows.filter(row=>row.supported).length}));
    }
    assert.deepEqual(ctx.manifest(),manifest,'Source or rules assets changed during generation');
    const copies=preset.main.reduce((map,code)=>(map[code]=(map[code]??0)+1,map),{});
    const data={version:1,createdAt:new Date().toISOString(),startedAt,identity,manifest,preset,presetHash:hash(preset),
      scope:'固定構築から選ぶ2枚手札に既知の無ドロー手順を適用。全合法手・妨害・初手5枚の網羅ではない。',
      main:Object.entries(copies).map(([code,count])=>({code:Number(code),count})),
      cards:Object.fromEntries([...new Set([...preset.main,...preset.extra])].map(code=>[code,Object.fromEntries(
        ['code','name','enName','text','strings','type','level','attack','defense','link_marker'].map(key=>[key,cards[code][key]]))])),
      summary:{pairs:rows.length,supported:rows.filter(row=>row.supported).length,unsupported:rows.filter(row=>!row.supported).length,
        templates:templates.length,candidateAttempts:rows.reduce((n,row)=>n+row.attempted,0),failedApplications:rows.reduce((n,row)=>n+row.failedApplications,0),
        physicalCombinations:rows.reduce((n,row)=>n+row.physicalWeight,0),steps:rows.reduce((n,row)=>n+(row.replay?.steps.length??0),0)},pairs:rows};
    const checked=verifyData(data,output,ctx),dataBytes=`window.MALICE_ATLAS = ${json(data).replaceAll('<','\\u003c')};\n`,dataSha256=digest(dataBytes);
    fs.writeFileSync(path.join(output,'data.js'),dataBytes,{flag:'wx'});
    const assets=[];
    for(const file of ASSETS){const bytes=fs.readFileSync(new URL(`./opening-atlas/${file}`,import.meta.url));fs.writeFileSync(path.join(output,file),bytes,{flag:'wx'});assets.push({file,sha256:digest(bytes)});}
    const verification={status:'PASS',at:new Date().toISOString(),identity,dataSha256,summary:data.summary,checked,
      scope:data.scope,checks:['All candidates attempted','Every state matches its captured core frame','All cards conserved within preset copy limits','Every placement matches the resulting core zone','No draw-dependent plan']};
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(verification,null,2)+'\n',{flag:'wx'});
    fs.writeFileSync(path.join(output,'COMPLETE.json'),JSON.stringify({identity,dataSha256,assets},null,2)+'\n',{flag:'wx'});
    fs.unlinkSync(path.join(output,'BUILDING.json'));
    return {output,...verification};
  } catch(error) {
    fs.writeFileSync(path.join(output,'FAILED.json'),json({at:new Date().toISOString(),message:error.message})+'\n');throw error;
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try {
    const options=parseArgs(process.argv.slice(2));
    if(options.help)console.log('node scripts/build-opening-atlas.mjs [--output runtime/<new-folder> | --verify runtime/<existing-folder>]\nBuilds a fixed two-card atlas from all applicable saved no-draw routes. Never overwrites an existing directory.');
    else if(options.verify)console.log(json(await verifyAtlas(resolveOutput(options.verify,{fresh:false}))));
    else console.log(json(await buildAtlas(resolveOutput(options.output??`runtime/opening-atlas/${new Date().toISOString().replace(/[:.]/g,'-')}`))));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
