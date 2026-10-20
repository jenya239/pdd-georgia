# -*- coding: utf-8 -*-
"""Парсер текстов закона (RU/KA, Matsne pub36) и приложений: статья -> пункт -> текст."""
import re
SRC = "/workspace/pdd_georgia/sources/"
NOISE = re.compile(r"^\s*(https?://www\.matsne\.gov\.ge.*|\d+\s*$|.*–\s*веб-страница,.*|.*ვებგვერდი,.*|.*Закон Грузии №\d+.*от .*\d{4} года.*|.*საქართველოს \d{4} წლის .*კანონი №.*)$")
MAXART = 64

def art_id(raw):
    """'111' -> '11¹' (поднятые номера в TXT записаны слитно)."""
    n = int(raw)
    if n <= MAXART:
        return str(n)
    s = raw
    return s[:-1] + "¹" if s[-1] == "1" else s[:-1] + {"2": "²", "3": "³", "4": "⁴"}.get(s[-1], s[-1])

def parse_law(path, lang):
    lines = open(path, encoding="utf-8").read().replace("\ufeff", "").splitlines()
    art_re = re.compile(r"^\s*(?:Статья|მუხლი)\s+(\d+)\s*\.\s*(.*)$")
    arts, cur, prev_art = {}, None, 0
    for ln in lines:
        if NOISE.match(ln):
            continue
        m = art_re.match(ln)
        if m:
            raw = m.group(1); n = int(raw)
            base = n if n <= MAXART else int(raw[:-1])
            if base in (prev_art, prev_art + 1) or (prev_art == 0 and base == 1):
                aid = art_id(raw); prev_art = base
                cur = {"title": m.group(2).strip(), "paras": {}, "order": [], "_p": None, "_last": 0, "_t": True}
                arts[aid] = cur
                continue
        if cur is None:
            continue
        s = ln.strip()
        if cur["_t"]:
            if not s:
                cur["_t"] = False
            elif not re.match(r"^\d+\s*\.\s", s):
                cur["title"] += " " + s
                continue
            else:
                cur["_t"] = False
        pm = re.match(r"^(\d+)\s*\.\s+(.*)$", s)
        if pm:
            num = int(pm.group(1)); last = cur["_last"]
            pid = None
            if num == last + 1:
                pid = str(num); cur["_last"] = num
            elif last and pm.group(1).startswith(str(last)) and len(pm.group(1)) == len(str(last)) + 1:
                pid = str(last) + "¹" if pm.group(1)[-1] == "1" else str(last) + "^" + pm.group(1)[-1]
            if pid:
                cur["_p"] = pid; cur["paras"][pid] = pm.group(2); cur["order"].append(pid)
                continue
        if cur["_p"] is None and s and not cur["order"]:
            cur.setdefault("body", "")
            cur["body"] += " " + s
            continue
        if cur["_p"] and s:
            cur["paras"][cur["_p"]] += ("\n" if re.match(r"^([а-яa-z]|[ა-ჰ])(\.[а-яa-zა-ჰ])?\)", s) else " ") + s
    for a in arts.values():
        a.pop("_p"); a.pop("_last"); a.pop("_t")
        if "body" in a:
            a["body"] = re.sub(r"\s+", " ", a["body"]).strip()
        for k, v in a["paras"].items():
            v = re.sub(r"[ \t]+", " ", v).strip()
            a["paras"][k] = v
    return arts

def parse_annex(path):
    """{annex_no: {item: line}} — строки вида '3.27. «…» – …' и диапазоны '1.4.1–1.4.6.'."""
    txt = open(path, encoding="utf-8").read().replace("\ufeff", "")
    out, cur = {}, None
    head = re.compile(r"^\s*(?:Приложение|დანართი)\s*№\s*(\d)")
    item = re.compile(r"^\s*(\d+(?:\.\d+)+)\.?((?:\s*[,–-]\s*\d+(?:\.\d+)+\.?)*)\s*(.*)$")
    for ln in txt.splitlines():
        h = head.match(ln)
        if h:
            cur = int(h.group(1)); out.setdefault(cur, {}); continue
        if cur is None or NOISE.match(ln):
            continue
        m = item.match(ln)
        if m and len(m.group(3)) > 3:
            first = m.group(1)
            nums = [first] + re.findall(r"\d+(?:\.\d+)+", m.group(2))
            text = ln.strip()
            keys = set(nums)
            rng = re.match(r"^\s*[–-]\s*(\d+(?:\.\d+)+)", m.group(2) or "")
            if rng and "." in first:
                a, b = first.rsplit(".", 1), rng.group(1).rsplit(".", 1)
                if a[0] == b[0] and a[1].isdigit() and b[1].isdigit():
                    keys |= {f"{a[0]}.{i}" for i in range(int(a[1]), int(b[1]) + 1)}
            for k in keys:
                out[cur].setdefault(k, text)
    return out

if __name__ == "__main__":
    ru = parse_law(SRC + "law_ru_matsne_pub36_2026-06-25.txt", "ru")
    ka = parse_law(SRC + "law_ka_matsne_pub36_2026-06-25.txt", "ka")
    print(len(ru), len(ka), list(ru)[:20])
    for a in ru:
        if a in ka and len(ru[a]["order"]) != len(ka[a]["order"]):
            print("mismatch", a, len(ru[a]["order"]), len(ka[a]["order"]))
    print(ru["5"]["paras"]["12"]); print(ru["31"]["paras"]["18"]); print(ru["36"]["paras"]["4"][:400])
    an = parse_annex(SRC + "annexes_ru_matsne_pub36.txt"); ak = parse_annex(SRC + "annexes_ka_matsne_pub36_2026.txt")
    print({k: len(v) for k, v in an.items()}, {k: len(v) for k, v in ak.items()})
    print(an[1].get("4.3"), an[1].get("1.4.3"), an[2].get("1.1"))
