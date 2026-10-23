# Trim TTS silences, lay out beats, write audio/voice.wav + timeline.json (run by video/render.py).
import sys, os; sys.path.insert(0, os.getcwd())
import numpy as np, subprocess, json, wave
from scenes import BEATS, say, sub
from tts import fn
SR = 48000
def load(p):
    raw = subprocess.run(["ffmpeg","-loglevel","error","-i",p,"-f","s16le","-ac","1","-ar",str(SR),"-"],capture_output=True).stdout
    return np.frombuffer(raw,np.int16).astype(np.float32)/32768
def trim(x, maxgap=0.38):
    win=int(SR*0.01); n=len(x)//win
    e=np.sqrt((x[:n*win].reshape(n,win)**2).mean(1)); loud=e>0.01
    idx=np.where(loud)[0]; s=max(0,idx[0]-2); t=min(n,idx[-1]+4); keep=[]; gap=0
    for j in range(s,t):
        if loud[j]: gap=0; keep.append(j)
        else:
            gap+=1
            if gap<=maxgap*100: keep.append(j)
    return np.concatenate([x[j*win:(j+1)*win] for j in keep])
INTRO=2.5; SENT_GAP=0.3; OUTRO=4.0
track=[np.zeros(int(SR*INTRO))]; cur=INTRO; beats=[]
def sil(d):
    global cur; track.append(np.zeros(int(SR*d))); cur+=d
for i,(who,setting,bub,sents,key) in enumerate(BEATS):
    t0=cur
    sil((1.3 if BEATS[i-1][1]!=setting else 0.8) if (i and BEATS[i-1][0]!=who) else (1.3 if i and BEATS[i-1][1]!=setting else 0.5))   # "typing..." pause
    start=cur; cues=[]
    for j,s in enumerate(sents):
        if isinstance(s,(int,float)): sil(s); continue
        if j: sil(SENT_GAP)
        a=trim(load(fn(who,say(s)))); c0=cur; track.append(a); cur+=len(a)/SR
        cues.append([c0,cur,sub(s)])
    sil(0.25)
    beats.append({"i":i,"who":who,"key":key,"setting":setting,"bubble":bub,"t0":t0,"start":start,"end":cur,"cues":cues})
sil(OUTRO)
a=np.concatenate(track)
w=wave.open("audio/voice.wav","wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(a,-1,1)*32767).astype(np.int16).tobytes()); w.close()
json.dump({"dur":cur,"beats":beats},open("timeline.json","w"),ensure_ascii=False,indent=1)
print("total",round(cur,2))
