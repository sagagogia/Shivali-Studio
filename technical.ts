import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export function verifyMedia(path:string,mimeType:string,expectedHash:string):void {
 try {
  if(createHash('sha256').update(readFileSync(path)).digest('hex')!==expectedHash)throw new Error('changed');
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',path],{timeout:10000,maxBuffer:262144,stdio:['ignore','pipe','pipe']}).toString());
  const image=mimeType.startsWith('image/'),audio=mimeType.startsWith('audio/');
  const stream=probe.streams?.find((s:{codec_type:string})=>s.codec_type===(audio?'audio':'video'));
  if(!stream)throw new Error('missing stream');
  if(!audio&&(!stream.width||!stream.height||stream.width*stream.height>40000000))throw new Error('dimensions');
  const duration=Number(probe.format?.duration||stream.duration||0);if(!image&&(!Number.isFinite(duration)||duration<=0||duration>600))throw new Error('duration');
  execFileSync('ffmpeg',['-v','error','-xerror','-nostdin','-protocol_whitelist','file,pipe','-threads','2','-i',path,...(image?['-frames:v','1']:[]),'-f','null','-'],{timeout:30000,maxBuffer:262144,stdio:['ignore','pipe','pipe']});
 }catch{throw new Error('Media technical QA failed: file could not be safely decoded or exceeds the 40-megapixel / 10-minute limit.');}
}
