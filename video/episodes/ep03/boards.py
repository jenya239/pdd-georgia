# ПДД ep03 boards: ст. 5 — перекрёсток (п. 13), прилегающая территория (п. 38), главная дорога (п. 37) + билеты 888, 54, 961.
TK=str(TICKETS)+"/"
# --- verbatim quotes (sources/law_ru_matsne_pub36_2026-06-25.txt) ---
Q13A="Перекресток – пересечение, примыкание либо разветвление дорог на одном уровне, включая территории, образованные в результате таких пересечений, примыканий или разветвлений."
Q13B="Перекрестком не считается пересечение с дорогами выездов с близлежащих территорий."
Q38=("Прилегающая территория – территория, непосредственно примыкающая к дороге и не предназначенная для сквозного движения транспортных средств "
     "(дворы, жилые массивы, автостоянки, бензозаправочные станции, учреждения и др.).")
Q37A="Главная дорога – дорога, обозначенная дорожным знаком 2.1 или 5.1, на всем участке зоны действия этого знака."
Q37B=("Главной дорогой считается дорога, обозначенная дорожными знаками 1.7.1–1.7.7, – на перекрестках, по отношению к пересекаемой (примыкающей) дороге, "
      "дорога с твердым покрытием (дорога с асфальтовым, цементобетонным покрытием, либо дорога с покрытием из иного подобного материала, либо каменная мостовая) – "
      "по отношению к щебеночной или грунтовой дороге, щебеночная дорога – по отношению к грунтовой дороге.")
Q37C="Наличие на щебеночной или грунтовой дороге непосредственно перед перекрестком участка дороги с твердым покрытием не приравнивает ее по значению к дороге с твердым покрытием."
Q36_5="Водитель не должен выезжать на перекресток, если образовался затор, который вынудит его остановиться на перекрестке, создав тем самым препятствие движению в поперечном направлении."
Q37_6="Остановка транспортных средств запрещается: а) на проезжей части дороги: … а.в) на пересечении проезжих частей, а также ближе 5 метров от краев их пересечений…"
Q36_7="При выезде на дорогу с прилегающей территории водитель обязан уступить дорогу движущимся по этой дороге участникам дорожного движения."
Q32_3="При выезде на дорогу с прилегающей территории водитель обязан уступать дорогу движущимся по дороге транспортным средствам и пешеходам…"
Q25_7="Водитель при выезде на дорогу с прилегающей территории или при въезде с дороги на такую территорию должен уступать дорогу пешеходам."
Q36_4v="…на перекрестке равнозначных дорог водители безрельсовых транспортных средств обязаны уступать дорогу приближающимся к ним справа транспортным средствам."
Q34_9a="…обгон запрещается: а) на перекрестках, отличных от перекрестков с круговым движением, или непосредственно перед этими перекрестками, кроме: …"
Q37_7g="Стоянка транспортных средств запрещается: … г) на выезде автомобиля со двора;"
Q36_8="Если водитель не может определить наличие покрытия на дороге (темное время суток, снегопад, грязь или по иным причинам) и нет знаков приоритета, считается, что он находится на второстепенной дороге."
Q36_6="Если дорожным знаком не предусмотрено иное, при выезде с грунтовой дороги на дорогу, не являющуюся грунтовой дорогой, водитель обязан уступить дорогу движущимся по этой дороге транспортным средствам."
# Georgian original (sources/law_ka_matsne_pub36_2026-06-25.txt), highlighted word in [ ]
KA13="13. … გზაჯვარედინად არ ითვლება [მიმდებარე] ტერიტორიებიდან გამომავალი გამოსასვლელების გზებთან კვეთა."
KA38="38. [მიმდებარე] ტერიტორია – ტერიტორია, რომელიც უშუალოდ გზას ეკვრის და არ არის განკუთვნილი სატრანსპორტო საშუალების გამჭოლი მოძრაობისათვის (ეზო, საცხოვრებელი მასივი, ავტოსადგომი, ბენზინგასამართი სადგური, დაწესებულება და სხვა)."
RU13="13. … Перекрестком не считается пересечение с дорогами выездов с [близлежащих] территорий."
RU38="38. [Прилегающая] территория – территория, непосредственно примыкающая к дороге и не предназначенная для сквозного движения транспортных средств (дворы, жилые массивы, автостоянки, бензозаправочные станции, учреждения и др.)."
CARD=(250,248,240); INK=(30,32,44)
def rich(d,x,y,s,sz,maxw,col,hcol,a=1.0,font=None,lh=1.4):
    """paragraph with [highlighted] words"""
    if a<=0: return y
    f=F(font or DJ,int(sz*SS)); toks=[]
    for part in _re.split(r"(\[[^\]]*\])",s):
        if not part: continue
        hl=part.startswith("[")
        for w in part.strip("[]").split(" "):
            if w: toks.append((w,hl))
    X=x; Y=y; sp=f.getlength(" ")/SS
    for w,hl in toks:
        wl=f.getlength(w)/SS
        if X+wl>x+maxw: X=x; Y+=sz*lh
        if hl: d.rounded_rectangle([(X-3)*SS,(Y-2)*SS,(X+wl+3)*SS,(Y+sz*1.25)*SS],4*SS,fill=hcol+(int(70*a),),outline=hcol+(int(255*a),),width=int(1.5*SS))
        d.text((X*SS,Y*SS),w,font=f,fill=(hcol if hl else col)+(int(255*a),)); X+=wl+sp
    return Y+sz*lh
