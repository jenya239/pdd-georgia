# ПДД Грузии series engine: PIL frames piped to ffmpeg.
# Settings: chat, board, web (browser), road (top-down scheme), car (interior), exam (exam-screen mockup).
# Episode folder provides scenes.py + boards.py; run via video/render.py <ep>
import numpy as np, math, subprocess, sys, json, io, os
from PIL import Image, ImageDraw, ImageFont
import matplotlib; matplotlib.use("Agg")
from matplotlib import rcParams
from matplotlib.figure import Figure
from matplotlib.backends.backend_agg import FigureCanvasAgg
rcParams["mathtext.fontset"] = "cm"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import ENGINE, SOURCES, TICKETS, SIGNS
import scenes as SC
from scenes import NAMES, ROLES
try: from scenes import GLOSS
except ImportError: GLOSS=[]
W,H,FPS = 1280,720,24
TLD = json.load(open("timeline.json")); BEATS = TLD["beats"]; DUR = TLD["dur"]
GF = "/usr/share/fonts/truetype/sand-box/google/"
RB = GF+"Roboto/Roboto-VariableFont_wdth,wght.ttf"; RS = GF+"Roboto Slab/RobotoSlab-VariableFont_wght.ttf"
DJ = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; DJB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_c = {}
def F(path, sz, var=None):
    k=(path,sz,var)
    if k not in _c:
        f=ImageFont.truetype(path,sz)
        if var:
            try: f.set_variation_by_name(var)
            except Exception: pass
        _c[k]=f
    return _c[k]
def ease(t): t=min(max(t,0),1); return t*t*(3-2*t)
WHITE=(240,236,225); GOLD=(245,195,80); PINK=(255,110,140); GREEN=(110,220,140); BLUE=(110,170,255); RED=(255,85,70); GREY=(150,155,165)
SS = 2  # board supersampling
# ---------- formulas (matplotlib mathtext, cached) ----------
def tex(s, size=26, color=WHITE):
    k=("tex",s,size,color)
    if k not in _c:
        fig=Figure(figsize=(1,1)); FigureCanvasAgg(fig)
        fig.text(0,0,"$"+s+"$",fontsize=size,color=tuple(c/255 for c in color))
        b=io.BytesIO(); fig.savefig(b,dpi=72*SS,transparent=True,bbox_inches="tight",pad_inches=0.03,format="png")
        b.seek(0); _c[k]=Image.open(b).convert("RGBA")
    return _c[k]
def put(img, im, xy, a=1.0, anchor="lt"):
    if a<=0: return
    x,y=xy
    if anchor[0]=="m": x-=im.size[0]/2
    if anchor[0]=="r": x-=im.size[0]
    if anchor[1]=="m": y-=im.size[1]/2
    if a<1: im=im.copy(); im.putalpha(im.getchannel("A").point(lambda v:int(v*a)))
    img.paste(im,(int(x),int(y)),im)
def ftex(img, s, xy, size=26, color=WHITE, a=1.0, anchor="lt"): put(img, tex(s,size,color), (xy[0]*SS,xy[1]*SS), a, anchor)
def txt(d, xy, s, sz, col=WHITE, a=1.0, anchor="la", font=None):
    if a<=0: return
    d.text((xy[0]*SS,xy[1]*SS), s, font=F(font or DJ, int(sz*SS)), fill=col+(int(255*a),), anchor=anchor)
