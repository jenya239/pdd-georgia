# -*- coding: utf-8 -*-
"""Сборка данных сайта: ../data/*.json и копия картинок в ../img.
Запуск: python3 tools/build.py (из папки site). Нужны ../../tickets/tickets_ru.json, ../../structure.md, ../../sources/."""
import json, os, re, shutil, collections
from lawparse import parse_law, parse_annex, SRC

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
ROOT = os.path.dirname(SITE)
DATA = os.path.join(SITE, "data"); os.makedirs(DATA, exist_ok=True)

ru = parse_law(SRC + "law_ru_matsne_pub36_2026-06-25.txt", "ru")
ka = parse_law(SRC + "law_ka_matsne_pub36_2026-06-25.txt", "ka")
ar = parse_annex(SRC + "annexes_ru_matsne_pub36.txt")
ak = parse_annex(SRC + "annexes_ka_matsne_pub36_2026.txt")
src = json.load(open(os.path.join(ROOT, "tickets", "tickets_ru.json"), encoding="utf-8"))
Q = src["questions"]

# ---------- сопоставление ссылок пояснения с текстом закона ----------
def toks(s): return {w[:5] for w in re.findall(r"[ა-ჰ]+", s or "") if len(w) >= 4}
STOP = toks("საგზაო მოძრაობის შესახებ საქართველოს კანონის მუხლის პუნქტის ქვეპუნქტის ქვეპუნქტების თანახმად დანართის პირველი მეორე ამავე თავის ნიშანი საგზაო")
LAW_T, ANNEX_T = 0.6, 0.45   # пороги совпадения грузинского пояснения с грузинским текстом пункта
ANNEX_NAME = {1: "Приложение 1 (знаки)", 2: "Приложение 2 (разметка)"}

def score(expl, par_ka):
    segs = [toks(s) - STOP for s in expl.split("თანახმად")[1:]] or [toks(expl) - STOP]
    pt = toks(par_ka) - STOP
    a = max(len(s & pt) / max(1, len(s)) for s in segs)
    b = len(pt & (toks(expl) - STOP)) / max(1, len(pt))
    return max(a, b)

def law_ru(art, par):
    a = ru.get(art)
    if not a: return None
    if par is None: return a.get("body")
    return a["paras"].get(str(par))

laws = {}          # key -> {ref, title, text}
stat = collections.Counter()
def add_law(art, par):
    key = f"L{art}.{par}" if par is not None else f"L{art}"
    if key not in laws:
        laws[key] = {"ref": f"ст. {art}" + (f", п. {par}" if par is not None else ""),
                     "title": ru[art]["title"], "text": law_ru(art, par)}
    return key
def add_annex(an, item):
    key = f"A{an}.{item}"
    if key not in laws:
        laws[key] = {"ref": f"{ANNEX_NAME.get(an, 'Приложение %d' % an)}, п. {item}", "title": "", "text": ar[an][item]}
    return key

tickets = []
for x in Q:
    expl = x.get("explanation_ka") or ""
    refs = []
    if expl:
        for r in x["law_refs"]:
            art, par = r["article"], r["paragraph"]
            if par is None or art not in ru or art not in ka: stat["law_skip_noparagraph"] += 1; continue
            if len(ru[art]["order"]) != len(ka[art]["order"]): stat["law_skip_parse_mismatch"] += 1; continue
            pk = ka[art]["paras"].get(str(par)); pr = law_ru(art, par)
            if not pk or not pr: stat["law_skip_missing"] += 1; continue
            if score(expl, pk) >= LAW_T: refs.append(add_law(art, par)); stat["law_ok"] += 1
            else: stat["law_skip_lowmatch"] += 1
        for r in x["annex_refs"]:
            for it in r["items"]:
                an = r["annex"]
                pk = ak.get(an, {}).get(it); pr = ar.get(an, {}).get(it)
                if not pk or not pr: stat["annex_skip_missing"] += 1; continue
                if score(expl, pk) >= ANNEX_T: refs.append(add_annex(an, it)); stat["annex_ok"] += 1
                else: stat["annex_skip_lowmatch"] += 1
    refs = list(dict.fromkeys(refs))
    untr = "ru_text_is_georgian_untranslated" in x["flags"]
    en_untr = bool(re.search(r"[ა-ჰ]", (x.get("en") or {}).get("question", "")))
    t = {"id": x["id"], "t": x["topic_id"],
         "q": {"ru": x["question"], "ka": x["ka"]["question"], "en": x["en"]["question"]},
         "a": {"ru": [a["text"] for a in x["answers"]], "ka": [a["text"] for a in x["ka"]["answers"]],
               "en": [a["text"] for a in x["en"]["answers"]]},
         "c": [a["n"] for a in x["answers"]].index(x["correct"]),
         "img": ("img/" + os.path.basename(x["image"])) if x.get("image") else None,
         "ex": expl or None, "law": refs, "ep": x["episodes"], "src": x["source_url"]}
    nu = [l for l, bad in (("ru", untr), ("en", en_untr)) if bad]
    if nu: t["nu"] = nu
    for l in ("ka", "en"):
        if len(t["a"][l]) != len(t["a"]["ru"]): stat["answer_count_mismatch_" + l] += 1; t["a"][l] = t["a"]["ru"]
    tickets.append(t)
