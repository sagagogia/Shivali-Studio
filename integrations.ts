import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Integration } from './types.ts';
import { getProviderStatus } from './provider.ts';
export function integrations():Integration[]{
 const root=process.env.SHIVALI_OPENMONTAGE_ROOT||'/workspace/scratch/openmontage-inspection-_5ol60ly/OpenMontage';
 const montage=existsSync(join(root,'.venv/bin/python'))&&existsSync(join(root,'tools/video/video_stitch.py'));
 const fal=getProviderStatus();
 return [
  {id:'records',name:'Private production records',status:'ready',detail:'SQLite on local disk. Assets are served privately from the studio, not public cloud URLs.'},
  {id:'openmontage',name:'OpenMontage',status:montage?'ready':'not_configured',detail:montage?'Local source-image preview worker installed. 27 seconds, 1080 × 1920.':'Set SHIVALI_OPENMONTAGE_ROOT to a compatible installed checkout.'},
  {id:'fal',name:'Model imagery via fal',status:fal.enabled?'ready':'not_configured',detail:fal.detail},
  {id:'higgsfield',name:'OpenHiggsfield model catalog',status:process.env.SHIVALI_ENABLE_ADVANCED_GENERATOR==='true'?'ready':'blocked',detail:'Original generator preserved at /generate. Disabled by default; campaign governance lives in Shivali Studio.'},
  {id:'planning',name:'Creative director and copy desk',status:'ready',detail:'Offline structured drafts from garment specifications. No live LLM or trend inference is claimed.'},
  {id:'research',name:'Fashion research',status:'not_configured',detail:'Add permitted, dated source evidence in Research. No Instagram scraping or fabricated trends.'},
  {id:'music',name:'Music licensing',status:'not_configured',detail:'Upload a track only after verifying commercial, social and advertising rights. The studio does not grant music rights.'},
  {id:'publishing',name:'Instagram publishing',status:'blocked',detail:'Export for human handoff only. Nothing is published automatically.'}
 ];
}
