"""Exercise the actual native server's banlist and deck validation over its wire protocol."""
from pathlib import Path
import ctypes,json,os,socket,struct,subprocess,sys,threading,time

ROOT=Path(__file__).resolve().parents[1]
CLIENT=ROOT/'runtime/MDPro3-client'

def worker(case):
    os.chdir(CLIENT)
    plugins=CLIENT/'MDPro3_Data/Plugins/x86_64'
    dll_search=os.add_dll_directory(str(plugins))
    lib=ctypes.CDLL(str(plugins/'ygoserver.dll'))
    lib.start_server.argtypes=[ctypes.c_char_p]
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1',0));port=reservation.getsockname()[1]
    args=f'{port} 0 5 0 F F F 8000 5 1 0 0'.encode()
    threading.Thread(target=lambda:lib.start_server(args),daemon=True).start()
    time.sleep(.5)
    sock=socket.create_connection(('127.0.0.1',port),3);sock.settimeout(.5)
    def send(kind,data=b''):sock.sendall(struct.pack('<HB',len(data)+1,kind)+data)
    send(23,bytes(4)+'127.0.0.1\0'.encode('utf-16le'))
    send(16,'Native verification'.encode('utf-16le').ljust(40,b'\0'))
    send(18,struct.pack('<HBBI',0x1362,204,204,0)+bytes(40))
    preset=json.loads((ROOT/'preset.json').read_text('utf-8'))
    main=preset['main'][:]
    if case=='forbidden':main.append(55144522) # Pot of Greed
    if case=='fourth-copy':main.append(main[0])
    if case=='limited':main.append(23434538) # Maxx C: limited
    if case=='semi-limited':main.append(14558127) # Ash Blossom: semi-limited
    deck=main+preset['extra'];buffer=b'';result={};deadline=time.monotonic()+8
    while time.monotonic()<deadline:
        try:data=sock.recv(8192)
        except socket.timeout:continue
        if not data:break
        buffer+=data
        while len(buffer)>=2 and len(buffer)>=int.from_bytes(buffer[:2],'little')+2:
            size=int.from_bytes(buffer[:2],'little');packet=buffer[2:size+2];buffer=buffer[size+2:]
            if packet[0]==18:
                result['hash']=int.from_bytes(packet[1:5],'little')
                send(2,struct.pack('<II',len(deck),0)+struct.pack('<'+'I'*len(deck),*deck));send(34)
            elif packet[0]==2:
                result['error']=packet[1];result['code']=int.from_bytes(packet[5:9],'little')
            elif packet[0]==33 and packet[1]&15==9:result['ready']=True
        if 'error' in result or result.get('ready'):break
    sock.close();print('RESULT '+json.dumps(result),flush=True)
    os._exit(0) # Retire the DLL's server thread together with its isolated process.

def expected_hash():
    value=0x7dfcee6a;started=False
    for line in (CLIENT/'Data/lflist.conf').read_text('utf-8-sig').splitlines():
        if line.startswith('!'):
            if started:break
            assert line=='!Astra OCG 2026.07';started=True
        columns=line.split()
        if started and len(columns)>=2 and columns[0].isdigit():
            code,count=map(int,columns[:2])
            value^=((code<<18)|(code>>14))^((code<<(27+count))|(code>>(5-count)))
            value &= 0xffffffff
    return value

if len(sys.argv)>1:worker(sys.argv[1])
expected=expected_hash();results={}
for case in ['valid','forbidden','limited','semi-limited','fourth-copy']:
    run=subprocess.run([sys.executable,__file__,case],capture_output=True,text=True,timeout=15,check=True)
    line=next(line for line in run.stdout.splitlines() if line.startswith('RESULT '))
    result=json.loads(line[7:]);results[case]=result
    assert result.get('hash')==expected,(case,'client/server banlist mismatch',result,expected)
    if case=='valid':assert result.get('ready'),result
    else:assert result.get('error')==2 and not result.get('ready'),result
    print('PASS',case,result)
(ROOT/'tests/artifacts').mkdir(exist_ok=True)
(ROOT/'tests/artifacts/native-server.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
