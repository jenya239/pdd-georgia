# ПДД ep01 boards (exec'd by engine/core.py; helpers from engine/lib.py)
import re as _re
SRC=str(SOURCES)+"/"
def _amend():
    t=(open(SRC+"law_ru_matsne_pub36_2026-06-25.txt",encoding="utf-8").read()+open(SRC+"annexes_ru_matsne_pub36.txt",encoding="utf-8").read()).replace("\n"," ")
    laws=set(_re.sub(r"\s+"," ",m) for m in _re.findall(r"Закон Грузии №\s*\d+\s+от\s+\d+\s+\S+\s+\d{4}",t))
    yrs={}
    for l in laws: y=int(l[-4:]); yrs[y]=yrs.get(y,0)+1
    return len(laws),yrs
N_AMEND,AMEND_YRS=_amend()
CHAPTERS=[("I","Общие положения","ст. 1–5"),("II","Организация движения и безопасность","ст. 6–19"),("III","Правила дорожного движения","ст. 20–47"),
          ("IV","Звуковые, световые и спецсигналы","ст. 48–52"),("V","Регистрация транспортных средств","ст. 53"),("VI","Право на управление ТС","ст. 54–59¹"),
          ("VII","Автошколы и учебная езда","ст. 60–61"),("VIII","Переходные и заключит. положения","ст. 62–64")]
ANNEX=[("1","«Дорожные знаки»"),("2","«Дорожная разметка»"),("3","«Опознавательные знаки, прикрепляемые к ТС»"),("4","«Типы светофоров»"),("5","«Таблица сокращения количества баллов…»")]
def b_law_card(img,d,t,B,D):
    # a: "where's the rulebook?"  m: lights  t: the law itself
    if t<B.S(2)-0.3:
        a=appear(t,0.5)
        d.rounded_rectangle([250*SS,80*SS,480*SS,370*SS],12*SS,fill=(60,70,92,int(255*a)),outline=(120,130,150,int(255*a)),width=2*SS)
        txt(d,(365,190),"ПДД",44,(230,232,240),a,"mm",DJB); txt(d,(365,250),"отдельная книжка?",16,(200,205,215),a,"mm")
        txt(d,(365,300),"?",48,GOLD,a,"mm",DJB)
        if t>B.S(1)-0.2:
            a2=appear(t,B.S(1)); sign(img,"light_T1.png",560,110,190,a2,"mt",card=True); txt(d,(560,325),"прил. 4, тип Т.1",14,GREY,a2,"ma")
    else:
        a=appear(t,B.S(2)); y=70
        d.rounded_rectangle([60*SS,60*SS,670*SS,400*SS],14*SS,fill=(240,236,225,int(255*a)))
        d.rectangle([60*SS,60*SS,670*SS,70*SS],fill=(150,40,40,int(255*a)))
        txt(d,(365,110),"Закон Грузии",20,(60,60,70),a,"mm",SERIF)
        txt(d,(365,160),"«О дорожном движении»",30,(30,30,40),a,"mm",SERIFB)
        txt(d,(365,215),"№ 1830-რს · Кутаиси, 24 декабря 2013 г.",17,(70,70,80),a,"mm",SERIF)
        txt(d,(365,265),"8 глав · ст. 1–64 · 5 приложений",17,(70,70,80),appear(t,B.S(2)+2.0),"mm")
        txt(d,(365,300),"консолидированная редакция 25.06.2026",15,(150,40,40),appear(t,B.S(2)+3.0),"mm")
        txt(d,(365,365),"matsne.gov.ge · рег. код 310150000.05.001.017312",13,(110,110,120),appear(t,B.S(2)+3.5),"mm")
        txt(d,(365,450),"Отдельного свода ПДД нет: правила, знаки и разметка — в самом законе",15,WHITE,appear(t,B.S(2)+1.0),"mm")
