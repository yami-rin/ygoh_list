import net from 'node:net';

// Kernel-owned lock: shared by native/browser launch paths, released on process exit.
export function acquireInferenceLock() {
  return new Promise((resolve,reject)=>{
    const lock=net.createServer(socket=>socket.destroy());
    lock.once('error',()=>reject(new Error('別のAstra対戦が思考中です。終了を待ってください')));
    lock.listen({host:'127.0.0.1',port:8789,exclusive:true},()=>{
      resolve(()=>new Promise(done=>lock.close(done)));
    });
  });
}
