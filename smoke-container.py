"""Local isolated Docker smoke; generated test credentials are never printed."""
import json,os,secrets,subprocess,tempfile,time,shutil
from pathlib import Path
base=['docker','--host=unix:///var/run/docker.sock']
data=Path(tempfile.mkdtemp(prefix='shivali-docker-data-',dir='/workspace/scratch'))
env=os.environ.copy();env['SHIVALI_AUTH_PASSWORD']=secrets.token_hex(24);env['SHIVALI_SESSION_SECRET']=secrets.token_hex(32)
container=None
script=r'''
const fs=require('fs');const cp=require('child_process');
const base='http://127.0.0.1:10000';let cookie='';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function req(route,body,status=200){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),Origin:base,...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();if(r.status!==status)throw Error(route+': '+r.status+' '+JSON.stringify(v));return v;}
(async()=>{
for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await pause(100);}
await req('/api/studio',null,401);
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:process.env.SHIVALI_AUTH_PASSWORD}),redirect:'manual'});
if(login.status!==303)throw Error('Login failed');cookie=login.headers.get('set-cookie').split(';')[0];
let s=await req('/api/studio');
if(process.env.RESTART_CHECK==='true'){if(s.assets.length!==2||s.jobs[0]?.status!=='completed')throw Error('Persistence failure');console.log(JSON.stringify({restartPersistence:true,assets:s.assets.length}));return;}
const c=s.campaigns[0];cp.execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0x345570:s=180x320','-frames:v','1','-threads','1','/tmp/fixture.png']);
const form=new FormData();form.set('file',new File([fs.readFileSync('/tmp/fixture.png')],'fixture.png',{type:'image/png'}));form.set('garmentId',c.garmentId);form.set('campaignId',c.id);form.set('kind','image');
const r=await fetch(base+'/api/studio/upload',{method:'POST',headers:{Origin:base,Cookie:cookie},body:form});if(!r.ok)throw Error('Upload failed');const {asset}=await r.json();
await req('/api/studio',{type:'asset.review',assetId:asset.id,garmentAccuracy:'pass',notes:'Synthetic fixture test only'});
s=await req('/api/studio',{type:'campaign.plan',campaignId:c.id});const version=s.campaigns[0].version;
for(const gate of ['concept','assets'])await req('/api/studio',{type:'approval.decide',campaignId:c.id,version,gate,decision:'approved',note:'Synthetic fixture test only'});
const queued=await req('/api/studio/render',{campaignId:c.id,version},202);
for(let i=0;i<330;i++){s=await req('/api/studio');const j=s.jobs.find(x=>x.id===queued.job.id);if(j.status==='completed')break;if(j.status==='failed')throw Error(j.message);if(i===329)throw Error('Render timeout');await pause(500);}
const out=s.assets.find(x=>x.kind==='render');if(!out)throw Error('Missing render');
let peak=null;try{peak=Number(fs.readFileSync('/sys/fs/cgroup/memory.peak','utf8').trim());}catch{}
console.log(JSON.stringify({containerLogin:true,actualOpenMontageRender:true,renderBytes:out.bytes,memoryLimitBytes:536870912,memoryPeakBytes:peak}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
'''
def run(args,**kwargs):
 result=subprocess.run(base+args,capture_output=True,text=True,**kwargs)
 if result.returncode:
  print(result.stderr[:2000]);result.check_returncode()
 return result
try:
 for restart in [False,True]:
  opts=['run','-d','--label','com.shivali.smoke=true','--network','none','--memory','512m','--cpus','0.5','--mount',f'type=bind,src={data},dst=/var/data','-e','SHIVALI_AUTH_PASSWORD','-e','SHIVALI_SESSION_SECRET','shivali-studio:codex']
  container=run(opts,env=env).stdout.strip()
  try:
   output=run(['exec','-e',f'RESTART_CHECK={str(restart).lower()}',container,'node','-e',script],timeout=210)
   print(output.stdout.strip())
  except Exception:
   logs=run(['logs',container]);print('Container smoke failed; startup log retained locally.')
   Path('/workspace/scratch/shivali-container-smoke.log').write_text(logs.stdout+logs.stderr)
   raise
  finally:
   run(['stop','--time','10',container]);run(['rm',container]);container=None
finally:
 if container:subprocess.run(base+['rm','-f',container],capture_output=True)
 shutil.rmtree(data,ignore_errors=True)