def b_structure(img,d,t,B,D):
    txt(d,(30,22),"Закон «О дорожном движении»: 8 глав + 5 приложений",22,WHITE,1,"la",DJB)
    for i,(n,name,arts) in enumerate(CHAPTERS):
        a=appear(t,0.6+i*0.35); y=70+i*44; key=n in ("I","III")
        hl=t>B.S(1) and key
        if hl: d.rounded_rectangle([24*SS,(y-6)*SS,560*SS,(y+32)*SS],8*SS,fill=GOLD+(40,),outline=GOLD+(255,),width=2*SS)
        txt(d,(36,y+13),f"Гл. {n}",16,BLUE,a,"lm",DJB); txt(d,(104,y+13),name,16,WHITE if (hl or t<B.S(1)) else GREY,a,"lm"); txt(d,(548,y+13),arts,14,GREY,a,"rm")
    if t>B.S(1): txt(d,(36,432),"I — термины (ст. 5)   III — сами правила (ст. 20–47)",15,GOLD,appear(t,B.S(1)+1),"la",DJB)
    # annexes
    if t>B.S(2)-0.2:
        x0=600; txt(d,(x0,62),"Приложения — ст. 2, п. 1",16,BLUE,appear(t,B.S(2)),"la",DJB)
        for i,(n,name) in enumerate(ANNEX):
            a=appear(t,B.S(2)+0.4+i*0.9); y=92+i*72
            d.rounded_rectangle([x0*SS,y*SS,1215*SS,(y+62)*SS],10*SS,fill=(255,255,255,int(255*a)),outline=(200,204,210,int(255*a)),width=SS)
            txt(d,(x0+14,y+18),f"№{n}",18,GOLD,a,"lm",DJB); para(d,x0+62,y+8,name,15,300,WHITE,a)
            if n=="1":
                for k,s_ in enumerate(["sign_2_1.png","sign_2_3.png","sign_3_1.png","sign_5_19_1.png"]): sign(img,s_,1000+k*52,y+8,46,a)
            if n=="2": sign(img,"mark_1_1.png",1000,y+18,26,a)
            if n=="3": sign(img,"id_learner.png",1040,y+6,50,a)
            if n=="4": sign(img,"light_T1.png",1080,y+4,54,a)
            if n=="5": txt(d,(1100,y+31),"−баллы",18,RED,a,"mm",DJB)
    if t>B.S(3)-0.2:
        quote(d,600,460,615,"Приложения, определенные пунктом первым настоящей статьи, являются неотъемлемыми частями настоящего Закона.","ст. 2, п. 2",appear(t,B.S(3)),15)
def b_split(img,d,t,B,D):
    txt(d,(30,22),"Правило, знак, штраф: где что лежит",22,WHITE,1,"la",DJB)
    a=appear(t,0.3)
    sign(img,"sign_2_3.png",40,72,92,a)
    quote(d,150,64,520,"„Уступите дорогу“ – дорога, по которой движущийся водитель обязан уступить дорогу водителю, движущемуся по пересекаемой дороге, а при наличии таблички 8.13 – водителю, движущемуся по главной дороге.","прил. 1, п. 2.3",a,14)
    para(d,150,232,"описание знака — норма закона (в переводе знак назван «дорогой» — читаем по смыслу)",13,520,GREY,appear(t,2.5))
    if t>B.S(1)-0.2:
        quote(d,700,64,515,"Нарушение законодательства Грузии в сфере дорожного движения и организации дорожного движения влечет гражданскую, уголовную и административную ответственность в порядке, установленном законодательством Грузии.","ст. 4",appear(t,B.S(1)),14)
        txt(d,(700,240),"сумм штрафов в законе нет",15,RED,appear(t,B.S(1)+3),"la",DJB)
    if t>B.S(2)-0.2:
        a=appear(t,B.S(2)); y=290
        boxes=[(60,"Закон №1830","правила (гл. III–IV)\nзнаки, разметка (прил. 1–2)\nбаллы (прил. 5)",BLUE),(470,"КоАП Грузии","суммы штрафов\nза нарушения",RED),(860,"Приказы МВД и др.","формат экзамена\n(не в законе)",GREY)]
        for k,(x,h,body,col) in enumerate(boxes):
            aa=appear(t,B.S(2)+k*1.2)
            d.rounded_rectangle([x*SS,y*SS,(x+340)*SS,(y+150)*SS],12*SS,fill=col+(int(30*aa),),outline=col+(int(255*aa),),width=2*SS)
            txt(d,(x+170,y+28),h,19,col,aa,"mm",DJB); para(d,x+20,y+56,body,15,300,WHITE,aa)
        if t>B.S(3)-0.2:
            aa=appear(t,B.S(3)); d.rounded_rectangle([470*SS,460*SS,810*SS,540*SS],10*SS,fill=(255,240,220,int(255*aa)),outline=GOLD+(int(255*aa),),width=2*SS)
            para(d,485,470,"КоАП на Matsne — только по-грузински. Штрафы называем после сверки.",14,310,WHITE,aa)
        para(d,860,455,"ст. 55, п. 15: другие требования — приказом министра внутренних дел",13,340,GREY,appear(t,B.S(2)+3))
