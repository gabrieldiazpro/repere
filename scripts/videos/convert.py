import json,subprocess,sys,os
raw=sys.argv[1]; out=sys.argv[2]
def ts(t):
    h=int(t//3600); m=int(t%3600//60); s=t%60
    return f"{h:02d}:{m:02d}:{s:06.3f}"
for id in (sys.argv[3].split(',') if len(sys.argv)>3 else ['hero','mesurer','comprendre','agir','prouver']):
    src=f"{raw}/{id}.webm"; d=json.load(open(f"{raw}/{id}.json"))
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',src,'-an','-c:v','libx264','-preset','veryfast','-crf','26','-pix_fmt','yuv420p','-movflags','+faststart',f"{out}/{id}.mp4"],check=True)
    m=d['marks']; poster=m[0]['t']+2.5
    subprocess.run(['ffmpeg','-y','-loglevel','error','-ss',str(poster),'-i',f"{out}/{id}.mp4",'-frames:v','1','-q:v','4',f"{out}/{id}.jpg"],check=True)
    dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f"{out}/{id}.mp4"],capture_output=True,text=True).stdout)
    v="WEBVTT\n"
    for i,k in enumerate(m):
        end=m[i+1]['t'] if i+1<len(m) else dur
        v+=f"\n{ts(k['t'])} --> {ts(end)}\n{k['caption']}\n"
    open(f"{out}/{id}.fr.vtt",'w').write(v)
    print(id, round(dur,1))