import re as _re
def solid(d,x,y,s_,col,a=1.0,sz=14,anchor="l"):
    """opaque pill (readable on asphalt/grass): coloured fill, white text"""
    if a<=0: return 0
    f=F(DJB,int(sz*SS)); w=f.getlength(s_)/SS+20; h=sz+12
    if anchor=="r": x-=w
    if anchor=="m": x-=w/2
    d.rounded_rectangle([x*SS,y*SS,(x+w)*SS,(y+h)*SS],h/2*SS,fill=col+(int(235*a),),outline=(255,255,255,int(200*a)),width=int(1.5*SS))
    d.text(((x+10)*SS,(y+h/2)*SS),s_,font=f,fill=(255,255,255,int(255*a)),anchor="lm"); return w
DG=(20,125,60); DR=(200,40,30); DB=(28,86,196); DO=(190,105,0); DP=(170,40,110)
def card(d,x,y,w,q,cite,a,sz=14): return quote(d,x,y,w,q,cite,a,sz,INK,CARD)
def car_v(d,cx,cy,dirn,col,a=1.0,L=50,Wd=26):
    """vertical car; dirn=-1 faces up, +1 faces down"""
    if a<=0: return
    d.rounded_rectangle([(cx-Wd/2)*SS,(cy-L/2)*SS,(cx+Wd/2)*SS,(cy+L/2)*SS],7*SS,fill=col+(int(255*a),))
    wy=cy+(L/2-16)*dirn; d.rectangle([(cx-Wd/2+4)*SS,min(wy,wy+8*dirn)*SS,(cx+Wd/2-4)*SS,max(wy,wy+8*dirn)*SS],fill=(40,50,70,int(255*a)))
def street(img,d,x0,x1,y,sw=34,ln=56,drive=None,yard_h=0):
    ys=road(img,d,x0,x1,y,[("sidewalk",sw,0),("curb",4,0),("lane",ln,-1),("lane",ln,1),("curb",4,0),("sidewalk",sw,0)])
    yb=ys[5][1]
    if yard_h:
        d.rectangle([x0*SS,yb*SS,x1*SS,(yb+yard_h)*SS],fill=(186,180,166,255))
        for xx in range(int(x0),int(x1),22): d.line([xx*SS,yb*SS,xx*SS,(yb+yard_h)*SS],fill=(176,170,156,255),width=SS)
    if drive:
        dx0,dx1=drive; d.rectangle([dx0*SS,ys[4][0]*SS,dx1*SS,(yb+yard_h)*SS],fill=(92,94,100,255))
    return ys
def house(d,x0,y0,x1,y1,a=1.0,lab=None):
    d.rectangle([x0*SS,y0*SS,x1*SS,y1*SS],fill=(150,96,80,int(255*a)),outline=(110,70,60,int(255*a)),width=2*SS)
    d.line([x0*SS,y0*SS,x1*SS,y1*SS],fill=(120,78,66,int(255*a)),width=SS); d.line([x0*SS,y1*SS,x1*SS,y0*SS],fill=(120,78,66,int(255*a)),width=SS)
    if lab: txt(d,((x0+x1)/2,(y0+y1)/2),lab,13,(255,255,255),a,"mm",DJB)
