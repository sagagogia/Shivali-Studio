import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
process.env.SHIVALI_DATA_DIR=mkdtempSync(join(tmpdir(),'shivali-qa-'));
const core=await import('../src/studio/core.ts');
test('manual approval cannot accept a corrupt image with a valid signature',()=>{
 const s=core.getSnapshot(),g=s.garments[0],c=s.campaigns[0];
 const a=core.saveUpload({name:'truncated.png',type:'image/png',bytes:Buffer.from([137,80,78,71,13,10,26,10,0])},{garmentId:g.id,campaignId:c.id,kind:'image'});
 assert.throws(()=>core.applyAction({type:'asset.review',assetId:a.id,garmentAccuracy:'pass',notes:'Looks good'}),/decode|technical|media/i);
});
test('a decodable image can pass technical QA but still needs explicit garment review',()=>{
 const s=core.getSnapshot(),g=s.garments[0],c=s.campaigns[0],p=join(process.env.SHIVALI_DATA_DIR!,'valid.png');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=96x144','-frames:v','1','-threads','1',p]);
 const a=core.saveUpload({name:'valid.png',type:'image/png',bytes:readFileSync(p)},{garmentId:g.id,campaignId:c.id,kind:'image'});
 const updated=core.applyAction({type:'asset.review',assetId:a.id,garmentAccuracy:'pass',notes:'Product checked'}).assets.find(x=>x.id===a.id)!;
 assert.equal(updated.qa?.technicalPassed,true);assert.equal(updated.qa?.garmentAccuracy,'pass');
});
