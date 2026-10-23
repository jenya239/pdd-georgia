#!/usr/bin/env python3
"""Build tickets_ru.json (+ka/en) from parsed_all.json: law-article extraction + episode mapping."""
import json, re, os, sys, collections, datetime
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "data", "tickets")  # repo data/tickets
P = json.load(open(f"{D}/parsed_all.json"))
OUT = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--out=")), D)  # --out=DIR for reproducibility checks
# Episode rows from structure.md section 3 (block, title, n_episodes, law keys)
ROWS = [
 ("0","Вступление, формат экзамена",2,["L1","L2","L3","L4","L55"]),
 ("1","Словарь дороги (ст.5)",3,[]),("1","Участники и транспорт (ст.5)",2,[]),("1","Действия и состояния (ст.5)",3,["L5"]),
 ("2","Водитель: обязанности",5,["L20","L21"]),("2","Пассажиры, погонщики",1,["L22","L23"]),
 ("2","Пешеходы и водитель",5,["L24","L25"]),("2","Дети",2,["L26"]),("2","ДТП",1,["L27"]),
 ("3","Иерархия сигналов",1,["L28"]),("3","Светофор",4,["L29","A4"]),("3","Регулировщик",2,["L30"]),
 ("4","Предупреждающие знаки",3,["A1.1"]),("4","Знаки приоритета",1,["A1.2"]),("4","Запрещающие",3,["A1.3"]),
 ("4","Предписывающие",2,["A1.4"]),("4","Особых предписаний",4,["A1.5"]),("4","Сервис, информационные, таблички",3,["A1.6","A1.7","A1.8","A1"]),
 ("4","Разметка",3,["A2"]),
 ("5","Расположение на проезжей части",3,["L31"]),("5","Начало движения, манёвры",4,["L32"]),("5","Скорость и дистанция",3,["L33"]),
 ("5","Обгон, движение в рядах",4,["L34"]),("5","Встречный разъезд",1,["L35"]),
 ("6","Перекрёстки",6,["L36"]),("7","Остановка и стоянка",4,["L37"]),
 ("8","Автомагистраль",1,["L38"]),("8","Ж/д переезд",2,["L39"]),("8","Трамвай, маршрутки",2,["L40","L41"]),
 ("8","Тоннели, жилые зоны",1,["L42","L44"]),("8","Велосипеды, СИМ, мопеды",2,["L43"]),
 ("9","Буксировка",1,["L45"]),("9","Перевозка людей и груза",2,["L46","L46¹","L47"]),
 ("10","Звук. сигналы, фары",3,["L48","L49","L50"]),("10","Спецмашины, аварийка",2,["L51","L52"]),
 ("11","Техсостояние, техосмотр, регистрация",3,["L6","L7","L8","L9","L10","L11","L11¹","L12","L13","L14","L15","L16","L16¹","L17","L18","L19","L53","A3"]),
 ("12","Категории, экзамен, права",3,["L54","L56","L57","L58"]),("12","Баллы, лишение, учебная езда",2,["L59","L59¹","L60","L61","A5"]),
 ("13","Штрафы (КоАП)",4,["AOC"]),("14","Вне закона: первая помощь, физика, эко",4,["X"]),
]
EP = []; KEY2ROW = {}; n = 1
for ri, (blk, title, k, keys) in enumerate(ROWS):
    eps = [f"E{n+i:03d}" for i in range(k)]; n += k
    EP.append({"block": blk, "title": title, "episodes": eps, "keys": keys})
    for key in keys: KEY2ROW[key] = ri
DEF5 = [1, 2, 3]  # rows for art.5 (definitions) -> all 8 episodes
# teoria topic -> fallback row index
TOPIC_ROW = {1:4,2:35,3:12,4:13,5:14,6:15,7:17,8:17,9:17,10:10,11:11,12:34,13:34,14:33,15:20,16:22,17:21,18:21,19:25,
             20:24,21:27,22:26,23:28,24:31,25:37,26:32,27:30,28:18,29:39,30:39,31:38,32:39}