def b_matsne(img,d,t,B,D):
    browser(img,d,"matsne.gov.ge/ru/document/view/2169396")
    txt(d,(40,70),"Закон Грузии «О дорожном движении»",24,WHITE,1,"la",SERIFB)
    txt(d,(40,104),"№ 1830-რს · 24.12.2013 · регистрационный код 310150000.05.001.017312",14,GREY,1,"la")
    langs=[("ქართული","грузинский — оригинал, имеет юридическую силу",GREEN,B.S(1)),("Русский","перевод · редакция 25.06.2026 — актуальна",BLUE,B.S(2)),("English","перевод · последние изменения 2019 г. — устарел",RED,B.S(2)+2.5)]
    for i,(l,st,col,tt) in enumerate(langs):
        y=140+i*58; a=appear(t,0.8+i*0.4)
        d.rounded_rectangle([40*SS,y*SS,200*SS,(y+44)*SS],8*SS,fill=(238,240,245,int(255*a)),outline=(190,195,205,int(255*a)),width=SS)
        txt(d,(120,y+22),l,18,WHITE,a,"mm",DJB)
        if t>tt-0.2: chip(d,220,y+7,st,col,appear(t,tt),15,font=DJ)
    # amendments timeline (computed from footnotes in the RU texts)
    if t>B.S(3)-0.2:
        a=appear(t,B.S(3)); x0,y0=60,500; ys=list(range(2014,2027)); mx=max(AMEND_YRS.values())
        txt(d,(40,330),f"Изменяющие законы по сноскам (закон + приложения): {N_AMEND}",16,WHITE,a,"la",DJB)
        for i,yv in enumerate(ys):
            x=x0+i*88; n=AMEND_YRS.get(yv,0); h=n/mx*120*ease((t-B.S(3)-i*0.1)/0.6)
            d.rectangle([(x)*SS,(y0-h)*SS,(x+44)*SS,y0*SS],fill=GOLD+(int(220*a),))
            txt(d,(x+22,y0+8),str(yv),13,GREY,a,"ma"); txt(d,(x+22,y0-h-6),str(n),13,WHITE,a if n else 0,"ms")
        txt(d,(1200,330),"подсчёт по сноскам «Закон Грузии № … от …»",12,GREY,a,"ra")
def b_foreign(img,d,t,B,D):
    car_view(img,d,t)
    sign(img,"id_learner.png",1150,24,56,1)   # learner car (annex 3 sign)
    txt(d,(1178,86),"прил. 3",11,(200,200,200),1,"ma")
    if t<B.S(1)-0.2:
        a=appear(t,0.3)*min(1,ease((B.S(1)-t)/0.4))
        d.rounded_rectangle([760*SS,120*SS,1060*SS,300*SS],12*SS,fill=(235,225,250,int(240*a)),outline=(140,80,200,int(255*a)),width=2*SS)
        txt(d,(910,160),"DRIVING LICENCE",18,(90,50,140),a,"mm",DJB); txt(d,(910,200),"права другой страны",15,(60,60,70),a,"mm")
        txt(d,(910,250),"«езжу, как привык»",17,(140,80,200),a,"mm",SERIF)
    else:
        a=appear(t,B.S(1))
        d.rounded_rectangle([680*SS,90*SS,1210*SS,330*SS],12*SS,fill=(250,248,240,int(240*a)))
        chip(d,700,104,"ст. 1, п. 2",(28,86,196),a,14)
        para(d,700,140,"«Действие настоящего Закона распространяется на граждан Грузии, а также на иностранцев и лиц без гражданства, участвующих в дорожном движении на территории Грузии…»",15,490,(30,32,44),a,SERIF)
        if t>B.S(2)-0.2: chip(d,700,280,"одна дорога → одинаковые ожидания у всех",(20,120,60),appear(t,B.S(2)),15)