# ---------------- chat: Anya's question ----------------
def b_q_chat(img,d,t,B,D):
    txt(d,(712,34),"Выезд со двора: кто кому уступает?",19,(235,238,245),1,"rm",DJB)
    ys=street(img,d,30,700,70,drive=(330,384),yard_h=150)
    house(d,60,ys[5][1]+30,250,ys[5][1]+140,1,"дом"); house(d,470,ys[5][1]+30,670,ys[5][1]+140,1,"дом")
    txt(d,(357,ys[5][1]+128),"двор",14,(60,60,70),1,"mm",DJB)
    car_v(d,357,ys[5][1]+60,-1,(230,140,50))
    yl=(ys[3][0]+ys[3][1])/2; bx=60+min(1,max(0,t/6))*150
    car_top(d,bx,yl,1,(60,110,200)); arrow(d,bx+34,yl,bx+90,yl,(255,255,255),0.8,2,8)
    car_top(d,620-min(1,max(0,t/6))*120,(ys[2][0]+ys[2][1])/2,-1,(200,200,205))
    solid(d,40,ys[5][1]+3,"Аня ждёт машину слева",(200,110,30),appear(t,0.6),13)
    if t>B.S(1)-0.2:
        a=appear(t,B.S(1)); chip(d,40,ys[5][1]+165,"Макс: «ты у неё справа — пусть уступает»",(255,140,170),a,14)
    if t>B.S(2)-0.2:
        for i,(s_,col) in enumerate([("перекрёсток · п. 13",BLUE),("прилегающая территория · п. 38",GREEN),("главная дорога · п. 37",GOLD)]):
            chip(d,40+[0,200,470][i],ys[5][1]+215,s_,col,appear(t,B.S(2)+1+i*0.7),13)
        txt(d,(365,ys[5][1]+268),"ст. 5 — термины",14,GREY,appear(t,B.S(2)+1),"mm")
# ---------------- board: intersection definition ----------------
ROADC=(70,73,80)
def mini(d,cx,cy,kind,a,hl=0.0,R=56,w=26):
    c=ROADC+(int(255*a),)
    segs={"X":[(-R,0,R,0),(0,-R,0,R)],"T":[(-R,0,R,0),(0,0,0,R)],"Y":[(0,R,0,8),(0,8,-R*0.8,-R*0.8),(0,8,R*0.8,-R*0.8)]}[kind]
    for x0,y0,x1,y1 in segs: d.line([(cx+x0)*SS,(cy+y0)*SS,(cx+x1)*SS,(cy+y1)*SS],fill=c,width=int(w*SS))
    d.ellipse([(cx-w/2)*SS,(cy+(8 if kind=="Y" else 0)-w/2)*SS,(cx+w/2)*SS,(cy+(8 if kind=="Y" else 0)+w/2)*SS],fill=c)
    if hl>0:
        yy=cy+(8 if kind=="Y" else 0); r=w*0.9
        d.rounded_rectangle([(cx-r)*SS,(yy-r)*SS,(cx+r)*SS,(yy+r)*SS],6*SS,fill=GOLD+(int(150*hl),),outline=GOLD+(int(255*hl),),width=2*SS)
def b_x_def(img,d,t,B,D):
    txt(d,(30,22),"Перекрёсток — ст. 5, п. 13",22,WHITE,1,"la",DJB)
    y=quote(d,30,62,640,Q13A,"ст. 5, п. 13",appear(t,0.2),17)
    names=[("X","пересечение"),("T","примыкание"),("Y","разветвление")]
    for i,(k,n) in enumerate(names):
        a=appear(t,B.S(1)+0.3+i*0.8); cx=780+i*160
        if a<=0: continue
        hl=appear(t,B.S(2)) if t>B.S(2) else 0
        mini(d,cx,140,k,a,hl); txt(d,(cx,212),n,15,WHITE,a,"ma",DJB)
    if t>B.S(1)+3-0.2:   # flyover
        a=appear(t,B.S(1)+3); x0,yc=720,350
        d.line([x0*SS,yc*SS,(x0+200)*SS,yc*SS],fill=ROADC+(int(255*a),),width=26*SS)
        d.rectangle([(x0+86)*SS,(yc-70)*SS,(x0+114)*SS,(yc+70)*SS],fill=(110,114,122,int(255*a)),outline=(40,40,48,int(255*a)),width=2*SS)
        for s_ in (-1,1): d.line([(x0+100+s_*16)*SS,(yc-70)*SS,(x0+100+s_*16)*SS,(yc+70)*SS],fill=(40,40,48,int(255*a)),width=2*SS)
        txt(d,(x0+220,yc-12),"эстакада:",15,RED,a,"la",DJB); txt(d,(x0+220,yc+10),"разные уровни → не перекрёсток",15,RED,a,"la")
    if t>B.S(2)-0.2:
        a=appear(t,B.S(2)); chip(d,780-56,236,"середина («образованные территории») — тоже перекрёсток",GOLD,a,13)
    if t>B.S(3)-0.2:
        a=appear(t,B.S(3)); yy=y+14
        d.rounded_rectangle([30*SS,yy*SS,670*SS,(yy+64)*SS],10*SS,fill=(255,236,232,int(255*a)),outline=RED+(int(255*a),),width=2*SS)
        txt(d,(46,yy+20),"Где границы перекрёстка? В п. 13 — не сказано",16,RED,a,"lm",DJB)
        txt(d,(46,yy+44),"ближайшая опора — ст. 37: 5 м от краёв пересечения проезжих частей",14,WHITE,a,"lm")
        card(d,30,yy+76,640,Q37_6,"ст. 37, п. 6 «а.в»",appear(t,B.S(3)+3),15)
        chip(d,720,450,"честно: в п. 13 пробел — границ нет",GOLD,appear(t,B.S(3)+5),15)