# paragraph counts per law article (from Russian consolidated text) for proportional episode choice
law = open(f"{D}/../sources/law_ru_matsne_pub36_2026-06-25.txt").read().split("\n")
PARA = {}; cur = None
for l in law:
    m = re.match(r"\s*Статья (\d+)(\d)?\s*\.", l) or re.match(r"\s*Статья (\d+)()\.", l)
    if m:
        a, s = m.group(1), m.group(2)
        cur = a if not s or a + s in ("1","2") else a  # handled below
        hm = re.match(r"\s*Статья (\d+)\s+\.", l)
        cur = (a[:-1] + "¹") if hm and a in ("111","161","461","591","631") else a
        PARA[cur] = 0; continue
    if cur and re.match(r"\s*(\d+)\d?\s*\.\s", l):
        p = int(re.match(r"\s*(\d+)", l).group(1))
        if p < 80: PARA[cur] = max(PARA[cur], p)
VALID = {str(i) for i in range(1, 65)} | {"11¹","16¹","46¹","59¹","63¹"}
ORD = {"პირველი":1}
def num(tok):
    tok = tok.strip()
    if tok in ORD: return ORD[tok]
    m = re.search(r"(\d+)", tok); return int(m.group(1)) if m else None
ART_RE = re.compile(r"(?:(?:მე-)?(\d+)(?:-?-ე)?|(პირველი))\s+მუხლ(?:ის|ით|ში|ი)?(?:\s+(?:(?:მე-)?(\d+)(?:-ე)?|(პირველი))\s+(?:ნაწილ|პუნქტ))?")
def refs(t):
    law, aoc, ann = [], [], []
    for m in ART_RE.finditer(t):
        a = m.group(1) or ("1" if m.group(2) else None)
        p = m.group(3) or ("1" if m.group(4) else None)
        back = t[max(0, m.start()-90):m.start()]
        if back.rstrip().endswith(("ამ", "ამავე")) and not m.group(1) and not m.group(2): continue
        is_aoc = back.rfind("კოდექს") > back.rfind("კანონ")
        if a not in VALID and not is_aoc:
            if len(a) >= 2 and a.endswith("1") and (a[:-1] + "¹") in VALID: a = a[:-1] + "¹"
            else: continue
        item = {"article": a, "paragraph": int(p) if p else None}
        (aoc if is_aoc else law).append(item)
    for m in re.finditer(r"(პირველი|მე-(\d))\s+დანართ", t):
        an = 1 if m.group(1) == "პირველი" else int(m.group(2))
        tail = t[m.end(): m.end()+220]
        signs = re.findall(r"(?<![\d.])(\d\.\d{1,2}(?:\.\d{1,2})?)(?![\d])", tail)
        ann.append({"annex": an, "items": sorted(set(signs))})
    # sign mentions without annex word: "საგზაო ნიშანი 5.1" / "მონიშვნა 1.1"
    for m in re.finditer(r"(ნიშან\S*|მონიშვნ\S*)\s+(\d\.\d{1,2}(?:\.\d{1,2})?)", t):
        an = 1 if m.group(1).startswith("ნიშ") else 2
        ann.append({"annex": an, "items": [m.group(2)]})
    def dedup(xs):
        seen, out = set(), []
        for x in xs:
            k = json.dumps(x, sort_keys=True)
            if k not in seen: seen.add(k); out.append(x)
        return out
    return dedup(law), dedup(aoc), dedup(ann)
def episodes_for(law, aoc, ann, topic):
    eps, method = [], None
    for r in law:
        a = r["article"]
        if a == "5":
            for ri in DEF5: eps += EP[ri]["episodes"]
            continue
        ri = KEY2ROW.get("L" + a)
        if ri is None: continue
        e = EP[ri]["episodes"]
        # rows sharing several articles or 1-episode rows: whole row; else pick by paragraph position
        if r["paragraph"] and len(e) > 1 and len(EP[ri]["keys"]) == 1 and PARA.get(a):
            idx = min(len(e)-1, int((r["paragraph"]-1) * len(e) / max(PARA[a], r["paragraph"])))
            eps.append(e[idx])
        else: eps += e
    for r in ann:
        if r["annex"] == 1 and r["items"]:
            for it in r["items"]:
                ri = KEY2ROW.get("A1." + it.split(".")[0])
                if ri is not None: eps += EP[ri]["episodes"]
        else:
            ri = KEY2ROW.get(f"A{r['annex']}")
            if ri is not None: eps += EP[ri]["episodes"]
    if aoc: eps += EP[KEY2ROW["AOC"]]["episodes"]
    if eps: method = "law_reference"
    else:
        eps = EP[TOPIC_ROW[topic]]["episodes"]; method = "topic_fallback"
    out = []
    for e in eps:
        if e not in out: out.append(e)
    return sorted(out), method