def b_exam_law(img,d,t,B,D):
    txt(d,(30,22),"Экзамен: что в законе, а что — нет",22,WHITE,1,"la",DJB)
    rows=[(B.S(1),"ст. 55, п. 1","экзамен: теоретический и (или) практический — в один или два этапа"),
          (B.S(1)+4.5,"ст. 55, п. 4 «г»","категория B — с 17 лет"),
          (B.S(2),"ст. 55, п. 2 «а»","допуск — после полного курса в автошколе…"),
          (B.S(2)+3,"ст. 55, п. 3","…но с 18 лет на B можно и без курса")]
    for i,(tt,c,s_) in enumerate(rows):
        a=appear(t,tt); y=74+i*112
        if a<=0: continue
        chip(d,30,y,c,BLUE,a,15); para(d,30,y+32,s_,19,560,WHITE,a)
    if t>B.S(3)-0.2:
        a=appear(t,B.S(3)); x0=640
        d.rounded_rectangle([x0*SS,64*SS,1215*SS,330*SS],12*SS,fill=(255,255,255,int(255*a)),outline=(200,204,210,int(255*a)),width=SS)
        txt(d,(x0+20,82),"Не в законе: данные агентства (sa.gov.ge), кат. B",15,GREY,a,"la",DJB)
        for k,(big,small,col) in enumerate([("30","вопросов",BLUE),("≥ 25","верных",GREEN),("≤ 5","ошибок",RED)]):
            aa=appear(t,B.S(3)+0.8+k*1.0); x=x0+30+k*180
            txt(d,(x+70,160),big,44,col,aa,"mm",DJB); txt(d,(x+70,205),small,16,WHITE,aa,"mm")
        if t>B.S(4)-0.2:
            aa=appear(t,B.S(4)); txt(d,(x0+20,250),"до 2026: ≥ 27 верных (≤ 3 ошибок)",15,GREY,aa,"la")
            txt(d,(x0+20,280),"время: 30 мин — по сообщению 1TV (21.05.2026)",15,GREY,appear(t,B.S(4)+3),"la")
    if t>B.S(5)-0.2:
        a=appear(t,B.S(5)); y=360
        d.rounded_rectangle([640*SS,y*SS,1215*SS,(y+70)*SS],10*SS,fill=(255,236,232,int(255*a)),outline=RED+(int(255*a),),width=2*SS)
        txt(d,(656,y+18),"sa.gov.ge/p/gamocdiskitxvebi",14,RED,a,"lm",MONO); txt(d,(656,y+46),"B: «30 კითხვიდან … 27» — старая цифра",15,WHITE,a,"lm")
    if t>B.S(6)-0.2:
        a=appear(t,B.S(6)); y=445
        d.rounded_rectangle([640*SS,y*SS,1215*SS,(y+70)*SS],10*SS,fill=(226,244,232,int(255*a)),outline=GREEN+(int(255*a),),width=2*SS)
        txt(d,(656,y+18),"sa.gov.ge/p/driver-license/theoretical-test",14,GREEN,a,"lm",MONO); txt(d,(656,y+46),"B: «30 კითხვიდან … 25» · проверено 20.10.2026",15,WHITE,a,"lm")
def b_format(img,d,t,B,D):
    txt(d,(40,40),"Как устроен каждый выпуск",22,WHITE,1,"la",DJB)
    steps=[("1","Буква закона","цитата + номер статьи и пункта",BLUE),("2","Зачем","какую проблему решает правило",GREEN),("3","Типичная ошибка","где путаются и спорят",PINK),("4","Вопрос","в стиле экзамена, с разбором",GOLD)]
    for i,(n,h,s_,col) in enumerate(steps):
        a=appear(t,0.5+i*1.3); y=100+i*100
        d.rounded_rectangle([60*SS,y*SS,670*SS,(y+80)*SS],12*SS,fill=col+(int(35*a),),outline=col+(int(255*a),),width=2*SS)
        d.ellipse([78*SS,(y+18)*SS,122*SS,(y+62)*SS],fill=col+(int(255*a),)); txt(d,(100,y+40),n,20,(20,22,30),a,"mm",DJB)
        txt(d,(145,y+28),h,20,col,a,"lm",DJB); txt(d,(145,y+56),s_,15,WHITE,a,"lm")
    if t>B.S(1)-0.2: txt(d,(365,520),"+ Макс спорит — правило должно выдержать вопрос «зачем?»",15,(200,160,240),appear(t,B.S(1)),"mm")
Q1="Распространяется ли Закон Грузии «О дорожном движении» на иностранца, который ведёт машину по Тбилиси?"
Q1O=["Нет, только на граждан Грузии","Да, если международным договором Грузии не предусмотрено иное","Только если у него грузинское водительское удостоверение"]
def b_q1(img,d,t,B,D):
    y=exam(img,d,t,Q1,Q1O,1,B.S(2),"составлен для серии · не из официальной базы",t_opts=[B.S(1)+3.5,B.S(1)+4.3,B.S(1)+5.1])
    if t>B.S(2)+1:
        a=appear(t,B.S(2)+1); y+=6
        d.rounded_rectangle([24*SS,y*SS,(BW-24)*SS,(y+64)*SS],10*SS,fill=(255,250,235,int(255*a)),outline=GOLD+(int(255*a),),width=2*SS)
        chip(d,40,y+18,"ст. 1, п. 2",BLUE,a,14); para(d,150,y+12,"«…распространяется на граждан Грузии, а также на иностранцев и лиц без гражданства… если международным договором или соглашением Грузии не предусмотрено иное»",14,1040,WHITE,a,SERIF)
    if t>B.S(3)-0.2:
        a=appear(t,B.S(3)); d.rounded_rectangle([300*SS,470*SS,940*SS,560*SS],14*SS,fill=(32,52,96,int(245*a)))
        txt(d,(620,496),"Выпуск 2 · ст. 5 — термины",18,(255,214,120),a,"mm",DJB); txt(d,(620,530),"дорога · проезжая часть · полоса движения · тротуар",16,(235,238,245),a,"mm")