# ---------------- board: what is NOT an intersection; adjacent territory ----------------
def b_x_not(img,d,t,B,D):
    txt(d,(30,22),"Что не перекрёсток — ст. 5, п. 13 и п. 38",22,WHITE,1,"la",DJB)
    y=quote(d,30,62,640,Q13B,"ст. 5, п. 13, последняя фраза",appear(t,0.2),17)
    if t>B.S(1)-0.2: y=quote(d,30,y+14,640,Q38,"ст. 5, п. 38",appear(t,B.S(1)),17)
    if t>B.S(2)-0.2:
        a=appear(t,B.S(2)); chip(d,30,y+16,"ключ: «не предназначенная для сквозного движения»",GOLD,a,15)
        chip(d,30,y+56,"→ не звено дорожной сети → выезд оттуда не перекрёсток",GREEN,appear(t,B.S(2)+3),15)
    # right: street + lots
    X0,X1=700,1220
    ys=road(img,d,X0,X1,70,[("sidewalk",24,0),("lane",42,-1),("lane",42,1),("sidewalk",24,0)])
    yb=ys[3][1]; lots=[("двор",710,860),("АЗС",875,1030),("стоянка",1045,1210)]
    for i,(n,a0,a1) in enumerate(lots):
        a=appear(t,B.S(1)+1.5+i*0.8)
        if a<=0: continue
        d.rectangle([a0*SS,(yb+18)*SS,a1*SS,(yb+190)*SS],fill=(186,180,166,int(255*a)),outline=(150,145,135,int(255*a)),width=SS)
        dx=(a0+a1)/2; d.rectangle([(dx-24)*SS,ys[3][0]*SS,(dx+24)*SS,(yb+60)*SS],fill=ROADC+(int(255*a),))
        if n=="двор": house(d,a0+10,yb+110,a1-10,yb+180,a)
        if n=="АЗС":
            d.rectangle([(a0+20)*SS,(yb+100)*SS,(a1-20)*SS,(yb+120)*SS],fill=(200,60,50,int(255*a)))
            for k in range(3): d.rectangle([(a0+30+k*40)*SS,(yb+125)*SS,(a0+44+k*40)*SS,(yb+160)*SS],fill=(90,90,100,int(255*a)))
        if n=="стоянка":
            for k in range(5): d.line([(a0+12+k*34)*SS,(yb+100)*SS,(a0+12+k*34)*SS,(yb+180)*SS],fill=(250,250,250,int(255*a)),width=2*SS)
            txt(d,(a0+20,yb+80),"P",22,(28,86,196),a,"lm",DJB)
        txt(d,(dx,yb+82),n,15,INK,a,"mm",DJB)
    if t>B.S(2)-0.2:
        a=appear(t,B.S(2)); dx=785
        arrow(d,dx-8,yb+40,dx-8,ys[2][0]+6,GREEN,a,3,9); arrow(d,dx+8,ys[2][0]+6,dx+8,yb+40,GREEN,a,3,9)
        txt(d,(X0+4,yb+215),"туда и обратно — да",14,GREEN,a,"la",DJB)
        d.line([870*SS,(yb+150)*SS,1040*SS,(yb+150)*SS],fill=RED+(int(255*a),),width=3*SS)
        txt(d,(955,yb+150),"✕",26,RED,a,"mm",DJB); txt(d,(X1,yb+215),"насквозь — не для этого",14,RED,a,"ra",DJB)