TOPIC_RU = {1:"Водитель, пассажир, пешеход; знаки; Конвенция",2:"Неисправности и условия управления",3:"Предупреждающие знаки",
 4:"Знаки приоритета",5:"Запрещающие знаки",6:"Предписывающие знаки",7:"Информационно-указательные знаки",8:"Знаки сервиса",
 9:"Знаки дополнительной информации (таблички)",10:"Сигналы светофора",11:"Сигналы регулировщика",12:"Специальные сигналы",
 13:"Аварийная световая сигнализация",14:"Световые приборы, звуковой сигнал",15:"Движение, маневрирование, проезжая часть",
 16:"Обгон, встречный разъезд",17:"Скорость движения",18:"Тормозной путь, дистанция",19:"Остановка и стоянка",
 20:"Проезд перекрёстков",21:"Железнодорожный переезд",22:"Движение по автомагистрали",23:"Жилая зона, приоритет маршрутных ТС",
 24:"Буксировка",25:"Учебная езда",26:"Перевозка людей и грузов",27:"Велосипед, мопед, прогон скота",28:"Дорожная разметка",
 29:"Медицинская помощь",30:"Безопасность движения",31:"Административное право",32:"Эко-вождение"}
fetched = "2026-10-20"
by = {loc: {r["id"]: r for r in P["data"][loc]} for loc in ("ru","ka","en")}
records = []
for tid in sorted(by["ru"]):
    r = by["ru"][tid]
    law, aoc, ann = refs(r["explanation_ka"])
    eps, method = episodes_for(law, aoc, ann, r["topic"])
    img = r["image_url"]
    flags = []
    if not r["explanation_ka"] or "მალე დაემატება" in r["explanation_ka"]: flags.append("no_explanation")
    if img and not os.path.exists(f"{D}/images/" + img.rsplit("/",1)[1]): flags.append("image_missing")
    if r["question"] == by["ka"][tid]["question"]: flags.append("ru_text_is_georgian_untranslated")
    rec = {"id": tid, "source_url": f"https://teoria.on.ge/tickets?ticket={tid}", "category": "B,B1",
           "topic_id": r["topic"], "topic_ru": TOPIC_RU[r["topic"]], "topic_ka": P["topics"][str(r["topic"])],
           "question": r["question"], "answers": r["answers"], "correct": r["correct"][0] if len(r["correct"]) == 1 else r["correct"],
           "image": ("images/" + img.rsplit("/",1)[1]) if img else None, "image_url": img,
           "explanation_ka": (None if "no_explanation" in flags else r["explanation_ka"]), "law_refs": law, "annex_refs": ann, "aoc_refs": aoc,
           "episodes": eps, "episodes_method": method, "flags": flags,
           "ka": {"question": by["ka"][tid]["question"], "answers": by["ka"][tid]["answers"]},
           "en": {"question": by["en"][tid]["question"], "answers": by["en"][tid]["answers"]}}
    records.append(rec)
FIXES = {k: v for k, v in json.load(open(f"{D}/manual_fixes.json", encoding="utf-8")).items() if not k.startswith("_")}
for rec in records:
    rec.update(FIXES.get(str(rec["id"]), {}))
meta = {"source": "https://teoria.on.ge/tickets/2 (category B/B1), locale=ru via exam-settings cookie", "fetched": fetched,
        "count": len(records), "episodes_index": EP, "note": "Private study copy; see README.md for terms of use."}
json.dump({"meta": meta, "questions": records}, open(f"{OUT}/tickets_ru.json","w"), ensure_ascii=False, indent=1)
# stats
c = collections.Counter(r["episodes_method"] for r in records); print(c)
blk = collections.Counter(); 
for r in records:
    bs = {EP[i]["block"] for i in range(len(EP)) if set(EP[i]["episodes"]) & set(r["episodes"])}
    for b in bs: blk[b] += 1
print(sorted(blk.items(), key=lambda x: int(x[0])))
json.dump({"by_block": blk, "by_method": c}, open(f"{OUT}/stats.json","w"), ensure_ascii=False, indent=1)
