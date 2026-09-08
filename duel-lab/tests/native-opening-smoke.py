"""Native server -> unchanged MDPro3 WindBot -> actual AstraDecisionBridge HTTP smoke.

Default: a local fixture responder stops at the first real Main request, without Astra CLI.
--bridge-config PATH: use an already running product bridge and wait until the opening ends.
Generated files belong to a dedicated runtime/native-opening-* directory. Existing clients stay running.
"""
from pathlib import Path
import argparse,collections,contextlib,ctypes,datetime,hashlib,http.server,json,os,secrets,shutil,socket,struct,subprocess,sys,threading,time,urllib.parse,urllib.request,zipfile

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'runtime/native-opening-test'
CLIENT=ROOT/'runtime/MDPro3-client'
SOURCE=ROOT/'runtime/MDPro3/Assets/Scripts'
MONO=ROOT/'runtime/unity-6000.0.24/Editor/Data/MonoBleedingEdge'
PLUGINS=CLIENT/'MDPro3_Data/Plugins/x86_64'
DEFAULT_HAND=[69272449,40366667,40366667,78114463,20726052]

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def set_workdir(value):
    global WORK
    candidate=Path(value).resolve() if value else WORK.resolve()
    try:relative=candidate.relative_to((ROOT/'runtime').resolve())
    except ValueError:raise ValueError('Work directory must be inside this project runtime directory')
    if not relative.parts or not relative.parts[0].startswith('native-opening-'):
        raise ValueError('Work directory must be in a dedicated runtime/native-opening-* tree')
    WORK=candidate

@contextlib.contextmanager
def workspace_lock():
    WORK.mkdir(parents=True,exist_ok=True)
    path=WORK/'harness.lock'
    try:handle=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    except FileExistsError:raise RuntimeError('This native opening work directory is already in use: '+str(WORK))
    try:
        os.write(handle,str(os.getpid()).encode());os.close(handle)
        yield
    finally:path.unlink(missing_ok=True)

def stage():
    WORK.mkdir(parents=True,exist_ok=True)
    for rel in ['Data/script.zip','Data/config.conf','Data/lflist.conf','Data/lflist_merged.conf','lflist.conf']:
        target=WORK/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(CLIENT/rel,target)
    for folder in ['Data/locales','Data/Windbot/Dialogs']:
        for src in (CLIENT/folder).rglob('*'):
            if not src.is_file():continue
            dst=WORK/src.relative_to(CLIENT);dst.parent.mkdir(parents=True,exist_ok=True)
            if not dst.exists():os.link(src,dst)
    for folder in ['Expansions','Replay','Deck']:(WORK/folder).mkdir(exist_ok=True)
    for name in ['sqlite3.dll']:
        if not (WORK/name).exists():os.link(PLUGINS/name,WORK/name)
    # Unity's public-signed Newtonsoft binary cannot load under the desktop CLR.
    # Use the corresponding signed net45 distribution, without changing production assets.
    package=WORK/'newtonsoft.json.13.0.3.nupkg'
    if not package.exists():
        cached=ROOT/'runtime/native-opening-test'/package.name
        if cached.exists() and cached!=package:shutil.copyfile(cached,package)
        else:urllib.request.urlretrieve('https://api.nuget.org/v3-flatcontainer/newtonsoft.json/13.0.3/newtonsoft.json.13.0.3.nupkg',package)
    with zipfile.ZipFile(package) as archive:(WORK/'Newtonsoft.Json.dll').write_bytes(archive.read('lib/net45/Newtonsoft.Json.dll'))
    shutil.copyfile(MONO/'lib/mono/4.5/Mono.Data.Sqlite.dll',WORK/'Mono.Data.Sqlite.dll')

