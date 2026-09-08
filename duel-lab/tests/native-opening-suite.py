"""Sequential real-native opening fixtures, isolated from the user's live bridge.

Each fixture starts the real product policy with the CLI-free test runner, then
the native smoke client/server on separate ephemeral ports and a dedicated folder.
Evidence is retained per fixture and summarized; early fallback never counts as PASS.
"""
from pathlib import Path
import argparse,collections,datetime,hashlib,json,os,re,subprocess,sys,time,uuid

ROOT=Path(__file__).resolve().parents[1]
DEFAULT_FIXTURES=[
    {'id':'rabbit','hand':[69272449,40366667,40366667,78114463,20726052],
     'routeId':'rabbit-no-draw-accord','lp':6200,'monsters':[39138610,95454996],'spells':[],
     'finalHand':[40366667,40366667,78114463,20726052]},
    {'id':'backup-ash','hand':[30118811,14558127,40366667,40366667,78114463],
     'routeId':'backup-discard-accord','lp':8000,'monsters':[39138610,46947713],'spells':[],
     'finalHand':[40366667,40366667,78114463]},
    {'id':'cat-mag','hand':[96676583,64865,40366667,40366667,78114463],
     'routeId':'cat-mag-crypter-binder-ip-gwc','lp':6200,'monsters':[21848500,95454996,65741786],
     'spells':[20726052],'finalHand':[40366667,40366667,78114463]},
]

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read_json(path):return json.loads(Path(path).read_text('utf-8-sig'))
def write_json(path,value):Path(path).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
def require(condition,message):
    if not condition:raise AssertionError(message)

def sources():
    paths=[ROOT/p for p in ['native-bridge.mjs','opening-policy.mjs','opening-sources.mjs','opening-semantics.mjs','opening-placement.mjs','native-payload.mjs',
           'cards.mjs','engine.mjs','scripts/route-harness.mjs',
           'native/AstraDecisionBridge.cs','preset.json','tests/opening-bridge-runner.mjs',
           'tests/native-opening-smoke.py','tests/native-opening-smoke.cs','tests/native-opening-suite.py']]
    paths+=sorted((ROOT/'routes').glob('*.json'))
    return {str(p.relative_to(ROOT)):digest(p) for p in paths}

