import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, readdir, realpath, stat, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_OPENMONTAGE_ROOT='/workspace/scratch/openmontage-inspection-_5ol60ly/OpenMontage';
export interface RenderInput {campaignId:string;version:number;title:string;images:{id:string;path:string;sha256:string}[];outputDir:string;openMontageRoot?:string;music?:{id:string;path:string;sha256:string;licenseConfirmed:boolean}}
const safeId=(value:string)=>typeof value==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
export async function renderPreview(input:RenderInput):Promise<{outputPath:string;reportPath:string;report:Record<string,unknown>}> {
  if(!safeId(input.campaignId)||!Number.isSafeInteger(input.version)||input.version<1||input.version>1000000) throw new Error('Invalid campaign/version');
  if(typeof input.title!=='string'||input.title.length>300||!Array.isArray(input.images)||input.images.length<1||input.images.length>12) throw new Error('Invalid preview input');
  if(!path.isAbsolute(input.outputDir)) throw new Error('Absolute output directory required');
  const images=[];
  for(const item of input.images){
    if(!safeId(item.id)||!path.isAbsolute(item.path)||! /^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid image descriptor');
    const resolved=await realpath(item.path);
    if(resolved!==item.path) throw new Error('Image symlinks are not permitted');
    const info=await stat(resolved);
    if(!info.isFile()||info.size<1||info.size>25*1024*1024) throw new Error('Invalid image size');
    const data=await readFile(resolved);
    const png=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg=data[0]===255&&data[1]===216&&data[2]===255;
    const webp=data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';
    if(!(png||jpg||webp)||createHash('sha256').update(data).digest('hex')!==item.sha256) throw new Error('Image signature/hash mismatch');
    images.push({...item,path:resolved});
  }
  let music:RenderInput['music'];
  if(input.music){
    const item=input.music;
    if(item.licenseConfirmed!==true) throw new Error('Music license confirmation required');
    if(!safeId(item.id)||!path.isAbsolute(item.path)||! /^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid music descriptor');
    const resolved=await realpath(item.path);
    if(resolved!==item.path) throw new Error('Music symlinks are not permitted');
    const info=await stat(resolved);
    if(!info.isFile()||info.size<1||info.size>25*1024*1024) throw new Error('Invalid music size');
    const data=await readFile(resolved);
    const wav=data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WAVE';
    const mp3=data.toString('ascii',0,3)==='ID3'||(data[0]===255&&(data[1]&224)===224);
    if(!(wav||mp3)||createHash('sha256').update(data).digest('hex')!==item.sha256) throw new Error('Music signature/hash mismatch');
    music={...item,path:resolved};
  }
  const root=await realpath(/*turbopackIgnore: true*/ input.openMontageRoot??process.env.SHIVALI_OPENMONTAGE_ROOT??DEFAULT_OPENMONTAGE_ROOT);
  await mkdir(input.outputDir,{recursive:true,mode:0o700});
  const outputRoot=await realpath(input.outputDir);
  if(/[\r\n']/.test(outputRoot)) throw new Error('Unsupported output directory');
  const directory=await mkdtemp(path.join(outputRoot,'preview-'));
  const packet={campaignId:input.campaignId,version:input.version,title:input.title,images,music,outputDir:directory,durationSeconds:27,width:1080,height:1920,fps:30,kind:'source-image-preview',openMontageRoot:root};
  await writeFile(path.join(directory,'packet.json'),JSON.stringify(packet,null,2),{mode:0o600});
  const python=path.join(root,'.venv/bin/python');
  const isolated=spawnSync('unshare',['-n','true'],{stdio:'ignore'}).status===0;
  const args=[path.join(process.cwd(),'scripts/openmontage_render.py'),path.join(directory,'packet.json')];
  try {
    await new Promise<void>((resolve,reject)=>{
      const child=spawn(isolated?'unshare':python,isolated?['-n',python,...args]:args,{detached:true,stdio:['ignore','ignore','pipe'],env:{NODE_ENV:'production',PATH:process.env.PATH??'/usr/bin:/bin',HOME:directory,LANG:'C.UTF-8',PYTHONNOUSERSITE:'1',SHIVALI_NETWORK_NAMESPACE:isolated?'1':'0'}});
      let settled=false;
      const kill=()=>{try {process.kill(-child.pid!,'SIGKILL');}catch{}};
      const timer=setTimeout(()=>{kill();finish(new Error('Preview timed out (180 seconds)'));},180000);
      const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve();};
      // Never return subprocess diagnostics containing paths or environment values to API callers.
      child.stderr.on('data',()=>{});
      child.on('error',()=>finish(new Error('OpenMontage worker unavailable')));
      child.on('close',(code)=>finish(code===0?undefined:new Error('OpenMontage preview failed; inspect local render report')));
    });
    const reportPath=path.join(directory,'render-report.json');
    const report=JSON.parse(await readFile(reportPath,'utf8')) as Record<string,unknown>;
    if(report.status!=='verified') throw new Error('Preview verification failed');
    return {outputPath:path.join(directory,'preview.mp4'),reportPath,report};
  } catch(error){
    for(const name of await readdir(directory)){
      if(name!=='packet.json') await rm(path.join(directory,name),{force:true,recursive:true});
    }
    await writeFile(path.join(directory,'render-report.json'),JSON.stringify({status:'failed',kind:'source-image-preview',deliverableReleased:false}),{mode:0o600});
    await writeFile(path.join(directory,'failure.json'),JSON.stringify({status:'failed',message:'Local preview failed or timed out; no deliverable released.'}),{mode:0o600});
    throw error;
  }
}
