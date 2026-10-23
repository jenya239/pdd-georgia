# Shared drawing helpers for the ПДД series (exec'd by core.py; board coords in 1x px, drawn at SS).
SERIF="/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"; SERIFB="/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
MONO="/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
ASSETS=str(SIGNS)+"/"
def appear(t,t0,d=0.5): return ease((t-t0)/d)
def wrapw(s,font,maxw):
    out=[]
    for para in s.split("\n"):
        line=""
        for w in para.split(" "):
            tt=(line+" "+w).strip()
            if font.getlength(tt)<=maxw*SS: line=tt
            else: out.append(line); line=w
        out.append(line)
    return out
def para(d,x,y,s,sz,maxw,col=None,a=1.0,font=None,lh=1.32,anchor="la"):
    col=col or WHITE; f=F(font or DJ,int(sz*SS)); ls=wrapw(s,f,maxw)
    if a>0:
        for i,l in enumerate(ls): d.text((x*SS,(y+i*sz*lh)*SS),l,font=f,fill=col+(int(255*a),),anchor=anchor)
    return y+len(ls)*sz*lh
def para_h(s,sz,maxw,font=None,lh=1.32): return len(wrapw(s,F(font or DJ,int(sz*SS)),maxw))*sz*lh
def chip(d,x,y,s,col,a=1.0,sz=15,anchor="l",font=None):
    if a<=0: return 0
    f=F(font or DJB,int(sz*SS)); w=f.getlength(s)/SS+18; h=sz+12
    if anchor=="r": x-=w
    if anchor=="m": x-=w/2
    d.rounded_rectangle([x*SS,y*SS,(x+w)*SS,(y+h)*SS],h/2*SS,fill=col+(int(40*a),),outline=col+(int(255*a),),width=int(1.5*SS))
    d.text(((x+9)*SS,(y+h/2)*SS),s,font=f,fill=col+(int(255*a),),anchor="lm"); return w
def quote(d,x,y,w,s,cite,a=1.0,sz=17,col=None,bg=None,hl=None):
    """law quote card: serif text in «», citation chip on top. returns bottom y"""
    if a<=0: return y
    col=col or WHITE; bg=bg or BG; h=para_h("«"+s+"»",sz,w-36,SERIF)+48
    d.rounded_rectangle([x*SS,y*SS,(x+w)*SS,(y+h)*SS],10*SS,fill=tuple(int(c*0.94) for c in bg)+(int(255*a),) if sum(bg)>380 else tuple(min(255,c+14) for c in bg)+(int(255*a),),outline=GREY+(int(120*a),),width=SS)
    d.rounded_rectangle([x*SS,y*SS,(x+6)*SS,(y+h)*SS],3*SS,fill=GOLD+(int(255*a),))
    chip(d,x+18,y+8,cite,BLUE,a,13)
    para(d,x+18,y+36,"«"+s+"»",sz,w-36,col,a,SERIF)
    return y+h
_img={}
def asset(name):
    if name not in _img:
        im=Image.open(ASSETS+name).convert("RGBA")
        # white -> keep (signs have white fields); only make pure-white margins of marking images transparent
        _img[name]=im
    return _img[name]
def sign(img,name,x,y,h,a=1.0,anchor="lt",card=False):
    if a<=0: return 0
    im=asset(name); s=h*SS/im.size[1]; im=im.resize((max(1,int(im.size[0]*s)),int(h*SS)),Image.LANCZOS)
    X,Y=x*SS,y*SS
    if anchor[0]=="m": X-=im.size[0]/2
    if anchor[0]=="r": X-=im.size[0]
    if card:
        d=ImageDraw.Draw(img,"RGBA"); p=6*SS
        d.rounded_rectangle([X-p,Y-p,X+im.size[0]+p,Y+im.size[1]+p],8*SS,fill=(255,255,255,int(255*a)),outline=(180,184,190,int(255*a)),width=SS)
    put(img,im,(X,Y),a); return im.size[0]/SS
