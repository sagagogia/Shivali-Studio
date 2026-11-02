import { appOrigin,incomingUrl } from './origin.ts';
export function sameOrigin(request:Request):boolean { const origin=request.headers.get('origin');return !origin || origin===appOrigin(incomingUrl(request)); }
export async function boundedJson(request:Request):Promise<Record<string,unknown>> {
 const reader=request.body?.getReader();if(!reader)throw new Error('Request body required');
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>65536){await reader.cancel();throw new Error('Request too large');}chunks.push(chunk.value);}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Request must be an object');
 return value;
}
export function safeError(error:unknown,fallback='Studio action failed'):Response { const message=error instanceof Error?error.message:fallback;return Response.json({error:/ENOENT|EACCES|SQLITE|\/workspace|\/home|fetch failed|Unexpected token/.test(message)?fallback:message},{status:400}); }
