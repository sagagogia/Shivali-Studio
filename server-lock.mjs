import {openSync,closeSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
function stamp(pid){try{return readFileSync(`/proc/${pid}/stat`,'utf8').split(') ').at(-1).split(' ')[19];}catch{return null;}}
export function takeServerLock(file){
 const instance=process.env.RENDER_INSTANCE_ID||process.env.HOSTNAME||'local';
 const identity=JSON.stringify({pid:process.pid,start:stamp(process.pid),instance});
 const write=()=>{const fd=openSync(file,'wx',0o600);try{writeFileSync(fd,identity);}finally{closeSync(fd);}};
 try{write();}catch(error){
  if(error.code!=='EEXIST')throw error;
  let old;try{old=JSON.parse(readFileSync(file,'utf8'));if(typeof old==='number')old={pid:old};if(!old||typeof old!=='object'||!Number.isInteger(old.pid)||old.pid<=0)throw new Error();}catch{throw new Error('Server lock is malformed; inspect it before restarting.');}
  if(!old.instance||old.instance===instance){
   try{process.kill(old.pid,0);if(!old.start||stamp(old.pid)===old.start)throw new Error('This data directory already has a running studio. Stop it before starting another.');}
   catch(e){if(e.code!=='ESRCH')throw e;}
  }
  unlinkSync(file);write();
 }
 return ()=>{try{if(readFileSync(file,'utf8')===identity)unlinkSync(file);}catch{}};
}