def arrow(d,x0,y0,x1,y1,col,a=1.0,w=2.5,head=10):
    if a<=0: return
    d.line([x0*SS,y0*SS,x1*SS,y1*SS],fill=col+(int(255*a),),width=int(w*SS))
    ang=math.atan2(y1-y0,x1-x0)
    for s_ in (-1,1):
        d.line([x1*SS,y1*SS,(x1-head*math.cos(ang+s_*0.45))*SS,(y1-head*math.sin(ang+s_*0.45))*SS],fill=col+(int(255*a),),width=int(w*SS))
def brace(d,x,y0,y1,col,a=1.0,label=None,sz=15,side="r"):
    """vertical bracket at x from y0..y1 with label"""
    if a<=0: return
    c=col+(int(255*a),); k=8 if side=="r" else -8
    d.line([x*SS,y0*SS,(x+k)*SS,y0*SS],fill=c,width=2*SS); d.line([x*SS,y1*SS,(x+k)*SS,y1*SS],fill=c,width=2*SS)
    d.line([(x+k)*SS,y0*SS,(x+k)*SS,y1*SS],fill=c,width=2*SS)
    if label: d.text(((x+k+(8 if side=="r" else -8))*SS,(y0+y1)/2*SS),label,font=F(DJB,int(sz*SS)),fill=c,anchor="lm" if side=="r" else "rm")
# ---------- top-down road ----------
BANDS={"grass":(96,138,82),"sidewalk":(196,192,184),"curb":(150,150,150),"lane":(70,73,80),"median":(110,150,90),"shoulder":(150,138,112),"tram":(70,73,80)}
def road(img,d,x0,x1,y,bands,t=99,cars=(),edge="1.2.2",marks=True):
    """bands: list of (kind,height,meta). Returns dict kind/index -> (y0,y1). Lanes: meta = direction (+1 right, -1 left)."""
    ys=[]; yy=y
    for i,(k,h,m) in enumerate(bands):
        d.rectangle([x0*SS,yy*SS,x1*SS,(yy+h)*SS],fill=BANDS[k]+(255,)); ys.append((yy,yy+h)); yy+=h
        if k=="sidewalk":
            for xx in range(int(x0),int(x1),26): d.line([xx*SS,yy*SS-h*SS,xx*SS,yy*SS],fill=(176,172,164,255),width=SS)
        if k=="shoulder":
            rng=np.random.default_rng(i)
            for _ in range(int((x1-x0)*h/60)):
                px,py=rng.uniform(x0,x1),rng.uniform(yy-h,yy); d.ellipse([(px-1.2)*SS,(py-1.2)*SS,(px+1.2)*SS,(py+1.2)*SS],fill=(120,110,90,255))
        if k=="median":
            d.rectangle([x0*SS,(yy-h)*SS,x1*SS,(yy-h+3)*SS],fill=(160,160,160,255)); d.rectangle([x0*SS,(yy-3)*SS,x1*SS,yy*SS],fill=(160,160,160,255))
    # markings between adjacent lanes
    for i in range(len(bands)-1 if marks else 0):
        k0,k1=bands[i][0],bands[i+1][0]; yb=ys[i][1]
        if k0=="lane" and k1=="lane":
            if bands[i][2]!=bands[i+1][2]:   # opposite directions: 1.1 solid
                d.rectangle([x0*SS,(yb-1.5)*SS,x1*SS,(yb+1.5)*SS],fill=(240,240,240,255))
            else:                              # same direction: 1.5 dashed
                for xx in np.arange(x0,x1,40): d.rectangle([xx*SS,(yb-1.5)*SS,(xx+22)*SS,(yb+1.5)*SS],fill=(240,240,240,255))
        if (k0=="lane")!=(k1=="lane") and "shoulder" in (k0,k1) and edge:
            for xx in np.arange(x0,x1,30): d.rectangle([xx*SS,(yb-2.5)*SS,(xx+20)*SS,(yb+2.5)*SS],fill=(240,240,240,255))
    for (bi,fx,col) in cars:
        y0,y1=ys[bi]; dirn=bands[bi][2] or 1; cy=(y0+y1)/2; L,Wd=54,26
        cx=fx if dirn>0 else fx
        d.rounded_rectangle([(cx-L/2)*SS,(cy-Wd/2)*SS,(cx+L/2)*SS,(cy+Wd/2)*SS],7*SS,fill=col+(255,))
        wx=cx+(L/2-16)*dirn; d.rectangle([min(wx,wx+8*dirn)*SS,(cy-Wd/2+4)*SS,max(wx,wx+8*dirn)*SS,(cy+Wd/2-4)*SS],fill=(40,50,70,255))
    return ys
