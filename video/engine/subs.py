# Builds subs.ass from timeline.json; speaker name prefix in speaker colour; long sentences split into <=80-char chunks.
import sys, os; sys.path.insert(0, os.getcwd())
import json, re
from scenes import NAMES
tl=json.load(open("timeline.json"))
def ts(x): h=int(x//3600); m=int(x%3600//60); s=x%60; return f"{h}:{m:02d}:{s:05.2f}"
def chunks(s, n=80):
    if len(s)<=n: return [s]
    parts=re.split(r"(?<=[,.;:?!—])\s+", s); out=[]; cur=""
    for p in parts:
        if cur and len(cur)+1+len(p)>n: out.append(cur); cur=p
        else: cur=(cur+" "+p).strip()
    out.append(cur); return out
COL={"a":"&H0070A8FF&","m":"&H00F090C8&","t":"&H0090E0A0&"}   # ASS colours are BGR
head="""[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,24,&H00F0F5FF,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,0,0,1,2,1,2,60,60,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ev=[]
for b in tl["beats"]:
    who=b["who"]; tag="{\\c"+COL[who]+"\\b1}"+NAMES[who]+":{\\r} "
    for c0,c1,s in b["cues"]:
        cs=chunks(s); tot=sum(len(x) for x in cs); t=c0
        for x in cs:
            d=(c1-c0)*len(x)/tot; ev.append(f"Dialogue: 0,{ts(t)},{ts(t+d+0.15)},Default,,0,0,0,,{tag}{x}"); t+=d
open("subs.ass","w").write(head+"\n".join(ev)+"\n"); print(len(ev),"events")