# ---------------- web: RU vs KA wording ----------------
def b_matsne_ka(img,d,t,B,D):
    browser(img,d,"matsne.gov.ge/ru/document/view/2169396  ·  /ka/document/view/2169396")
    txt(d,(40,62),"Статья 5 — один термин, два слова в переводе",22,WHITE,1,"la",DJB)
    cols=[(40,"Русский перевод (Matsne)",[RU13,RU38],RED,0.3),(650,"ქართული — оригинал",[KA13,KA38],GREEN,B.S(1))]
    for x,h,ps,hc,tt in cols:
        a=appear(t,tt)
        if a<=0: continue
        d.rounded_rectangle([x*SS,100*SS,(x+560)*SS,340*SS],10*SS,fill=(244,245,248,int(255*a)),outline=(205,208,216,int(255*a)),width=SS)
        txt(d,(x+18,124),h,16,hc,a,"lm",DJB); yy=150
        for p in ps: yy=rich(d,x+18,yy,p,15,520,INK,hc,a)+14
    if t>B.S(0)+3: chip(d,40,360,"«близлежащих» (п. 13) и «прилегающая» (п. 38) — разные слова",RED,appear(t,B.S(0)+3),14)
    if t>B.S(1)-0.2:
        a=appear(t,B.S(1)+1.5); chip(d,650,360,"в оригинале оба раза: მიმდებარე — одно понятие",GREEN,a,14)
        txt(d,(620,420),"юридическую силу имеет грузинский текст (выпуск 1)",14,GREY,appear(t,B.S(1)+3),"mm")
# ---------------- road: yard exit situation ----------------
def b_yard(img,d,t,B,D):
    X0,X1=20,770
    ys=street(img,d,X0,X1,60,sw=40,ln=62,drive=(380,446),yard_h=240)
    yb=ys[5][1]
    d.rectangle([780*SS,0,BW*SS,BH*SS],fill=CARD+(255,))
    house(d,60,yb+80,330,yb+205,1,"жилой дом"); house(d,500,yb+80,740,yb+205,1,"жилой дом")
    txt(d,(413,yb+225),"двор — прилегающая территория (п. 38)",14,(60,60,70),1,"mm",DJB)
    ax=413; ay=yb+40; car_v(d,ax,ay,-1,(230,140,50)); txt(d,(ax-20,ay+10),"Аня",13,(255,255,255),1,"ra",DJB)
    yl=(ys[3][0]+ys[3][1])/2; yr=(ys[2][0]+ys[2][1])/2
    bx=60+((t*22)%300); car_top(d,bx,yl,1,(60,110,200))
    rx=740-((t*18)%300); car_top(d,rx,yr,-1,(200,200,205))
    walker(d,520-((t*5)%60),ys[5][1]-6,30,(30,30,40))
    # phase cards
    if t>B.S(0)-0.2 and t<B.S(2)-0.3:
        a=appear(t,B.S(0)); y=card(d,795,20,430,Q36_7,"ст. 36, п. 7",a,15)
        if t>B.S(1)-0.2:
            a1=appear(t,B.S(1)); y=card(d,795,y+10,430,Q32_3,"ст. 32, п. 3",a1,13); card(d,795,y+10,430,Q25_7,"ст. 25, п. 7",appear(t,B.S(1)+4),13)
    if t>B.S(1)-0.2:
        a=appear(t,B.S(1))
        solid(d,30,yb+8,"← слева: уступить",DG,a,13); solid(d,X1-10,yb+8,"справа: уступить →",DG,appear(t,B.S(1)+1),13,"r")
        solid(d,455,yb+8,"пешеходы ✓",DG,appear(t,B.S(1)+2),13)
    if t>B.S(2)-0.2:
        a=appear(t,B.S(2))
        if t<B.S(4)-0.3:
            y=card(d,795,20,430,Q36_4v,"ст. 36, п. 4 «в»",a,15)
            d.rounded_rectangle([795*SS,(y+12)*SS,1225*SS,(y+92)*SS],10*SS,fill=(255,236,232,int(255*a)),outline=RED+(int(255*a),),width=2*SS)
            txt(d,(812,y+36),"помеха справа — только на перекрёстке",15,RED,a,"lm",DJB); txt(d,(812,y+66),"двор ≠ перекрёсток → правило не применяется",15,INK,a,"lm")
        if t<B.S(5)-0.3: solid(d,455,yb+44,"«помеха справа» ✕",DR,a,13)
    if t>B.S(4)-0.2:
        a=appear(t,B.S(4)); y=card(d,795,20,430,Q34_9a,"ст. 34, п. 9 «а»",a,14)
        chip(d,795,y+10,"выезд со двора — не перекрёсток → этот запрет не о нём",BLUE,appear(t,B.S(4)+2.5),12)
        if t>B.S(5)-0.2:
            a5=appear(t,B.S(5)); card(d,795,y+52,430,Q37_7g,"ст. 37, п. 7 «г»",a5,15)
            gx=413; gy=yl
            car_top(d,gx,ys[4][0]-0+(-14),1,(150,150,155),a5*0.85)
            txt(d,(gx,ys[4][0]-14),"✕",34,RED,a5,"mm",DJB); solid(d,455,yb+44,"стоянка на выезде — нельзя",DR,a5,13)
