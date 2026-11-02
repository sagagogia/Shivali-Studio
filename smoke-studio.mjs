import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const root=process.cwd(),dir=await mkdtemp(path.join(tmpdir(),'shivali-browser-'));
const base='http://127.0.0.1:3012';let logs='';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3012'],{cwd:root,env:{...process.env,SHIVALI_DATA_DIR:dir,SHIVALI_ENABLE_PAID_GENERATION:'false',SHIVALI_ENABLE_ADVANCED_GENERATOR:'false',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
let browser;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function json(route,body,status=200){const r=await fetch(`${base}${route}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result;}
async function act(body){return json('/api/studio',body);}
try {
 for(let i=0;i<100;i++){try{const r=await fetch(base);if(r.ok)break;}catch{}if(server.exitCode!==null)throw Error(logs);await pause(100);}
 let s=await json('/api/studio');assert.equal(s.garments[0].designNumber,'MF03162');assert.equal(s.assets.length,0);
 assert.equal((await fetch(`${base}/api/blob`,{method:'POST'})).status,403);
 assert.equal((await fetch(`${base}/api/studio`,{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403);
 await json('/api/studio/generate',{campaignId:s.campaigns[0].id,version:1,approved:true},409);
 const c=s.campaigns[0];await json('/api/studio/render',{campaignId:c.id,version:c.version},400);
 const png=path.join(dir,'test-fixture.png');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0x345570:s=180x320','-frames:v','1','-threads','1',png]);
 const form=new FormData();form.set('file',new File([await readFile(png)],'technical-fixture.png',{type:'image/png'}));form.set('garmentId',c.garmentId);form.set('campaignId',c.id);form.set('kind','image');
 const upload=await fetch(`${base}/api/studio/upload`,{method:'POST',body:form});assert.equal(upload.status,200);const {asset}=await upload.json();
 s=await act({type:'asset.review',assetId:asset.id,garmentAccuracy:'pass',notes:'Synthetic fixture for technical QA only; not a garment product approval.'});assert.equal(s.assets[0].qa.technicalPassed,true);
 s=await act({type:'campaign.plan',campaignId:c.id});const version=s.campaigns[0].version;
 await json('/api/studio',{type:'approval.decide',campaignId:c.id,version:version-1,gate:'concept',decision:'approved'},400);
 for(const gate of ['concept','assets'])await act({type:'approval.decide',campaignId:c.id,version,gate,decision:'approved',note:'Automated technical fixture test, not a real campaign approval.'});
 const queued=await json('/api/studio/render',{campaignId:c.id,version},202);
 for(let i=0;i<90;i++){s=await json('/api/studio');const j=s.jobs.find(j=>j.id===queued.job.id);if(j.status==='completed')break;if(j.status==='failed')throw Error(j.message+'\n'+logs);if(i===89)throw Error('Render timed out');await pause(500);}
 assert.equal(s.jobs.find(j=>j.id===queued.job.id).status,'completed');
 assert.equal((await fetch(`${base}/api/studio/export/${c.id}`)).status,409);
 await act({type:'approval.decide',campaignId:c.id,version,gate:'render',decision:'approved',note:'Synthetic fixture test only.'});
 const exported=await json(`/api/studio/export/${c.id}`);assert.equal(exported.campaign.status,'exported');
 const rendered=exported.assets.find(a=>a.kind==='render');const media=await fetch(`${base}${rendered.url}`);assert.equal(media.status,200);const out=path.join(dir,'exported.mp4');await writeFile(out,Buffer.from(await media.arrayBuffer()));
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',out]).toString());assert.equal(probe.streams[0].width,1080);assert.equal(probe.streams[0].height,1920);assert.equal(Number(probe.format.duration),27);
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));await page.setViewport({width:1440,height:1000});
 await page.goto(base,{waitUntil:'networkidle0'});await page.waitForSelector('.workbench');
 await page.evaluate(()=>Array.from(document.querySelectorAll('.studio-nav button')).find(b=>b.textContent==='Garments').click());await page.waitForSelector('.table-wrap');
 await page.evaluate(()=>Array.from(document.querySelectorAll('.studio-nav button')).find(b=>b.textContent==='Studio').click());
 await page.setViewport({width:390,height:844});await page.waitForSelector('.campaign-heading');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile layout overflows viewport');
 assert.equal(pageErrors.length,0,pageErrors.join('\n'));
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/qa-mobile.png',fullPage:true});
 const report={passed:true,checks:['private seeded records','paid generation disabled','cross-origin mutation blocked','cloud upload disabled','private image upload','real media decode','stale approvals rejected','concept and asset gates','OpenMontage API render','final approval before export','27s 1080x1920 output','browser navigation','390px mobile layout','no browser runtime exceptions'],paidCalls:0,fixture:'Synthetic color image in temporary isolated database; no real product approvals recorded.'};
 await writeFile('artifacts/smoke-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
} catch(error){await mkdir('artifacts',{recursive:true});await writeFile('artifacts/smoke-server.log',logs);throw error;}
finally{if(browser)await browser.close();server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));await rm(dir,{recursive:true,force:true});}