def build():
    wind=SOURCE/'Windbot';ygo=SOURCE/'YGOSharp'
    sources=[p for p in (wind/'Game').rglob('*.cs') if 'Decks' not in p.relative_to(wind/'Game').parts]
    sources.extend([wind/'Game/AI/Decks/AstraExecutor.cs',wind/'Logger.cs',wind/'WindBotInfo.cs',Path(__file__).with_suffix('.cs')])
    # Use the current product bridge source, not a separately maintained test implementation.
    sources=[p for p in sources if p.name!='AstraDecisionBridge.cs']+[ROOT/'native/AstraDecisionBridge.cs']
    for folder in ['YGOSharp.Network','YGOSharp.OCGWrapper','YGOSharp.OCGWrapper.Enums']:
        sources.extend((ygo/folder).rglob('*.cs'))
    sources=sorted(sources)
    framework=Path(os.environ.get('WINDIR','C:/Windows'))/'Microsoft.NET/Framework64/v4.0.30319'
    refs=[str(framework/(name+'.dll')) for name in ['mscorlib','System','System.Core','System.Data','System.Runtime.Serialization']]+[str(MONO/'lib/mono/4.5/Mono.Data.Sqlite.dll'),str(WORK/'Newtonsoft.Json.dll')]
    command=[str(MONO/'bin/mono.exe'),str(MONO/'lib/mono/4.5/mcs.exe'),'-nostdlib','-unsafe','-langversion:latest','-define:ASTRA_NATIVE_TEST_ENDPOINT','-out:'+str(WORK/'opening-client.exe')]+['-r:'+r for r in refs]+[str(p) for p in sources]
    before={str(p):digest(p) for p in sources}
    run=subprocess.run(command,cwd=WORK,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=60)
    (WORK/'build.log').write_text(run.stdout+run.stderr,encoding='utf-8')
    if run.returncode:raise RuntimeError('Native client compilation failed: '+run.stdout+run.stderr)
    assert before=={str(p):digest(p) for p in sources},'Native source changed while compiling; rerun after the source update completes'
    manifest={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'defines':['ASTRA_NATIVE_TEST_ENDPOINT'],
              'sources':[{'path':str(p.relative_to(ROOT)),'sha256':digest(p)} for p in sources],
              'nativeServerSha256':digest(PLUGINS/'ygoserver.dll'),'nativeCoreSha256':digest(PLUGINS/'ocgcore.dll'),
              'nativeScriptsSha256':digest(WORK/'Data/script.zip'),'nativeCardsSha256':digest(WORK/'Data/locales/ja-JP/cards.cdb'),
              'presetSha256':digest(ROOT/'preset.json'),'newtonsoftNugetPackageSha256':digest(WORK/'newtonsoft.json.13.0.3.nupkg')}
    (WORK/'build-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('BUILD PASS',len(sources),'unchanged native sources plus console entrypoint',flush=True)

def server_worker(port):
    os.chdir(WORK);dll_search=os.add_dll_directory(str(PLUGINS))
    lib=ctypes.CDLL(str(PLUGINS/'ygoserver.dll'));lib.start_server.argtypes=[ctypes.c_char_p]
    # Native server's noShuffle flag is enabled only in this isolated test room.
    lib.start_server(f'{port} 0 5 0 F F T 8000 5 1 0 0'.encode())

def send(sock,kind,data=b''):sock.sendall(struct.pack('<HB',len(data)+1,kind)+data)
def opponent(port,preset,stop,errors):
    try:
        sock=socket.create_connection(('127.0.0.1',port),3);sock.settimeout(.2)
        send(sock,23,bytes(4)+'127.0.0.1\0'.encode('utf-16le'))
        send(sock,16,'Passive opponent'.encode('utf-16le').ljust(40,b'\0'))
        send(sock,18,struct.pack('<HBBI',0x1362,204,204,0)+bytes(40))
        buffer=b''
        while not stop.is_set():
            try:data=sock.recv(16384)
            except socket.timeout:continue
            if not data:break
            buffer+=data
            while len(buffer)>=2 and len(buffer)>=int.from_bytes(buffer[:2],'little')+2:
                n=int.from_bytes(buffer[:2],'little');p=buffer[2:n+2];buffer=buffer[n+2:]
                if p[0]==18:
                    deck=preset['main']+preset['extra'];send(sock,2,struct.pack('<II',len(deck),0)+struct.pack('<'+'I'*len(deck),*deck));send(sock,34)
                elif p[0]==3:send(sock,3,bytes([3]))
                elif p[0]==4:send(sock,4,bytes([0])) # Give the tested client the first turn.
                elif p[0]==24:send(sock,21)
                elif p[0]==2:raise RuntimeError('Native opponent received server error '+p.hex())
                elif p[0]==1 and len(p)>1:
                    # Only mechanical optional chain/yes-no passes; no hidden cards leave this client.
                    if p[1]==16:send(sock,1,struct.pack('<i',-1))
                    elif p[1] in [12,13]:send(sock,1,struct.pack('<i',0))
        sock.close()
    except Exception as error:
        if not stop.is_set():errors.append(str(error))

def main(args):
    stage();build()
    if args.build_only:return
    preset=json.loads((ROOT/'preset.json').read_text('utf-8'))
    hand=[int(c) for c in args.hand.split(',')] if args.hand else DEFAULT_HAND
    assert len(hand)==5,'Exactly five starting hand cards are required'
    remaining=preset['main'][:]
    for code in hand:remaining.remove(code)
    main_deck=hand+remaining
    assert collections.Counter(main_deck)==collections.Counter(preset['main'])
    (WORK/'opening.ydk').write_text('#main\n'+'\n'.join(map(str,main_deck))+'\n#extra\n'+'\n'.join(map(str,preset['extra']))+'\n!side\n',encoding='utf-8')
    requests=[];main_seen=threading.Event();errors=[];stop=threading.Event();httpd=None
    token=secrets.token_hex(32)
    bridge_port=args.bridge_port
    if args.bridge_config:
        config_path=Path(args.bridge_config).resolve()
        endpoint=urllib.parse.urlsplit(json.loads(config_path.read_text('utf-8'))['url'])
        assert endpoint.scheme=='http' and endpoint.hostname=='127.0.0.1' and endpoint.path=='/choose'
        assert not endpoint.username and not endpoint.password and not endpoint.query and not endpoint.fragment
        assert endpoint.port and (not bridge_port or bridge_port==endpoint.port),'Explicit bridge port differs from config'
        bridge_port=endpoint.port
    else:
        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self,*_):pass
            def do_POST(self):
                if self.path!='/choose' or self.headers.get('X-Astra-Token')!=token:
                    self.send_error(403);return
                data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                request=data['state']['request'];players=data['state']['players']
                for enemy in [p for p in players if p['player']==0]:
                    assert all(c is None or not c['code'] for c in enemy['hand']), 'Opponent hand leaked to bridge'
                    assert all(c is None or not c['code'] for c in enemy['extra']), 'Opponent extra leaked to bridge'
                requests.append(data)
                choices=request.get('choices',[])
                if request.get('title')=='先攻を選ぶか':response={'action':1}
                elif request.get('title')=='チェーンの選択' and any(c['option']=='チェーンしない' for c in choices):
                    response={'action':next(c['id'] for c in choices if c['option']=='チェーンしない')}
                elif request.get('title')=='メインフェイズの行動':
                    mine=next(p for p in players if p['player']==1)
                    if collections.Counter(c['code'] for c in mine['hand'])!=collections.Counter(hand):
                        errors.append('Fixed opening hand mismatch: '+str([c['code'] for c in mine['hand']]))
                    main_seen.set();response={'action':next(c['id'] for c in choices if c['option']=='End Phase')}
                else:
                    errors.append('Unexpected pre-main native request: '+str(request));response={'action':0,'selection':[],'cancel':True}
                body=json.dumps(response).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        # Binding is exclusive. An existing user's product bridge is never stopped or reused implicitly.
        httpd=http.server.ThreadingHTTPServer(('127.0.0.1',bridge_port),Handler)
        bridge_port=httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever,daemon=True).start()
        config_path=WORK/'bridge-config.json';config_path.write_text(json.dumps({'url':f'http://127.0.0.1:{bridge_port}/choose','token':token}),encoding='utf-8')
    with socket.socket() as reservation:reservation.bind(('127.0.0.1',0));port=reservation.getsockname()[1]
    processes=[]
    try:
        with (WORK/'server.log').open('w',encoding='utf-8') as server_log,(WORK/'client.log').open('w',encoding='utf-8') as client_log:
            server=subprocess.Popen([sys.executable,__file__,'--server-worker',str(port),'--workdir',str(WORK)],cwd=WORK,stdout=server_log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW);processes.append(server)
            time.sleep(.6)
            env=os.environ.copy();env['ASTRA_BRIDGE_CONFIG']=str(config_path);env['PATH']=str(PLUGINS)+os.pathsep+env.get('PATH','')
            # The product bridge must explicitly support this test-only opt-in;
            # this harness never patches or bypasses its endpoint validation.
            if bridge_port!=8788:env['ASTRA_BRIDGE_TEST_PORT']=str(bridge_port)
            else:env.pop('ASTRA_BRIDGE_TEST_PORT',None)
            client=subprocess.Popen([str(WORK/'opening-client.exe'),str(port),str(args.timeout)],cwd=WORK,env=env,stdout=client_log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW);processes.append(client)
            time.sleep(.4);thread=threading.Thread(target=opponent,args=(port,preset,stop,errors),daemon=True);thread.start()
            deadline=time.monotonic()+args.timeout
            while time.monotonic()<deadline:
                if (WORK/'cancel.request').exists():raise RuntimeError('Native opening fixture was cancelled by its owner')
                if errors:raise RuntimeError('; '.join(errors))
                if not args.bridge_config and main_seen.is_set():break
                if client.poll() is not None:
                    if args.bridge_config and client.returncode==0:break
                    raise RuntimeError('Native client exited: '+(WORK/'client.log').read_text('utf-8',errors='replace'))
                time.sleep(.1)
            else:raise RuntimeError('Timed out waiting for native opening: '+(WORK/'client.log').read_text('utf-8',errors='replace'))
            terminal=None
            if args.bridge_config:
                log=(WORK/'client.log').read_text('utf-8-sig',errors='replace')
                terminal=json.loads(next(line[len('OPENING_END '):] for line in log.splitlines() if line.startswith('OPENING_END ')))
                observed_hand=json.loads(next(line[len('FIRST_MAIN_HAND '):] for line in log.splitlines() if line.startswith('FIRST_MAIN_HAND ')))
                assert collections.Counter(observed_hand)==collections.Counter(hand),'External bridge starting hand differs from fixture'
                assert terminal['mainResponses']>=1 and terminal['bridgeRequests']>=1,'Native Main did not complete through the bridge'
            result={'mode':'product-bridge' if args.bridge_config else 'first-main-request','nativeServer':str(PLUGINS/'ygoserver.dll'),'actualBridgeSource':'native/AstraDecisionBridge.cs','hand':hand,'mainRequestReceived':main_seen.is_set() or bool(terminal),'requests':len(requests) if terminal is None else terminal['bridgeRequests'],'terminal':terminal,'errors':errors,'serverPort':port,'bridgePort':bridge_port,'workdir':str(WORK),'buildManifestSha256':digest(WORK/'build-manifest.json')}
            (WORK/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
            if requests:(WORK/'requests.json').write_text(json.dumps(requests,indent=2),encoding='utf-8')
            print('RESULT '+json.dumps(result),flush=True)
    finally:
        stop.set()
        for process in reversed(processes):
            if process.poll() is None:process.terminate()
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:process.kill();process.wait()
        if httpd:httpd.shutdown();httpd.server_close()
        if not args.bridge_config and config_path.exists():config_path.unlink()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--server-worker',type=int);parser.add_argument('--build-only',action='store_true');parser.add_argument('--bridge-config');parser.add_argument('--bridge-port',type=int,default=0);parser.add_argument('--workdir');parser.add_argument('--hand');parser.add_argument('--timeout',type=int,default=30)
    args=parser.parse_args()
    assert 0<=args.bridge_port<=65535,'Invalid HTTP bridge port'
    set_workdir(args.workdir)
    if args.server_worker:server_worker(args.server_worker)
    else:
        with workspace_lock():main(args)