# ---------------- car: dirt road on the right ----------------
def b_dirt(img,d,t,B,D):
    z0,z1=10.0,15.0
    def extra(P):
        xa,ya=P(3.6,z0); xb,yb_=P(3.6,z1)
        d.polygon([(xa,ya),(BW*SS,ya+6*SS),(BW*SS,yb_-4*SS),(xb,yb_)],fill=(156,128,92,255))
        rng=np.random.default_rng(5)
        for _ in range(260):
            u=rng.uniform(0,1); v=rng.uniform(0,1); x=xa+(BW*SS-xa)*u; y=ya+(yb_-ya)*v
            d.ellipse([x-2*SS,y-1*SS,x+2*SS,y+1*SS],fill=(120,96,66,255))
        if t>B.S(5)-0.2:   # asphalt patch before the junction (Max)
            a=appear(t,B.S(5)); xp=xa+150*SS
            d.polygon([(xa,ya),(xp,ya+2*SS),(xp,yb_-1*SS),(xb,yb_)],fill=(78,80,86,int(255*a)))
            if t>B.S(6)-0.2:
                a6=appear(t,B.S(6)); mx,my=(xa+xp)/2,(ya+yb_)/2
                d.line([mx-40*SS,my-18*SS,mx+40*SS,my+18*SS],fill=RED+(int(255*a6),),width=5*SS); d.line([mx-40*SS,my+18*SS,mx+40*SS,my-18*SS],fill=RED+(int(255*a6),),width=5*SS)
        # car on the dirt road, waiting / approaching
        cx=1160*SS-min(1,max(0,t/8))*30*SS; cy=(ya+yb_)/2+4*SS; L=150*SS; Hb=34*SS
        d.rounded_rectangle([cx-L/2,cy-Hb,cx+L/2,cy],10*SS,fill=(60,110,170,255))                       # body (side view, heading left)
        d.polygon([(cx-L*0.30,cy-Hb),(cx-L*0.16,cy-Hb-26*SS),(cx+L*0.22,cy-Hb-26*SS),(cx+L*0.32,cy-Hb)],fill=(60,110,170,255))
        d.polygon([(cx-L*0.25,cy-Hb-2*SS),(cx-L*0.14,cy-Hb-22*SS),(cx+L*0.20,cy-Hb-22*SS),(cx+L*0.27,cy-Hb-2*SS)],fill=(170,200,225,255))
        for wx in (-L*0.30,L*0.30): d.ellipse([cx+wx-14*SS,cy-14*SS,cx+wx+14*SS,cy+14*SS],fill=(25,25,28,255))
    car_view(img,d,t,speed=0.35,extra=extra)
    if t>B.S(7)-0.2 and t<B.S(8)-0.3:   # night / snow: surface cannot be seen
        a=appear(t,B.S(7))*0.55; d.rectangle([0,0,BW*SS,int(BH*0.66)*SS],fill=(10,14,30,int(255*a)))
    # labels on the scene
    if t<B.S(1)-0.2:
        solid(d,1220,250,"справа — грунтовка",DO,appear(t,0.5),15,"r"); solid(d,1220,286,"помеха справа?",DP,appear(t,1.5),15,"r")
    elif t<B.S(5)-0.2:
        solid(d,1220,250,"грунтовка — тоже дорога → перекрёсток",DG,appear(t,B.S(1)),14,"r")
    elif t<B.S(7)-0.2:
        solid(d,1220,236,"кусок асфальта перед перекрёстком?",DP,appear(t,B.S(5)),14,"r")
        if t>B.S(6)-0.2: solid(d,1220,272,"≠ дорога с твёрдым покрытием",DR,appear(t,B.S(6)),14,"r")
    # left panel
    P0=(20,24,560)
    def panel(y0,y1,a): d.rounded_rectangle([P0[0]*SS,y0*SS,P0[2]*SS,y1*SS],12*SS,fill=CARD+(int(240*a),))
    if B.S(1)-0.2<t<B.S(6)-0.3:
        a=appear(t,B.S(1)); panel(24,384,a)
        chip(d,36,36,"ст. 5, п. 37 — главная дорога",(28,86,196),a,15)
        rows=[(B.S(2),"1","знак 2.1 или 5.1 — на всём участке действия",["sign_2_1.png","sign_5_1.png"]),
              (B.S(3),"2","знаки 1.7.1–1.7.7 — на этом перекрёстке",["sign_1_7_1.png","sign_1_7_2.png"]),
              (B.S(4),"3","покрытие:",[])]
        for i,(tt,n,s_,ims) in enumerate(rows):
            aa=appear(t,tt)
            if aa<=0: continue
            yy=80+i*96
            d.ellipse([36*SS,(yy+8)*SS,64*SS,(yy+36)*SS],fill=(28,86,196,int(255*aa))); txt(d,(50,yy+22),n,15,(255,255,255),aa,"mm",DJB)
            txt(d,(76,yy+22),s_,15,INK,aa,"lm",DJB if n!="3" else DJB)
            xx=80
            for im in ims: w=sign(img,im,xx,yy+40,48,aa); xx+=w+14
            if n=="3":
                for k,(lab,col) in enumerate([("твёрдое",(78,80,86)),("щебёночное",(150,150,140)),("грунтовое",(156,128,92))]):
                    a3=appear(t,tt+0.8+k*0.7); bx=80+k*160
                    d.rounded_rectangle([bx*SS,(yy+42)*SS,(bx+128)*SS,(yy+76)*SS],6*SS,fill=col+(int(255*a3),))
                    txt(d,(bx+64,yy+59),lab,14,(255,255,255),a3,"mm",DJB)
                    if k<2: txt(d,(bx+144,yy+59),">",20,INK,a3,"mm",DJB)
        if t>B.S(4)+3:
            solid(d,36,346,"грунтовка уступает тебе",DG,appear(t,B.S(4)+3),15)
    if t>B.S(6)-0.2:
        a=appear(t,B.S(6)); 
        if t<B.S(8)-0.3:
            panel(24,384,a); y=card(d,32,34,516,Q37C,"ст. 5, п. 37, посл. фраза",a,14)
            if t>B.S(7)-0.2:
                y=card(d,32,y+10,516,Q36_8,"ст. 36, п. 8",appear(t,B.S(7)),14)
        else:
            a8=appear(t,B.S(8)); panel(24,384,a8)
            d.rounded_rectangle([32*SS,34*SS,548*SS,104*SS],10*SS,fill=(255,236,232,int(255*a8)),outline=RED+(int(255*a8),),width=2*SS)
            txt(d,(46,56),"минус п. 37: 4 критерия в одном предложении,",14,RED,a8,"lm",DJB); txt(d,(46,82),"старшинство между ними прямо не названо",14,INK,a8,"lm")
            y=card(d,32,116,516,Q36_6,"ст. 36, п. 6",appear(t,B.S(8)+3),14)
            solid(d,36,y+10,"знак важнее покрытия",DG,appear(t,B.S(8)+7),15)
