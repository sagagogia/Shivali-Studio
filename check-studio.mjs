import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const montage=process.env.SHIVALI_OPENMONTAGE_ROOT||'/workspace/scratch/openmontage-inspection-_5ol60ly/OpenMontage';
const tools=['node','ffmpeg','ffprobe'].map(name=>({name,available:spawnSync(name,['-version'],{stdio:'ignore'}).error===undefined}));
console.log(JSON.stringify({node:process.version,tools,openMontageInstalled:existsSync(`${montage}/.venv/bin/python`),authenticationConfigured:Boolean(process.env.SHIVALI_AUTH_PASSWORD&&process.env.SHIVALI_SESSION_SECRET),bindAddress:process.env.SHIVALI_HOST||'127.0.0.1',databaseDirectory:process.env.SHIVALI_DATA_DIR||'.studio-data',falKeyConfigured:Boolean(process.env.FAL_KEY),paidGenerationEnabled:process.env.SHIVALI_ENABLE_PAID_GENERATION==='true',advancedGeneratorEnabled:process.env.SHIVALI_ENABLE_ADVANCED_GENERATOR==='true',publishing:'export-only'},null,2));