def check_trace(work,fixture,result):
    rows=[json.loads(line) for line in (work/'policy-trace.jsonl').read_text('utf-8').splitlines() if line]
    require(rows,'No real bridge trace was recorded')
    decisions=[r for r in rows if r.get('result')]
    ids=[r['input']['requestId'] for r in decisions]
    require(ids==list(range(1,len(ids)+1)),'Native request IDs are missing, duplicated or reordered')
    require(len(ids)==result['requests'],'Native request count differs from actual bridge responses')
    require(len({r['input']['session'] for r in decisions})==1,'Multiple duels mixed in one fixture')
    for row in decisions:
        payload=row['input'];require(payload.get('protocolVersion')==2,'Native v2 protocol required')
        enemy=next(p for p in payload['state']['players'] if p['player']==0)
        for zone in ['hand','extra']:
            require(all(c is None or c.get('code',0)==0 for c in enemy[zone]),'Hidden opponent card ID leaked')
    opening=[r for r in decisions if r['result'].get('source')=='opening' and r['result'].get('routeId')]
    require(opening,'No automatic opening response was delivered')
    require({r['result']['routeId'] for r in opening}=={fixture['routeId']},'Unexpected selected opening route')
    fallbacks=[r for r in rows if r.get('fallback')]
    completed=[r for r in fallbacks if r.get('context',{}).get('status')=='opening-completed']
    require(len(completed)==1,'Opening did not reach exactly one verified final Main handoff')
    require(completed[0]['context']['completedSteps']==completed[0]['context']['totalSteps'],'Opening stopped before its final frame')
    end_search=fixture.get('endPhaseSearch')
    if end_search:require(fixture['id']=='cat-magnamhut' and end_search=={'triggerCode':33854624,'searchCode':72656408},'Unsupported test end-phase search')
    delayed_trigger=False;explicit_search=False;handoff_actions=[]
    decision_by_id={r['input']['requestId']:r['result'] for r in decisions}
    for row in fallbacks:
        if row is completed[0]:continue
        s=row['input']['state'];r=s['request'];response=decision_by_id[row['input']['requestId']]
        end_phase=s['turn']==1 and s['player']==1 and s['phase']=='End'
        next_draw=s['turn']==2 and s['player']==0 and s['phase']=='Draw'
        require(row.get('context',{}).get('status')=='astra-took-over' and (end_phase or next_draw),
                'Unexpected post-opening turn or phase')
        chosen=next((c for c in r.get('choices',[]) if c['id']==response.get('action')),None)
        kind=response.get('testHandoff')
        if kind in ['end-phase-pass','opponent-draw-pass']:
            require(end_phase if kind=='end-phase-pass' else next_draw,'Wrong optional pass window')
            require(r['kind']=='single' and r['title']=='チェーンの選択' and chosen and chosen.get('option')=='チェーンしない','Invalid optional end-phase pass')
        elif kind=='magnamhut-delayed-trigger':
            require(end_phase and end_search and not delayed_trigger and r['kind']=='single' and r['title']=='チェーンの選択' and not s['chain'],'Unexpected delayed search trigger')
            option=chosen.get('option',{}) if chosen else {};card=option.get('card',{})
            require(card.get('code')==33854624 and card.get('controller')==1 and card.get('location')=='Grave' and option.get('description')==0,'Wrong delayed effect selected')
            delayed_trigger=True
        elif kind=='magnamhut-baldrake-search':
            require(end_phase and end_search and delayed_trigger and not explicit_search and r['kind']=='multi' and r.get('subtype')=='SELECT_CARD' and r['min']==r['max']==1 and not r['canCancel'] and r.get('sum')==-1 and r.get('exact') is True,'Unexpected delayed search selection')
            require(len(s['chain'])==1 and s['chain'][0]['code']==33854624 and s['chain'][0]['controller']==1,'Wrong search chain context')
            indices=response.get('selection',[]);require(len(indices)==1 and 0<=indices[0]<len(r['cards']),'Expected one search target')
            card=r['cards'][indices[0]]
            require(card['code']==72656408 and card['controller']==1 and card['location']=='Deck','Wrong end-phase search target')
            explicit_search=True
        else:raise AssertionError('Unexpected model fallback before or after the opening')
        handoff_actions.append(kind)
    final_main=next(p for p in completed[0]['input']['state']['players'] if p['player']==1)
    expected_main_hand=fixture.get('finalMainHand',fixture.get('finalHand'))
    if expected_main_hand is not None:
        require(collections.Counter(c['code'] for c in final_main['hand'])==collections.Counter(expected_main_hand),'Unexpected final Main hand')
    terminal=result['terminal']
    require(terminal['turn']==2 and terminal['player']==1,'Test did not reach the opponent turn')
    require(terminal['lp']==fixture['lp'],'Unexpected terminal LP')
    for zone in ['monsters','spells']:
        require(collections.Counter(c['code'] for c in terminal[zone])==collections.Counter(fixture[zone]),'Unexpected terminal '+zone)
    expected_terminal_hand=fixture.get('terminalHand',fixture.get('finalHand'))
    if expected_terminal_hand is not None:
        require(collections.Counter(terminal['hand'])==collections.Counter(expected_terminal_hand),'Unexpected terminal hand')
    if end_search:
        require(delayed_trigger,'Registered Magnamhut search never resolved')
        require(collections.Counter(terminal['hand'])==collections.Counter(c['code'] for c in final_main['hand'])+collections.Counter([72656408]),'End-phase search did not add exactly one Baldrake')
        if not explicit_search:handoff_actions.append('magnamhut-baldrake-search-native-automatic')
    return {'routeId':fixture['routeId'],'automaticResponses':len(opening),'httpResponses':len(ids),
            'frames':completed[0]['context']['totalSteps'],'finalMainComparedToVerifiedPlan':True,
            'hiddenOpponentIdsChecked':True,'modelCalls':0,'testHandoffResponses':len(fallbacks),'testHandoffActions':handoff_actions,
            'finalMainHand':[c['code'] for c in final_main['hand']],'terminal':terminal}