def car_top(d,cx,cy,dirn,col,a=1.0,L=54,Wd=26):
    d.rounded_rectangle([(cx-L/2)*SS,(cy-Wd/2)*SS,(cx+L/2)*SS,(cy+Wd/2)*SS],7*SS,fill=col+(int(255*a),))
    wx=cx+(L/2-16)*dirn; d.rectangle([min(wx,wx+8*dirn)*SS,(cy-Wd/2+4)*SS,max(wx,wx+8*dirn)*SS,(cy+Wd/2-4)*SS],fill=(40,50,70,int(255*a)))
def walker(d,x,y,h,col=(40,40,48),a=1.0):
    """simple pedestrian icon, feet at (x,y), height h (px, 1x)"""
    c=col+(int(255*a),); r=h*0.11
    d.ellipse([(x-r)*SS,(y-h)*SS,(x+r)*SS,(y-h+2*r)*SS],fill=c)
    d.line([x*SS,(y-h+2*r)*SS,x*SS,(y-h*0.42)*SS],fill=c,width=max(1,int(h*0.09*SS)))
    for s_ in (-1,1):
        d.line([x*SS,(y-h*0.42)*SS,(x+s_*h*0.16)*SS,y*SS],fill=c,width=max(1,int(h*0.08*SS)))
        d.line([x*SS,(y-h*0.72)*SS,(x+s_*h*0.17)*SS,(y-h*0.5)*SS],fill=c,width=max(1,int(h*0.07*SS)))
def hl_rect(d,x0,y0,x1,y1,col,a,fill=60):
    if a<=0: return
    d.rectangle([x0*SS,y0*SS,x1*SS,y1*SS],fill=col+(int(fill*a),),outline=col+(int(255*a),),width=int(2.5*SS))