stat["tickets_with_quotes"] = sum(1 for t in tickets if t["law"])

topics = {}
for x in Q: topics[x["topic_id"]] = x["topic_ru"]

# ---------- план серий из structure.md §4 ----------
plan = []
md = open(os.path.join(ROOT, "structure.md"), encoding="utf-8").read()
sec = md.split("## 4.")[1]
for m in re.finditer(r"^\| (E\d{3})(?:–(E\d{3}))? \| (\d+) \| ([^|]+) \| ([^|]+) \|", sec, re.M):
    a, b = int(m.group(1)[1:]), int((m.group(2) or m.group(1))[1:])
    n = b - a + 1
    for i, e in enumerate(range(a, b + 1)):
        plan.append({"e": "E%03d" % e, "block": int(m.group(3)),
                     "title": m.group(4).strip() + (f" ({i+1}/{n})" if n > 1 else ""), "src": m.group(5).strip()})
cnt = collections.Counter(e for t in tickets for e in t["ep"])
for p in plan: p["n"] = cnt.get(p["e"], 0)

# ---------- выпущенные выпуски ----------
eps = json.load(open(os.path.join(HERE, "episodes_src.json"), encoding="utf-8"))
byid = {t["id"]: t for t in tickets}
for ep in eps:
    core = []
    keyset = {(a, str(p)) for a, p in ep.get("ticket_refs", [])}
    for x in Q:
        if any((r["article"], str(r["paragraph"])) in keyset for r in x["law_refs"]): core.append(x["id"])
    linked = [t["id"] for t in tickets if any(e in t["ep"] for e in ep["plan"])]
    ep["tickets_core"] = core
    ep["tickets_linked"] = [i for i in linked if i not in core]
    ep["law_quotes"] = [{"ref": f"ст. {a}" + (f", п. {p}" if p else ""), "title": ru[a]["title"],
                         "text": law_ru(a, p)} for a, p in ep.get("quote_refs", [])]
    ep["law_quotes"] += [{"ref": f"{ANNEX_NAME[an]}, п. {it}", "title": "", "text": ar[an][it]} for an, it in ep.get("annex_quotes", [])]
    for q in ep["law_quotes"]: assert q["text"], q
    ep.pop("ticket_refs", None); ep.pop("quote_refs", None); ep.pop("annex_quotes", None)

meta = {"built_from": "teoria.on.ge (кат. B/B1), выгрузка 20.10.2026; закон: Matsne, ред. 25.06.2026",
        "count": len(tickets), "topics": topics, "stats": stat}
json.dump({"meta": meta, "tickets": tickets, "laws": laws}, open(os.path.join(DATA, "tickets.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump({"plan": plan, "released": eps}, open(os.path.join(DATA, "episodes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

img_dst = os.path.join(SITE, "img"); os.makedirs(img_dst, exist_ok=True)
missing = 0
for t in tickets:
    if t["img"]:
        s = os.path.join(ROOT, "tickets", "images", os.path.basename(t["img"]))
        d = os.path.join(SITE, t["img"])
        if not os.path.exists(s): missing += 1; continue
        if not os.path.exists(d): shutil.copy2(s, d)
print(json.dumps(dict(stat), ensure_ascii=False), "laws:", len(laws), "img missing:", missing, "plan:", len(plan))
for ep in eps: print(ep["id"], "core", ep["tickets_core"], "linked", len(ep["tickets_linked"]))