# ---------------- exam: real tickets ----------------
import json as _json
_T={x["id"]:x for x in _json.load(open(TK+"tickets_ru.json",encoding="utf-8"))["questions"]}
def _clean(s): return _re.sub(r"\s+"," ",s).strip()
def tk(i): x=_T[i]; return _clean(x["question"]),[_clean(a["text"]) for a in x["answers"]],x["correct"]-1,x
NOTE=lambda x: f"база кат. B · teoria.on.ge · тема {x['topic_id']}"
def explain(d,t,t0,y,lines,cite,h=None):
    if t<=t0: return
    a=appear(t,t0); y=max(y,300)+6; cw=F(DJB,13*SS).getlength(cite)/SS; tw=1040-cw
    h=h or para_h(lines,15,tw)+26
    d.rounded_rectangle([24*SS,y*SS,(BW-24)*SS,(y+h)*SS],10*SS,fill=(255,250,235,int(255*a)),outline=GOLD+(int(255*a),),width=2*SS)
    chip(d,40,y+12,cite,BLUE,a,13); para(d,40+cw+34,y+13,lines,15,tw,WHITE,a)
def b_t888(img,d,t,B,D):
    q,o,c,x=tk(888)
    y=exam(img,d,t,q,o,c,B.S(1),NOTE(x),t_opts=[B.S(0)+1.5+i*0.6 for i in range(len(o))],tag="Билет № 888")
    explain(d,t,B.S(1)+0.3,y,"Вариант 1 — п. 13 по смыслу (перевод в базе не дословно Matsne). Вариант 2 — выезды с прилегающих территорий: как раз не перекрёсток. Вариант 3 — разные уровни: не перекрёсток.","ст. 5, п. 13")