# ---------- car interior ----------
def car_view(img,d,t,jam=False,shoulder_hl=0.0,speed=1.0,extra=None):
    W_,H_=BW,BH; hor=200
    # sky + far hills
    for i in range(hor):
        c=tuple(int(a+(b-a)*i/hor) for a,b in zip((120,160,205),(200,215,225))); d.line([0,i*SS,W_*SS,i*SS],fill=c+(255,))
    d.polygon([(0,hor*SS),(180*SS,150*SS),(380*SS,180*SS),(620*SS,140*SS),(900*SS,175*SS),(1240*SS,150*SS),(1240*SS,hor*SS)],fill=(120,140,110,255))
    d.rectangle([0,hor*SS,W_*SS,H_*SS],fill=(100,130,85,255))
    vx=560  # vanishing x
    global CARP
    def P(u,z):  # u lateral metres (0=centre line), z distance (m)
        f=1/(1+z/8.0); return ((vx+u*230*f)*SS,(hor+(H_-hor)*0.92*f)*SS)
    # road surfaces: shoulder right u in [3.6,5.6], carriageway [-3.6,3.6]
    zs=[0,400]
    def quad(u0,u1,col):
        d.polygon([P(u0,0),P(u1,0),P(u1,400),P(u0,400)],fill=col+(255,))
    CARP=P
    quad(-6.0,-3.6,(150,138,112)); quad(-3.6,3.6,(78,80,86)); quad(3.6,5.8,(150,138,112))
    if shoulder_hl>0: d.polygon([P(3.6,0),P(5.8,0),P(5.8,400),P(3.6,400)],fill=(255,80,60,int(90*shoulder_hl)))
    off=(t*speed*14)%12 if not jam else 3.0
    for z in np.arange(-off,200,12):
        if z<0: continue
        for u,wd in ((0,0.12),):
            a0,a1=P(u-wd,z),P(u+wd,z); b0,b1=P(u+wd,z+6),P(u-wd,z+6); d.polygon([a0,a1,b0,b1],fill=(235,235,235,255))
        for u in (3.6,-3.6):   # edge line 1.2.2 (broken wide)
            a0,a1=P(u-0.1,z),P(u+0.1,z); b0,b1=P(u+0.1,z+8),P(u-0.1,z+8); d.polygon([a0,a1,b0,b1],fill=(235,235,235,255))
    if jam:
        for z,u,col in ((14,1.8,(170,40,40)),(28,1.8,(60,90,150)),(44,1.8,(200,200,205)),(62,1.8,(40,40,40)),(16,-1.8,(90,90,95)),(36,-1.8,(180,150,60))):
            f=1/(1+z/8.0); cx,cy=P(u,z); wpx=1.7*230*f*SS; hpx=1.3*230*f*SS
            d.rounded_rectangle([cx-wpx/2,cy-hpx,cx+wpx/2,cy],int(8*f*SS)+1,fill=col+(255,))
            d.rectangle([cx-wpx/2*0.8,cy-hpx*0.85,cx+wpx/2*0.8,cy-hpx*0.55],fill=(40,50,65,255))
            if u>0: 
                for s_ in (-1,1): d.rectangle([cx+s_*wpx*0.38-wpx*0.07,cy-hpx*0.42,cx+s_*wpx*0.38+wpx*0.07,cy-hpx*0.32],fill=(255,60,50,255))
    if extra: extra(P)
    # dashboard
    d.polygon([(0,H_*0.70*SS),(W_*SS,H_*0.66*SS),(W_*SS,H_*SS),(0,H_*SS)],fill=(28,30,36,255))
    d.rounded_rectangle([300*SS,int(H_*0.70)*SS,640*SS,(H_-10)*SS],18*SS,fill=(18,19,24,255))
    for cx,lab in ((390,"км/ч"),(550,"об/мин")):
        d.ellipse([(cx-55)*SS,(H_*0.76)*SS,(cx+55)*SS,(H_*0.76+110)*SS],outline=(90,95,105,255),width=2*SS)
        d.text((cx*SS,(H_*0.76+80)*SS),lab,font=F(DJ,11*SS),fill=(150,155,165,255),anchor="mm")
        ang=math.radians(210-(40 if jam else 110)*(1 if lab=="км/ч" else 0.6)); r=45
        d.line([cx*SS,(H_*0.76+55)*SS,(cx+r*math.cos(ang))*SS,(H_*0.76+55-r*math.sin(ang))*SS],fill=(255,120,60,255),width=2*SS)
    # steering wheel
    cx,cy,R=470,H_+60,170
    d.ellipse([(cx-R)*SS,(cy-R)*SS,(cx+R)*SS,(cy+R)*SS],outline=(12,12,14,255),width=26*SS)
    d.rectangle([(cx-20)*SS,(cy-R+10)*SS,(cx+20)*SS,cy*SS],fill=(12,12,14,255))
    # A-pillars + mirror
    d.polygon([(0,0),(70*SS,0),(0,int(H_*0.72)*SS)],fill=(14,15,18,255)); d.polygon([(W_*SS,0),((W_-70)*SS,0),(W_*SS,int(H_*0.68)*SS)],fill=(14,15,18,255))
    d.rectangle([0,0,W_*SS,14*SS],fill=(14,15,18,255)); d.rounded_rectangle([520*SS,16*SS,640*SS,52*SS],8*SS,fill=(30,32,38,255),outline=(60,62,70,255),width=SS)
    d.rounded_rectangle([526*SS,22*SS,634*SS,46*SS],6*SS,fill=(150,170,190,255))