# ---------- plot helper (board coords in 1x px, drawn at SS) ----------
class Plot:
    def __init__(s, d, rect, xr, yr): s.d=d; s.r=rect; s.xr=xr; s.yr=yr
    def X(s,x): x0,y0,x1,y1=s.r; return SS*(x0+(x-s.xr[0])/(s.xr[1]-s.xr[0])*(x1-x0))
    def Y(s,y): x0,y0,x1,y1=s.r; return SS*(y1-(y-s.yr[0])/(s.yr[1]-s.yr[0])*(y1-y0))
    def axes(s, xlab="x", ylab="y"):
        ax=min(max(0,s.yr[0]),s.yr[1]); ay=min(max(0,s.xr[0]),s.xr[1])
        s.d.line([s.X(s.xr[0]),s.Y(ax),s.X(s.xr[1]),s.Y(ax)],fill=(120,128,140,255),width=2*SS//2+1)
        s.d.line([s.X(ay),s.Y(s.yr[0]),s.X(ay),s.Y(s.yr[1])],fill=(120,128,140,255),width=2*SS//2+1)
        s.d.text((s.X(s.xr[1])-8*SS,s.Y(ax)+6*SS),xlab,font=F(DJ,16*SS),fill=GREY+(255,),anchor="ra")
        s.d.text((s.X(ay)+8*SS,s.Y(s.yr[1])+2*SS),ylab,font=F(DJ,16*SS),fill=GREY+(255,),anchor="la")
    def curve(s, f, col, w=3, x0=None, x1=None, n=800, mask=None, jump=None):
        x0=s.xr[0] if x0 is None else x0; x1=s.xr[1] if x1 is None else x1
        xs=np.linspace(x0,x1,n)
        with np.errstate(all="ignore"): ys=f(xs)
        pts=[]; jump=jump or (s.yr[1]-s.yr[0])*0.6
        def flush():
            if len(pts)>1: s.d.line(pts,fill=col+(255,),width=int(w*SS),joint="curve")
            pts.clear()
        prev=None
        for x,y in zip(xs,ys):
            ok=np.isfinite(y) and (mask is None or mask(x,y)) and (s.yr[0]-1e3<y<s.yr[1]+1e3)
            if not ok or (prev is not None and abs(y-prev)>jump): flush()
            if ok: pts.append((s.X(x),s.Y(min(max(y,s.yr[0]-0.5*(s.yr[1]-s.yr[0])),s.yr[1]+0.5*(s.yr[1]-s.yr[0])))))
            prev=y if ok else None
        flush()
    def hband(s,y0,y1,col,a=0.25):
        s.d.rectangle([s.X(s.xr[0]),s.Y(min(y1,s.yr[1])),s.X(s.xr[1]),s.Y(max(y0,s.yr[0]))],fill=col+(int(255*a),))
        for y in (y0,y1):
            if s.yr[0]<=y<=s.yr[1]: s.dash(s.xr[0],y,s.xr[1],y,col)
    def vband(s,x0,x1,col,a=0.22):
        s.d.rectangle([s.X(max(x0,s.xr[0])),s.Y(s.yr[1]),s.X(min(x1,s.xr[1])),s.Y(s.yr[0])],fill=col+(int(255*a),))
        for x in (x0,x1):
            if s.xr[0]<=x<=s.xr[1]: s.dash(x,s.yr[0],x,s.yr[1],col)
    def dash(s,x0,y0,x1,y1,col,a=0.9,w=2):
        X0,Y0,X1,Y1=s.X(x0),s.Y(y0),s.X(x1),s.Y(y1); L=math.hypot(X1-X0,Y1-Y0); n=max(1,int(L/(10*SS)))
        for i in range(n):
            if i%2==0:
                f0=i/n; f1=min(1,(i+1)/n)
                s.d.line([X0+(X1-X0)*f0,Y0+(Y1-Y0)*f0,X0+(X1-X0)*f1,Y0+(Y1-Y0)*f1],fill=col+(int(255*a),),width=w*SS)
    def dot(s,x,y,col,r=6,hollow=False,bg=None):
        bg=bg or BG; X,Y=s.X(x),s.Y(y); R=r*SS
        s.d.ellipse([X-R,Y-R,X+R,Y+R],fill=(bg+(255,)) if hollow else col+(255,),outline=col+(255,),width=int(2.5*SS))
    def label(s,x,y,t,col,sz=18,anchor="la",dx=0,dy=0): s.d.text((s.X(x)+dx*SS,s.Y(y)+dy*SS),t,font=F(DJ,int(sz*SS)),fill=col+(255,),anchor=anchor)
# ---------- themes (board functions read these globals) ----------
THEMES={
 "dark": dict(BG=(28,33,44),WHITE=(240,236,225),GOLD=(245,195,80),PINK=(255,110,140),GREEN=(110,220,140),BLUE=(110,170,255),RED=(255,85,70),GREY=(150,155,165),CURVE=(205,210,220)),
 "board":dict(BG=(246,246,241),WHITE=(30,36,52),GOLD=(196,110,0),PINK=(196,36,100),GREEN=(20,130,66),BLUE=(28,86,196),RED=(205,40,30),GREY=(110,112,124),CURVE=(40,46,62)),
 "scope":dict(BG=(6,18,12),WHITE=(200,255,215),GOLD=(255,210,90),PINK=(255,120,160),GREEN=(90,255,140),BLUE=(110,190,255),RED=(255,80,70),GREY=(90,150,110),CURVE=(90,255,140)),
 "map":  dict(BG=(236,232,222),WHITE=(30,36,52),GOLD=(196,110,0),PINK=(196,36,100),GREEN=(20,130,66),BLUE=(28,86,196),RED=(205,40,30),GREY=(110,112,124),CURVE=(40,46,62)),
 "dash": dict(BG=(12,14,18),WHITE=(235,235,235),GOLD=(255,190,70),PINK=(255,110,150),GREEN=(110,230,140),BLUE=(90,170,255),RED=(255,70,50),GREY=(120,125,135),CURVE=(200,205,215)),
 "mcu":  dict(BG=(14,24,26),WHITE=(225,235,232),GOLD=(255,200,90),PINK=(255,120,160),GREEN=(110,230,150),BLUE=(100,180,255),RED=(255,90,80),GREY=(120,140,140),CURVE=(200,210,215)),
 "pend": dict(BG=(243,239,230),WHITE=(36,38,50),GOLD=(190,105,0),PINK=(190,40,100),GREEN=(25,125,70),BLUE=(30,90,190),RED=(200,45,35),GREY=(115,112,120),CURVE=(40,44,60)),
 "cplx": dict(BG=(10,14,32),WHITE=(230,234,245),GOLD=(255,200,90),PINK=(255,120,170),GREEN=(110,230,150),BLUE=(110,170,255),RED=(255,90,80),GREY=(130,140,165),CURVE=(210,215,230)),
 "web":  dict(BG=(250,250,252),WHITE=(28,32,44),GOLD=(190,110,0),PINK=(190,40,100),GREEN=(25,125,70),BLUE=(30,90,190),RED=(200,45,35),GREY=(115,118,130),CURVE=(40,44,60)),
 "road": dict(BG=(108,142,92),WHITE=(28,32,44),GOLD=(196,110,0),PINK=(190,40,100),GREEN=(20,120,60),BLUE=(28,86,196),RED=(205,40,30),GREY=(110,112,124),CURVE=(40,46,62)),
 "car":  dict(BG=(18,20,26),WHITE=(235,235,235),GOLD=(255,196,80),PINK=(255,110,150),GREEN=(110,230,140),BLUE=(100,170,255),RED=(255,80,60),GREY=(130,135,145),CURVE=(200,205,215)),
 "exam": dict(BG=(236,240,246),WHITE=(26,32,48),GOLD=(196,110,0),PINK=(190,40,100),GREEN=(20,135,70),BLUE=(30,90,200),RED=(205,40,30),GREY=(110,116,130),CURVE=(40,46,62)),
 "code": dict(BG=(30,32,40),WHITE=(220,223,228),GOLD=(229,192,123),PINK=(198,120,221),GREEN=(152,195,121),BLUE=(97,175,239),RED=(224,108,117),GREY=(110,116,128),CURVE=(205,210,220)),
}
def set_theme(n): globals().update(THEMES[n])
set_theme("dark")
BW,BH=730,580
class Blk:  # sentence timing within a block (local times)
    def __init__(s, beats, T0): s.cues=[(c[0]-T0,c[1]-T0) for b in beats for c in b["cues"]]
    def S(s,k): return s.cues[k][0] if k<len(s.cues) else 1e9
    def E(s,k): return s.cues[min(k,len(s.cues)-1)][1]
def eps_cycle(t, lo=0.22, hi=1.1, per=7.0): return lo+(hi-lo)*(0.5+0.5*math.cos(2*math.pi*t/per))
def delta_for(f,a,L,eps,lim=3.0,punct=True):
    for d in np.linspace(lim,0.001,600):
        xs=np.linspace(a-d,a+d,121)
        if punct: xs=xs[np.abs(xs-a)>1e-9]
        if np.all(np.abs(f(xs)-L)<eps): return d*0.97
    return 0.001
PIECES=[]
def pieces(img,d,t,k_hl,x=24,y=20,showlab=True,a=1.0,size=26):
    for i,(s,col,lab) in enumerate(PIECES):
        im=tex(s,size,col); w=im.size[0]/SS
        if i==k_hl: d.rounded_rectangle([(x-6)*SS,(y-6)*SS,(x+w+6)*SS,(y+im.size[1]/SS+6)*SS],8*SS,fill=col+(40,),outline=col+(255,),width=2*SS)
        put(img,im,(x*SS,y*SS),a if (k_hl is None or i<=k_hl) else 0.35*a)
        if showlab: txt(d,(x+w/2,y+im.size[1]/SS+12),lab,14,col,a*(1 if (k_hl is None or i<=k_hl) else 0.35),"ma")
        x+=max(w,F(DJ,14*SS).getlength(lab)/SS)+18
    return x
def lines_tex(img,L,t,B,x=20,y=14,size=24,gap=12):
    for s,col,k in L:
        if t>B.S(k)-0.1: im=tex(s,size,col); put(img,im,(x*SS,y*SS),ease((t-B.S(k))/0.5)); y+=im.size[1]/SS+gap
    return y
exec(open(ENGINE/"lib.py",encoding='utf-8').read())
exec(open('boards.py',encoding='utf-8').read())  # b_<key> scene functions
def deco(img,d,setting):
    if setting=="board":
        rng=np.random.default_rng(2)
        for _ in range(6):
            x,y=rng.uniform(0,BW),rng.uniform(0,BH); r=rng.uniform(60,160)
            d.ellipse([(x-r)*SS,(y-r*0.4)*SS,(x+r)*SS,(y+r*0.4)*SS],fill=(215,218,222,5))
    if setting=="scope":
        x0,y0,x1,y1=40,60,BW-40,BH-60
        for i in range(11): X=x0+(x1-x0)*i/10; d.line([X*SS,y0*SS,X*SS,y1*SS],fill=(40,90,60,255) if i%5 else (60,130,85,255),width=SS)
        for j in range(9): Y=y0+(y1-y0)*j/8; d.line([x0*SS,Y*SS,x1*SS,Y*SS],fill=(40,90,60,255) if j%4 else (60,130,85,255),width=SS)
def board(key,t,B,D,size,setting):
    global BW,BH
    BW,BH=size; img=Image.new("RGB",(BW*SS,BH*SS),BG); d=ImageDraw.Draw(img,"RGBA")
    deco(img,d,setting); globals()["b_"+key](img,d,t,B,D)
    img=img.resize((BW,BH),Image.LANCZOS)
    if setting=="board":  # aluminium frame + marker tray
        dd=ImageDraw.Draw(img); dd.rounded_rectangle([0,0,BW-1,BH-1],14,outline=(170,175,182),width=7)
        dd.rectangle([BW*0.62,BH-9,BW*0.9,BH-3],fill=(150,155,160))
        for i,c in enumerate([(30,36,52),(28,86,196),(196,36,100),(20,130,66)]): dd.rounded_rectangle([BW*0.64+i*34,BH-15,BW*0.64+i*34+28,BH-8],3,fill=c)
    return img
# ---------- chat panel (Telegram-like) ----------
CX,CY,CW,CH=30,20,470,580; HEAD=56
NAMECOL={"a":(210,95,60),"m":(140,80,200),"t":(40,135,80)}
def wrap(s,font,maxw):
    out=[]; line=""
    for w in s.split(" "):
        tt=(line+" "+w).strip()
        if font.getlength(tt)<=maxw: line=tt
        else: out.append(line); line=w
    out.append(line); return out
def bubble(i):
    k=("bub",i)
    if k in _c: return _c[k]
    b=BEATS[i]; who=b["who"]; f=F(DJ,17); fn=F(DJB,14)
    lines=wrap(b["bubble"],f,300); lh=23
    tw=max([f.getlength(l) for l in lines]+[fn.getlength(NAMES[who])+10,120])
    w=int(tw+28); h=int(26+lh*len(lines)+26)
    col=(225,246,203) if who=="a" else (255,255,255)
    im=Image.new("RGBA",(w+8,h+4),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([3,3,w+5,h+3],16,fill=(0,0,0,30)); d.rounded_rectangle([0,0,w,h],16,fill=col+(255,))
    d.text((14,8),NAMES[who],font=fn,fill=NAMECOL[who])
    for j,l in enumerate(lines): d.text((14,28+j*lh),l,font=f,fill=(20,20,20))
    m=int(b["start"]//60)
    d.text((w-12,h-8),f"{SC.CLOCK[0]}:{SC.CLOCK[1]+m:02d}"+("  ✓✓" if who=="a" else ""),font=F(DJ,12),fill=(120,150,120) if who=="a" else (150,150,150),anchor="rd")
    _c[k]=im; return im
CHAT=None; YS={}
def chat(T):
    global CHAT
    if CHAT is None:
        CHAT=[i for i,b in enumerate(BEATS) if b["setting"]=="chat"]; y=12
        for i in CHAT: YS[i]=y; y+=bubble(i).size[1]+10
    panel=chat_bg().copy(); vis=[i for i in CHAT if BEATS[i]["start"]<=T]; avail=CH-HEAD-10
    def target(n):
        if n==0: return 0
        i=vis[n-1] if n<=len(vis) else CHAT[n-1]; return max(0,YS[i]+bubble(i).size[1]-avail)
    off=0
    if vis:
        n=len(vis); off=target(n-1)+(target(n)-target(n-1))*ease((T-BEATS[vis[-1]]["start"])/0.45)
    for i in vis:
        im=bubble(i); a=ease((T-BEATS[i]["start"])/0.3); y=HEAD+YS[i]-off+(1-a)*20
        if y>CH or y+im.size[1]<HEAD: continue
        x=CW-im.size[0]-12 if BEATS[i]["who"]=="a" else 12
        put(panel,im,(x,y),a)
    d=ImageDraw.Draw(panel,"RGBA"); d.rectangle([0,0,CW,HEAD],fill=(36,47,61,255))
    d.ellipse([12,8,52,48],fill=SC.CHAT_AV[1]+(255,)); d.text((32,28),SC.CHAT_AV[0],font=F(DJB,17),fill=(255,255,255),anchor="mm")
    d.text((64,10),SC.CHAT_TITLE,font=F(DJB,17),fill=(255,255,255))
    typing=[b for b in BEATS if b["setting"]=="chat" and b["t0"]<=T<b["start"]]
    st=(NAMES[typing[0]["who"]]+" печатает"+"."*(1+int(T*3)%3)) if typing else "3 участника"
    d.text((64,33),st,font=F(DJ,13),fill=(120,180,255) if typing else (150,165,180))
    mask=Image.new("L",(CW,CH),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,CW-1,CH-1],18,fill=255)
    return panel,mask
def chat_bg():
    if "cbg" not in _c:
        a=np.zeros((CH,CW,3),np.float32); yy=np.linspace(0,1,CH)[:,None]
        a[...]=(np.array([170,200,140])*(1-yy)[...,None]+np.array([130,175,120])*yy[...,None])
        rng=np.random.default_rng(1); im=Image.fromarray(a.astype(np.uint8)); d=ImageDraw.Draw(im,"RGBA")
        for _ in range(60):
            x,y,r=rng.uniform(0,CW),rng.uniform(0,CH),rng.uniform(6,16)
            if rng.random()<0.5: d.ellipse([x-r,y-r,x+r,y+r],outline=(255,255,255,40),width=2)
            else: d.rectangle([x-r,y-r/2,x+r,y+r/2],outline=(255,255,255,35),width=2)
        _c["cbg"]=im
    return _c["cbg"]
# ---------- frame ----------
def bgimg():
    if "bg" not in _c:
        a=np.zeros((H,W,3),np.float32); yy=np.linspace(0,1,H)[:,None,None]; xx=np.linspace(0,1,W)[None,:,None]
        a[...]=np.array([18,20,28])+np.array([14,10,24])*(1-yy)+np.array([6,10,14])*xx
        _c["bg"]=Image.fromarray(a.astype(np.uint8))
    return _c["bg"]
def rmask(w,h):
    k=("rm",w,h)
    if k not in _c: m=Image.new("L",(w,h),0); ImageDraw.Draw(m).rounded_rectangle([0,0,w-1,h-1],16,fill=255); _c[k]=m
    return _c[k]
LOC=dict(SC.LOC)
BLOCKS=[]
for b in BEATS:
    if BLOCKS and BLOCKS[-1]["key"]==b["key"] and BLOCKS[-1]["setting"]==b["setting"]: BLOCKS[-1]["beats"].append(b)
    else: BLOCKS.append({"key":b["key"],"setting":b["setting"],"beats":[b]})
for j,bl in enumerate(BLOCKS):
    bl["T0"]=0.0 if j==0 else bl["beats"][0]["t0"]; bl["new"]= j==0 or BLOCKS[j-1]["setting"]!=bl["setting"]
for j,bl in enumerate(BLOCKS): bl["T1"]=BLOCKS[j+1]["T0"] if j+1<len(BLOCKS) else DUR
def speaker_tag(fr,T,x,y):
    sp=[b for b in BEATS if b["start"]<=T<=b["end"]+0.2]
    if not sp: return
    who=sp[0]["who"]; d=ImageDraw.Draw(fr,"RGBA"); nm=f"{NAMES[who]} · {ROLES[who]}"; w=F(DJB,14).getlength(nm)+46
    d.rounded_rectangle([x,y,x+w,y+26],13,fill=(15,18,26,230)); d.ellipse([x+7,y+6,x+21,y+20],fill=NAMECOL[who]+(255,))
    d.text((x+30,y+13),nm,font=F(DJB,14),fill=(235,235,235),anchor="lm")
def loc_card(fr,t,setting):
    a=min(ease(t/0.4),ease((3.0-t)/0.5))
    if a<=0: return
    s=LOC[setting]; f=F(DJB,18); w=f.getlength(s)+40; lay=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(lay)
    d.rounded_rectangle([W/2-w/2,30,W/2+w/2,68],19,fill=(10,12,18,int(220*a))); d.text((W/2,49),s,font=f,fill=(255,225,150,int(255*a)),anchor="mm")
    fr.paste(lay,(0,0),lay)
# ---------- on-screen glossary (plain-Russian explanations of jargon), strip below the canvas ----------
GX0,GX1,GY=310,1260,606
def gloss_font(g):
    for sz in (14,13,12):
        w=F(DJ,sz).getlength(g)+34
        if w<=(GX1-GX0)/2-8: return sz,w
    return 12,w
GL=[]
def _gloss_sched():
    cues=[(c[0],c[2]) for b in BEATS for c in b["cues"]]; ev=[]
    for anchor,g in GLOSS:
        m=[c0 for c0,s in cues if anchor in s]
        if not m: raise SystemExit("gloss anchor not found: "+anchor)
        ev.append((m[0],g))
    ev.sort(key=lambda e:e[0]); free=[0.0,0.0]
    for t0,g in ev:
        k=min(range(2),key=lambda i:max(t0,free[i])); st=max(t0,free[k]); GL.append((st,st+6.0,g,k)); free[k]=st+6.3
_gloss_sched()
def gloss_strip(fr,T):
    act=[x for x in GL if x[0]<=T<=x[1]]
    if not act: return
    lay=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(lay)
    for t0,t1,g,k in act:
        a=min(ease((T-t0)/0.35),ease((t1-T)/0.35)); sz,w=gloss_font(g)
        x=GX1-w if k==0 else GX0
        d.rounded_rectangle([x,GY,x+w,GY+26],8,fill=(74,64,38,int(245*a)),outline=(150,125,65,int(255*a)),width=1); d.rounded_rectangle([x,GY,x+5,GY+26],3,fill=(255,200,90,int(255*a)))
        term,_,rest=g.partition(" — ")
        if rest:
            d.text((x+16,GY+13),term,font=F(DJB,sz),fill=(255,214,120,int(255*a)),anchor="lm"); xx=x+16+F(DJB,sz).getlength(term)
            d.text((xx,GY+13)," — "+rest,font=F(DJ,sz),fill=(225,228,235,int(255*a)),anchor="lm")
        else: d.text((x+16,GY+13),g,font=F(DJ,sz),fill=(225,228,235,int(255*a)),anchor="lm")
    fr.paste(lay,(0,0),lay)
def frame_at(j,T):
    bl=BLOCKS[j]; B=Blk(bl["beats"],bl["T0"]); t=T-bl["T0"]; D=bl["T1"]-bl["T0"]; st=bl["setting"]
    fr=bgimg().copy()
    if st=="chat":
        set_theme("dark"); p,m=chat(T); fr.paste(p,(CX,CY),m)
        b=board(bl["key"],t,B,D,(730,580),st); fr.paste(b,(520,20),rmask(730,580))
    else:
        set_theme(st); b=board(bl["key"],t,B,D,(1240,580),st); fr.paste(b,(20,20),rmask(1240,580))
        speaker_tag(fr,T,20,606)   # below the canvas, above subtitles
    gloss_strip(fr,T)
    if bl["new"]: loc_card(fr,t,st)
    return fr
def final_frame(j,T):
    fr=frame_at(j,T); bl=BLOCKS[j]; t=T-bl["T0"]
    if j>0 and t<0.5: fr=Image.blend(frame_at(j-1,bl["T0"]-1e-3),fr,ease(t/0.5))
    a=1.0
    if T<1.0: a=ease(T/1.0)
    if T>DUR-1.5: a=min(a,ease((DUR-T)/1.5))
    if a<1: fr=Image.blend(Image.new("RGB",(W,H)),fr,a)
    return fr
def render_block(j):
    bl=BLOCKS[j]; f0i=int(round(bl["T0"]*FPS)); f1i=int(round(bl["T1"]*FPS)); out=f"seg/{j:02d}_{bl['key']}.mp4"
    p=subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p",out],stdin=subprocess.PIPE)
    for fi in range(f0i,f1i): p.stdin.write(final_frame(j,fi/FPS).tobytes())
    p.stdin.close(); p.wait(); return out,f1i-f0i
if __name__=="__main__":
    from multiprocessing import Pool
    if sys.argv[1:2]==["still"]:
        for T in map(float,sys.argv[2:]):
            j=max(i for i,bl in enumerate(BLOCKS) if bl["T0"]<=T); final_frame(j,T).save(f"stills/t{T:06.1f}.png"); print("still",T,BLOCKS[j]["key"],flush=True)
        sys.exit()
    idx=list(range(len(BLOCKS)))
    with Pool(7) as pool:
        for out,n in pool.imap_unordered(render_block,sorted(idx,key=lambda j:-(BLOCKS[j]["T1"]-BLOCKS[j]["T0"]))): print(out,n,flush=True)
    open("seg/list.txt","w").write("".join(f"file '{j:02d}_{BLOCKS[j]['key']}.mp4'\n" for j in idx))