TIMG={}
def pic54(img,d,t,x,y):
    if "54" not in TIMG:
        im=Image.open(TK+_T[54]["image"]).convert("RGBA"); im=im.crop((0,0,im.size[0],462)); TIMG["54"]=im
    im=TIMG["54"]; w=460; s=w/im.size[0]; r=im.resize((int(w*SS),int(im.size[1]*s*SS)),Image.LANCZOS); put(img,r,(x*SS,y*SS))
    txt(d,(x+w,y+im.size[1]*s+6),"изображение из базы билетов (teoria.on.ge)",11,GREY,1,"ra")
    B=TIMG.get("B")
    if B and t>B[0]:
        for k,(px,py) in enumerate([(715,250),(150,150),(478,60),(870,110)]):
            a=appear(t,B[0]+k*0.9)
            if a<=0: continue
            X,Y=x+px*s,y+py*s; d.ellipse([(X-14)*SS,(Y-14)*SS,(X+14)*SS,(Y+14)*SS],fill=((30,150,80) if k<3 else (205,40,30))+(int(255*a),),outline=(255,255,255,int(255*a)),width=2*SS)
            txt(d,(X,Y),str(k+1),16,(255,255,255),a,"mm",DJB)
def b_t54(img,d,t,B,D):
    q,o,c,x=tk(54); TIMG["B"]=(B.S(1)+0.5,)
    y=exam(img,d,t,q,o,c,B.S(1),NOTE(x),picture=pic54,pic_w=460,t_opts=[B.S(0)+1.5+i*0.6 for i in range(len(o))],tag="Билет № 54")
    if t>B.S(1)+1.5:
        a=appear(t,B.S(1)+1.5); x0=BW-24-460; y0=316
        d.rounded_rectangle([x0*SS,y0*SS,(x0+460)*SS,(y0+124)*SS],10*SS,fill=(255,250,235,int(255*a)),outline=GOLD+(int(255*a),),width=2*SS)
        para(d,x0+14,y0+12,"4 · автобус — с грунтовой: второстепенная, едет последним (ст. 5, п. 37; ст. 36, п. 6).\n1–3 · остальные — равнозначные, помеха справа (ст. 36, п. 4 «в»): легковой → мотоцикл → грузовой.",15,432,WHITE,a)
def b_t961(img,d,t,B,D):
    q,o,c,x=tk(961)
    y=exam(img,d,t,q,o,c,B.S(1),NOTE(x),t_opts=[B.S(0)+1.2+i*0.6 for i in range(len(o))],tag="Билет № 961")
    explain(d,t,B.S(1)+0.3,y,"«…и нет знаков приоритета, считается, что он находится на второстепенной дороге». Не видно покрытия и знаков — уступай.","ст. 36, п. 8")
# ---------------- chat: wrap-up ----------------
def b_outro(img,d,t,B,D):
    txt(d,(700,36),"Выпуск 3 — итог",20,(235,238,245),1,"rm",DJB)
    rows=[("перекрёсток","ст. 5, п. 13","пересечение / примыкание / разветвление на одном уровне; выезд со двора — не перекрёсток",BLUE),
          ("прилегающая территория","ст. 5, п. 38","двор, АЗС, стоянка… не для сквозного движения; выезжая — уступи всем (ст. 36, п. 7)",GREEN),
          ("главная дорога","ст. 5, п. 37","знак 2.1/5.1 · знаки 1.7.1–1.7.7 · твёрдое > щебёнка > грунт; не видно — ты второстепенный",GOLD)]
    for i,(h,c,s_,col) in enumerate(rows):
        a=appear(t,0.4+i*0.8); y=74+i*122
        if a<=0: continue
        d.rounded_rectangle([30*SS,y*SS,700*SS,(y+108)*SS],12*SS,fill=col+(int(30*a),),outline=col+(int(255*a),),width=2*SS)
        txt(d,(48,y+22),h,18,col,a,"lm",DJB); chip(d,690,y+10,c,col,a,13,anchor="r")
        para(d,48,y+44,s_,15,630,(235,238,245),a)
    if t>B.S(1)-0.2:
        a=appear(t,B.S(1)); d.rounded_rectangle([90*SS,450*SS,640*SS,540*SS],14*SS,fill=(32,52,96,int(245*a)))
        txt(d,(365,476),"Выпуск 4 · ст. 5 — термины",18,(255,214,120),a,"mm",DJB); txt(d,(365,510),"пешеходный переход · ж/д переезд · населённый пункт",15,(235,238,245),a,"mm")