# ---------- exam screen ----------
def exam(img,d,t,q,opts,correct,t_rev,note,picture=None,pic_w=0,t_opts=None,tag="Тренировочный вопрос"):
    W_=BW
    d.rectangle([0,0,W_*SS,52*SS],fill=(32,52,96,255))
    d.text((24*SS,26*SS),tag,font=F(DJB,18*SS),fill=(255,255,255,255),anchor="lm")
    d.text((24*SS+F(DJB,18*SS).getlength(tag)+16*SS,26*SS),note,font=F(DJ,13*SS),fill=(200,210,230,255),anchor="lm")
    rem=max(0,30*60-int(t)); d.text(((W_-24)*SS,26*SS),f"осталось {rem//60:02d}:{rem%60:02d}",font=F(MONO,18*SS),fill=(255,214,120,255),anchor="rm")
    # progress dots 1..30
    for i in range(30):
        x=24+i*16; d.ellipse([x*SS,62*SS,(x+10)*SS,72*SS],fill=((40,90,200,255) if i==0 else (200,206,216,255)))
    x0=24; qw=W_-48-(pic_w+24 if picture else 0)
    y=para(d,x0,96,q,23,qw,WHITE,1,DJB)
    if picture: picture(img,d,t,W_-24-pic_w,92)
    y=max(y+14,0); y0=y
    for i,o in enumerate(opts):
        a=appear(t,(t_opts[i] if t_opts else 0.3+i*0.3))
        if a<=0: continue
        h=para_h(o,20,qw-70)+22
        ok=i==correct; rv=t>=t_rev
        fill=(255,255,255) if not rv else ((214,240,222) if ok else (244,244,246))
        oc=(190,196,208) if not rv else ((30,150,80) if ok else (205,208,214))
        d.rounded_rectangle([x0*SS,y*SS,(x0+qw)*SS,(y+h)*SS],10*SS,fill=fill+(int(255*a),),outline=oc+(int(255*a),),width=int((3 if rv and ok else 1.5)*SS))
        d.ellipse([(x0+12)*SS,(y+h/2-15)*SS,(x0+42)*SS,(y+h/2+15)*SS],fill=((30,150,80) if rv and ok else (32,52,96))+(int(255*a),))
        d.text(((x0+27)*SS,(y+h/2)*SS),str(i+1),font=F(DJB,16*SS),fill=(255,255,255,int(255*a)),anchor="mm")
        para(d,x0+56,y+10,o,20,qw-70,WHITE if not rv or ok else GREY,a)
        if rv and ok: d.text(((x0+qw-14)*SS,(y+h/2)*SS),"✓ верно",font=F(DJB,16*SS),fill=(30,150,80,int(255*appear(t,t_rev))),anchor="rm")
        y+=h+10
    return y
# ---------- browser ----------
def browser(img,d,url,a=1.0):
    W_=BW
    d.rectangle([0,0,W_*SS,40*SS],fill=(222,225,232,255))
    for i,c in enumerate([(255,95,87),(255,189,46),(40,200,64)]): d.ellipse([(16+i*20)*SS,14*SS,(28+i*20)*SS,26*SS],fill=c+(255,))
    d.rounded_rectangle([90*SS,8*SS,(W_-20)*SS,32*SS],12*SS,fill=(255,255,255,255))
    d.text((106*SS,20*SS),"🔒 "+url if False else url,font=F(DJ,14*SS),fill=(60,64,76,255),anchor="lm")