def stop_owned(process):
    if process is None or process.poll() is not None:return
    try:
        process.stdin.write('stop\n');process.stdin.flush();process.wait(timeout=5)
    except (BrokenPipeError,OSError,subprocess.TimeoutExpired):
        if process.poll() is None:process.terminate()
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.kill();process.wait()

def stop_smoke(process,work):
    if process is None or process.poll() is not None:return
    (work/'cancel.request').write_text('suite cleanup',encoding='utf-8')
    try:process.wait(timeout=15)
    except subprocess.TimeoutExpired:
        # Only this still-running child and descendants are targeted. The normal
        # path lets smoke's finally close its native client and duel server.
        subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],capture_output=True,timeout=10)
        process.wait(timeout=5)

def run_fixture(fixture,work,timeout,node,suite_sources):
    work.mkdir();write_json(work/'fixture.json',fixture)
    before=sources();write_json(work/'source-hashes.json',before)
    env=os.environ.copy();env['NATIVE_OPENING_TEST_PORT']='0';env['NATIVE_OPENING_TEST_WORKDIR']=str(work)
    # A production environment opt-out must not silently disable the policy under test.
    env.pop('ASTRA_OPENING_DISABLED',None)
    started=time.monotonic();bridge=None;smoke=None;record={'id':fixture['id'],'status':'FAIL','workdir':str(work),'hand':fixture['hand']}
    try:
        with (work/'bridge.log').open('w',encoding='utf-8') as bridge_log:
            bridge=subprocess.Popen([node,str(ROOT/'tests/opening-bridge-runner.mjs')],cwd=ROOT,env=env,
                stdin=subprocess.PIPE,stdout=bridge_log,stderr=subprocess.STDOUT,text=True,creationflags=subprocess.CREATE_NO_WINDOW)
            ready_path=work/'ready.json';deadline=time.monotonic()+90
            while not ready_path.exists():
                require(bridge.poll() is None,'Test bridge exited before readiness; inspect bridge.log')
                require(time.monotonic()<deadline,'Test bridge readiness timed out; inspect bridge.log')
                time.sleep(.1)
            ready=read_json(ready_path);config=Path(ready['configPath']).resolve()
            require(config.parent==work,'Test runner returned config outside its fixture work directory')
            require(ready['port']!=8788,'Test must never connect to the user production bridge')
            command=[sys.executable,str(ROOT/'tests/native-opening-smoke.py'),'--workdir',str(work),
                     '--bridge-config',str(config),'--bridge-port',str(ready['port']),
                     '--hand',','.join(map(str,fixture['hand'])),'--timeout',str(timeout)]
            with (work/'smoke.log').open('w',encoding='utf-8') as smoke_log:
                smoke=subprocess.Popen(command,cwd=ROOT,stdout=smoke_log,stderr=subprocess.STDOUT,
                                       creationflags=subprocess.CREATE_NO_WINDOW)
                smoke.wait(timeout=timeout+90)
            require(smoke.returncode==0,'Native smoke failed; inspect smoke.log and client.log')
            result=read_json(work/'result.json')
            require(result['mainRequestReceived'] and not result['errors'],'Main request failed or native errors were recorded')
            require(collections.Counter(result['hand'])==collections.Counter(fixture['hand']),'Fixture hand drift')
            record.update(check_trace(work,fixture,result))
            after=sources()
            record['changedSources']=sorted(k for k in before.keys()|after.keys() if before.get(k)!=after.get(k))
            require(not record['changedSources'],'Sources changed during fixture execution; rerun against a stable revision')
            record['changedSinceSuiteStart']=sorted(k for k in before.keys()|suite_sources.keys() if before.get(k)!=suite_sources.get(k))
            require(not record['changedSinceSuiteStart'],'Sources changed between fixtures; rerun the suite against a stable revision')
            record['status']='PASS'
    except Exception as error:
        record['error']=str(error)
    finally:
        try:stop_smoke(smoke,work)
        finally:
            stop_owned(bridge)
            # Only the credential file created for this fixture can be removed here.
            (work/'bridge-config.json').unlink(missing_ok=True)
    record['elapsedMs']=round((time.monotonic()-started)*1000)
    record['artifacts']={name:digest(work/name) for name in ['fixture.json','source-hashes.json','build-manifest.json',
        'result.json','policy-trace.jsonl','client.log','server.log','smoke.log','bridge.log'] if (work/name).exists()}
    write_json(work/'evidence.json',record)
    return record

