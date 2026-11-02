"""Restricted, local-only OpenMontage video_stitch adapter; no provider discovery."""
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import socket
import subprocess
import sys

PIN = '195eab24478dc9363326aec437aefc3701635ddf'

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=120)

def main():
    packet_path = Path(sys.argv[1]).resolve(strict=True)
    p = json.loads(packet_path.read_text())
    output = packet_path.parent
    if Path(p['outputDir']).resolve() != output or (p['durationSeconds'],p['width'],p['height'],p['fps']) != (27,1080,1920,30):
        raise ValueError('Invalid packet')
    root = Path(p['openMontageRoot']).resolve(strict=True)
    if run(['git','-C',str(root),'rev-parse','HEAD']).stdout.strip() != PIN:
        raise ValueError('OpenMontage revision differs from audited version')
    # Defense in depth where unprivileged network namespaces are unavailable.
    def denied(*args, **kwargs):
        raise RuntimeError('Network disabled in local preview worker')
    socket.create_connection = denied
    socket.socket.connect = denied
    socket.socket.connect_ex = denied
    sys.path.insert(0,str(root))
    import tools.video.video_stitch as stitch_module
    from tools.tool_registry import ToolRegistry
    registry = ToolRegistry()
    registry.register_module(stitch_module)  # No global discovery, .env loading, API tools or downloads.
    tool = registry.get('video_stitch')
    work = output/'work'
    work.mkdir(mode=0o700)
    clips=[]
    manifest=[]
    images=p['images']
    if not 1 <= len(images) <= 12:
        raise ValueError('Invalid image count')
    # VideoStitch requires two clips; split a single still into two identical holds.
    if len(images) == 1:
        images = images * 2
    for i,image in enumerate(images):
        source=Path(image['path'])
        if not source.is_absolute() or source.resolve(strict=True)!=source or not source.is_file() or source.stat().st_size>25*1024*1024:
            raise ValueError('Invalid source')
        if hashlib.sha256(source.read_bytes()).hexdigest()!=image['sha256']:
            raise ValueError('Source changed after approval')
        # Copy validated bytes into fixed filenames before invoking decoders/tools.
        snapshot=work/f'source-{i:02d}.image'
        shutil.copyfile(source,snapshot)
        if hashlib.sha256(snapshot.read_bytes()).hexdigest()!=image['sha256']:
            raise ValueError('Source changed during snapshot')
        source_probe=json.loads(run(['ffprobe','-v','error','-show_streams','-of','json',str(snapshot)]).stdout)
        source_video=source_probe['streams'][0]
        if source_video.get('width',0)*source_video.get('height',0)>40000000:
            raise ValueError('Image dimensions exceed preview limit')
        frames=810//len(images)+(1 if i<810%len(images) else 0)
        clip=work/f'clip-{i:02d}.mp4'
        run(['ffmpeg','-v','error','-nostdin','-n','-protocol_whitelist','file,pipe','-loop','1','-i',str(snapshot),'-frames:v',str(frames),'-vf','scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x171c22,setsar=1','-r','30','-an','-c:v','libx264','-threads','2','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p',str(clip)])
        clips.append(str(clip))
        manifest.append({'id':image['id'],'sha256':image['sha256'],'frames':frames,'startFrame':sum(x['frames'] for x in manifest)})
    destination=output/'preview.mp4'
    result=tool.execute({'operation':'stitch','clips':clips,'output_path':str(destination),'transition':'cut','auto_normalize':False})
    if not result.success:
        raise RuntimeError('OpenMontage video_stitch failed')
    # Local stream-copy normalization adds web playback metadata; the montage itself is OpenMontage's output.
    normalized=output/'normalized.mp4'
    music=p.get('music')
    audio_report={'mode':'silent','disclosure':'No soundtrack selected.'}
    if music:
        source=Path(music['path'])
        if music.get('licenseConfirmed') is not True or not source.is_absolute() or source.resolve(strict=True)!=source or not source.is_file() or not 0<source.stat().st_size<=25*1024*1024:
            raise ValueError('Invalid approved music')
        snapshot=work/'music.audio'
        shutil.copyfile(source,snapshot)
        if hashlib.sha256(snapshot.read_bytes()).hexdigest()!=music['sha256']:
            raise ValueError('Music changed after approval')
        audio_probe=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(snapshot)]).stdout)
        if audio_probe['format']['format_name'] not in ('wav','mp3') or not any(x['codec_type']=='audio' for x in audio_probe['streams']) or any(x['codec_type']=='video' for x in audio_probe['streams']):
            raise ValueError('Music must be WAV or MP3 audio')
        run(['ffmpeg','-v','error','-nostdin','-n','-i',str(destination),'-stream_loop','-1','-protocol_whitelist','file,pipe','-i',str(snapshot),'-map','0:v:0','-map','1:a:0','-t','27','-af','volume=0.5,alimiter=limit=0.8:level=false,afade=t=in:st=0:d=0.5,afade=t=out:st=25.5:d=1.5','-c:v','copy','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-movflags','+faststart',str(normalized)])
        audio_report={'mode':'licensed-upload','sourceId':music['id'],'sourceSha256':music['sha256'],'licenseConfirmed':True,'licenseBasis':'Explicit operator declaration; no automated rights determination.','codec':'aac','sampleRate':48000,'loopedToDuration':True,'fadeInSeconds':0.5,'fadeOutSeconds':1.5}
    else:
        run(['ffmpeg','-v','error','-nostdin','-n','-i',str(destination),'-map','0:v:0','-an','-c:v','copy','-movflags','+faststart',str(normalized)])
    normalized.replace(destination)
    probe=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(destination)]).stdout)
    video=next(s for s in probe['streams'] if s['codec_type']=='video')
    if (video['width'],video['height'],video['codec_name'],video['pix_fmt'])!=(1080,1920,'h264','yuv420p') or abs(float(probe['format']['duration'])-27)>0.05 or video['r_frame_rate']!='30/1':
        raise RuntimeError('Output profile verification failed')
    run(['ffmpeg','-v','error','-xerror','-nostdin','-i',str(destination),'-f','null','-'])
    if music:
        audio=next(x for x in probe['streams'] if x['codec_type']=='audio')
        if audio['codec_name']!='aac' or audio['sample_rate']!='48000':
            raise RuntimeError('Audio profile verification failed')
        levels=run(['ffmpeg','-hide_banner','-nostdin','-i',str(destination),'-vn','-af','volumedetect','-f','null','-']).stderr
        maximum=re.search(r'max_volume: (-?[0-9.]+) dB',levels)
        mean=re.search(r'mean_volume: (-?[0-9.]+) dB',levels)
        if not maximum or not mean or float(maximum.group(1))> -0.1 or float(mean.group(1)) < -60:
            raise RuntimeError('Audio is silent or exceeds safe peak')
        audio_report.update({'peakDb':float(maximum.group(1)),'meanDb':float(mean.group(1)),'noClippingPassed':True,'nonSilentPassed':True})
    elif any(x['codec_type']=='audio' for x in probe['streams']):
        raise RuntimeError('Unexpected soundtrack')
    report={'status':'verified','kind':'source-image-preview','disclosure':'Still-based source-image preview. No generated model motion.'+(' Operator-confirmed soundtrack.' if music else ' No soundtrack.'),'audio':audio_report,'durationSeconds':float(probe['format']['duration']),'width':1080,'height':1920,'fps':30,'fullDecodePassed':True,'tool':'video_stitch','toolVersion':tool.version,'openMontageRevision':PIN,'runtime':'ffmpeg','costCents':0,'networkNamespace':os.environ.get('SHIVALI_NETWORK_NAMESPACE')=='1','networkPolicy':'No provider discovery or downloads; Python network calls denied; only fixed local FFmpeg commands.','sha256':hashlib.sha256(destination.read_bytes()).hexdigest()}
    (output/'asset-manifest.json').write_text(json.dumps({'images':manifest,'music':audio_report,'toolResult':result.data},indent=2))
    (output/'render-report.json').write_text(json.dumps(report,indent=2))
    shutil.rmtree(work)

if __name__=='__main__':
    try:
        main()
    except Exception:
        # No raw provider/tool exception or environment contents in persisted reports.
        sys.exit(1)
