# Synthesized soft string pad (numpy), no samples needed (run by video/render.py).
import sys, os; sys.path.insert(0, os.getcwd())
import numpy as np, wave, json
sr=48000; T=json.load(open("timeline.json"))["dur"]+0.5
t=np.arange(int(sr*T))/sr
def n2f(n): return 440*2**((n-69)/12)
chords=[[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,59]]  # C Am F G
cl=6.0; out=np.zeros_like(t)
def string(f,tt):
    vib=1+0.003*np.sin(2*np.pi*4.8*tt); ph=2*np.pi*f*np.cumsum(vib)/sr
    return sum((1/h**1.3)*np.sin(h*ph) for h in range(1,5))
for i in range(int(T/cl)+1):
    s=int(i*cl*sr); e=min(len(t),int((i+1)*cl*sr+sr*2))
    if s>=len(t): break
    tt=t[s:e]-t[s]; env=np.minimum(1,tt/2.5)*np.exp(-np.maximum(0,tt-cl)/1.0)
    for n in chords[i%4]:
        for det in (-0.5,0.5): out[s:e]+=env*string(n2f(n)+det,tt)*0.4
    out[s:e]+=env*np.sin(2*np.pi*n2f(chords[i%4][0]-12)*tt)*0.8
k=np.ones(64)/64; out=np.convolve(out,k,mode="same")
out*=np.minimum(1,t/3)*np.minimum(1,(T-t)/3); out/=np.abs(out).max()
st=np.stack([out,np.roll(out,int(sr*0.017))],1)
w=wave.open("audio/music.wav","wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes((st*0.9*32767).astype(np.int16).tobytes()); w.close()
print(T)