def main(args):
    fixtures=read_json(args.fixtures) if args.fixtures else DEFAULT_FIXTURES
    if isinstance(fixtures,dict):fixtures=fixtures['fixtures']
    require(isinstance(fixtures,list) and fixtures,'Fixtures must be a nonempty list')
    ids=[f['id'] for f in fixtures]
    require(len(set(ids))==len(ids),'Duplicate fixture IDs')
    require(all(re.fullmatch(r'[a-z0-9][a-z0-9-]*',identifier) for identifier in ids),'Fixture IDs must be safe directory names')
    if args.fixture:
        require(set(args.fixture)<=set(ids),'Unknown requested fixture ID')
        fixtures=[f for f in fixtures if f['id'] in args.fixture]
    preset=collections.Counter(read_json(ROOT/'preset.json')['main'])
    for f in fixtures:
        require(len(f['hand'])==5 and not (collections.Counter(f['hand'])-preset),'Each initial hand must contain five preset cards')
        for key in ['routeId','lp','monsters','spells']:require(key in f,'Missing fixture expectation: '+key)
    if args.list:
        print(json.dumps(fixtures,ensure_ascii=False,indent=2));return 0
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:6]
    output=Path(args.output).resolve() if args.output else ROOT/'runtime/native-opening-suite'/stamp
    allowed=(ROOT/'runtime/native-opening-suite').resolve()
    require(output!=allowed and allowed in output.parents,'Suite output must be a new child of runtime/native-opening-suite')
    output.mkdir(parents=True,exist_ok=False)
    suite_sources=sources();write_json(output/'source-hashes.json',suite_sources)
    summary={'schemaVersion':1,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
             'command':sys.argv,'productionBridgeUntouched':True,'fixtures':[]}
    print('EVIDENCE '+str(output),flush=True)
    for fixture in fixtures:
        result=run_fixture(fixture,output/fixture['id'],args.timeout,args.node,suite_sources)
        summary['fixtures'].append(result)
        summary['passed']=sum(r['status']=='PASS' for r in summary['fixtures'])
        summary['failed']=len(summary['fixtures'])-summary['passed']
        write_json(output/'summary.json',summary)
        print(json.dumps({k:result[k] for k in ['id','status','routeId','httpResponses','elapsedMs','error'] if k in result}),flush=True)
    print(f"SUITE {'PASS' if not summary['failed'] else 'FAIL'} {summary['passed']}/{len(fixtures)}",flush=True)
    return int(bool(summary['failed']))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixtures',help='JSON array or object with fixtures, using the --list schema')
    parser.add_argument('--fixture',action='append',help='Run only the specified fixture ID; repeatable')
    parser.add_argument('--output',help='New output directory under runtime/native-opening-suite')
    parser.add_argument('--timeout',type=int,default=120);parser.add_argument('--node',default='node')
    parser.add_argument('--list',action='store_true')
    sys.exit(main(parser.parse_args()))
