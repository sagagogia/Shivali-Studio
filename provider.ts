import {writeFile,link,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const MODEL='fal-ai/nano-banana-pro/edit';
const ESTIMATE=15;
const MAX_BYTES=25*1024*1024;
export class ProviderError extends Error {submitted=false;providerRequestId:string|undefined;code:string;constructor(code:string,message:string){super(message);this.name='ProviderError';this.code=code;}}
export function getProviderStatus(){const configured=Boolean(process.env.FAL_KEY?.trim());const enabled=configured&&process.env.SHIVALI_ENABLE_PAID_GENERATION==='true';return {configured,enabled,model:MODEL,estimatedCents:ESTIMATE,detail:enabled?'Configured. Each call requires approval and a budget reservation; manual garment QA is required.':'Paid generation disabled. Configure FAL_KEY and explicitly enable SHIVALI_ENABLE_PAID_GENERATION.'};}
export function buildGarmentPrompt(garment:{designNumber:string;fabric:string;color:string;includesNecklace:boolean;includesDupatta:boolean;notes:string},concept:string):string{return `Create one vertical 9:16 front-view fashion model reference image using the supplied garment photographs. Keep the entire garment visible and front facing. Preserve observed embroidery, neckline, sleeve shape, silhouette, hem, fabric texture and color. Do not invent unseen garment details or add accessories. Garment metadata: ${JSON.stringify(garment)}. ${garment.includesNecklace?'Preserve the supplied necklace.':'Do not add a necklace.'} ${garment.includesDupatta?'Preserve the supplied dupatta and its border.':'Do not add a dupatta.'} Creative setting: ${concept}. The setting must not alter the garment. Exact fidelity is not guaranteed; manual product review is required before use.`;}
function fail(code:string,message:string):never{throw new ProviderError(code,message);}
function mime(bytes:Buffer){if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return 'image/png';if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';return '';}
export async function generateReferenceImage(input:{prompt:string;references:{mimeType:string;bytes:Buffer}[];outputPath:string;approved:boolean;maxCostCents:number},deps?:{fetch?:typeof fetch;sleep?:(ms:number)=>Promise<void>}):Promise<{outputPath:string;estimatedCents:number;providerRequestId:string;model:string}>{
 if(!getProviderStatus().enabled)fail('DISABLED','Paid generation is disabled.');
 if(input.approved!==true)fail('APPROVAL_REQUIRED','Explicit approval is required.');
 if(!Number.isSafeInteger(input.maxCostCents)||input.maxCostCents<ESTIMATE||input.maxCostCents>500)fail('BUDGET','A valid cost reservation within the campaign cap is required.');
 if(typeof input.prompt!=='string'||input.prompt.trim().length<3||input.prompt.length>50000||typeof input.outputPath!=='string'||!input.outputPath||!Array.isArray(input.references)||input.references.length<1||input.references.length>14)fail('INVALID_INPUT','Invalid generation input.');
 let total=0;for(const r of input.references){if(!r||!Buffer.isBuffer(r.bytes)||!r.bytes.length||r.bytes.length>MAX_BYTES||mime(r.bytes)!==r.mimeType)fail('INVALID_INPUT','References must be valid PNG, JPEG or WebP images.');total+=r.bytes.length;}if(total>MAX_BYTES)fail('INVALID_INPUT','Combined reference images exceed 25 MB.');
 const fetcher=deps?.fetch??fetch;const sleep=deps?.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));const controller=new AbortController();const deadline=Date.now()+120000;const timer=setTimeout(()=>controller.abort(),120000);const headers={Authorization:`Key ${process.env.FAL_KEY}`};
 async function request(url:string,init:RequestInit={},auth=true){if(Date.now()>=deadline||controller.signal.aborted)fail('TIMEOUT','Provider request timed out; it may still incur a charge.');const res=await fetcher(url,{...init,...(auth?{headers:{...headers,...init.headers}}:{}),redirect:'error',signal:controller.signal});if(!res.ok)fail('HTTP','Provider request failed.');return res;}
 async function json(url:string,init:RequestInit={}){const res=await request(url,init);const data=await res.json();if(!data||typeof data!=='object')fail('RESPONSE','Invalid provider response.');return data;}
 let temporary:string|undefined;let submitted=false;let requestId:string|undefined;
 try{
  const base=`https://queue.fal.run/${MODEL}`;
  submitted=true;
  const queued=await json(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:input.prompt,image_urls:input.references.map(r=>`data:${r.mimeType};base64,${r.bytes.toString('base64')}`),resolution:'2K',aspect_ratio:'9:16',num_images:1,output_format:'png',limit_generations:true,enable_web_search:false})});
  if(typeof queued.request_id!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(queued.request_id))fail('RESPONSE','Invalid provider request identifier.');
  requestId=queued.request_id;
  // Ignore provider-supplied status/result URLs: keep credentials on the fixed queue origin.
  const resultUrl=`https://queue.fal.run/fal-ai/nano-banana-pro/requests/${queued.request_id}`;let completed=false;
  for(let attempt=0;attempt<60;attempt++){const status=await json(`${resultUrl}/status`);if(status.status==='COMPLETED'){completed=true;break;}if(status.status!=='IN_QUEUE'&&status.status!=='IN_PROGRESS')fail('STATUS','Provider generation failed.');await sleep(2000);}
  if(!completed)fail('TIMEOUT','Provider request timed out; it may still incur a charge.');
  const result=await json(resultUrl);const raw=result.images?.[0]?.url;let url:URL;try{url=new URL(raw);}catch{fail('UNSAFE_URL','Provider returned an unsafe image URL.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!(url.hostname==='fal.media'||url.hostname.endsWith('.fal.media')))fail('UNSAFE_URL','Provider returned an unsafe image URL.');
  const image=await request(url.href,{},false);if(Number(image.headers.get('content-length'))>MAX_BYTES)fail('IMAGE_SIZE','Generated image exceeds 25 MB.');
  if(!image.body)fail('IMAGE','Provider returned no image.');const reader=image.body.getReader();const chunks:Buffer[]=[];let size=0;
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>MAX_BYTES){await reader.cancel();fail('IMAGE_SIZE','Generated image exceeds 25 MB.');}chunks.push(Buffer.from(part.value));}
  const bytes=Buffer.concat(chunks);if(!mime(bytes))fail('IMAGE','Provider returned an invalid image.');
  temporary=`${input.outputPath}.${randomUUID()}.tmp`;await writeFile(temporary,bytes,{flag:'wx',mode:0o600});await link(temporary,input.outputPath);await unlink(temporary);temporary=undefined;
  return {outputPath:input.outputPath,estimatedCents:ESTIMATE,providerRequestId:queued.request_id,model:MODEL};
 }catch(error){const safe=error instanceof ProviderError?error:new ProviderError(controller.signal.aborted?'TIMEOUT':'PROVIDER',controller.signal.aborted?'Provider request timed out; it may still incur a charge.':'Generation failed. Check the provider dashboard before retrying; a charge may have occurred.');safe.submitted=submitted;safe.providerRequestId=requestId;throw safe;}
 finally{clearTimeout(timer);if(temporary)await unlink(temporary).catch(()=>{});}
}
