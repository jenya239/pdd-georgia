"""Ticket records for the site: verified law quotes for each ticket (pure; input = parsed texts).

A reference from the Georgian explanation is shown as a quote only if the Georgian text of the
cited paragraph / annex item matches the explanation well enough (token overlap score)."""
from __future__ import annotations

import collections
import os
import re

LAW_T, ANNEX_T = 0.6, 0.45   # match thresholds: Georgian explanation vs Georgian text of the item
ANNEX_NAME = {1: "Приложение 1 (знаки)", 2: "Приложение 2 (разметка)"}


def toks(s):
    return {w[:5] for w in re.findall(r"[ა-ჰ]+", s or "") if len(w) >= 4}


STOP = toks("საგზაო მოძრაობის შესახებ საქართველოს კანონის მუხლის პუნქტის ქვეპუნქტის ქვეპუნქტების "
            "თანახმად დანართის პირველი მეორე ამავე თავის ნიშანი საგზაო")


def score(expl, par_ka):
    segs = [toks(s) - STOP for s in expl.split("თანახმად")[1:]] or [toks(expl) - STOP]
    pt = toks(par_ka) - STOP
    a = max(len(s & pt) / max(1, len(s)) for s in segs)
    b = len(pt & (toks(expl) - STOP)) / max(1, len(pt))
    return max(a, b)


class LawIndex:
    """Parsed RU/KA law and annexes + the registry of quotes actually used on the site."""

    def __init__(self, ru, ka, annex_ru, annex_ka):
        self.ru, self.ka, self.ar, self.ak = ru, ka, annex_ru, annex_ka
        self.quotes = {}

    def law_text(self, art, par):
        a = self.ru.get(art)
        if not a:
            return None
        return a.get("body") if par is None else a["paras"].get(str(par))

    def law_quote(self, art, par):
        return {"ref": f"ст. {art}" + (f", п. {par}" if par is not None else ""),
                "title": self.ru[art]["title"], "text": self.law_text(art, par)}

    def annex_quote(self, an, item):
        return {"ref": f"{ANNEX_NAME.get(an, 'Приложение %d' % an)}, п. {item}", "title": "", "text": self.ar[an][item]}

    def add_law(self, art, par):
        key = f"L{art}.{par}" if par is not None else f"L{art}"
        self.quotes.setdefault(key, self.law_quote(art, par))
        return key

    def add_annex(self, an, item):
        key = f"A{an}.{item}"
        self.quotes.setdefault(key, self.annex_quote(an, item))
        return key


def matched_refs(x, idx: LawIndex, stat: collections.Counter) -> list:
    expl = x.get("explanation_ka") or ""
    refs = []
    if not expl:
        return refs
    for r in x["law_refs"]:
        art, par = r["article"], r["paragraph"]
        if par is None or art not in idx.ru or art not in idx.ka:
            stat["law_skip_noparagraph"] += 1; continue
        if len(idx.ru[art]["order"]) != len(idx.ka[art]["order"]):
            stat["law_skip_parse_mismatch"] += 1; continue
        pk = idx.ka[art]["paras"].get(str(par)); pr = idx.law_text(art, par)
        if not pk or not pr:
            stat["law_skip_missing"] += 1; continue
        if score(expl, pk) >= LAW_T:
            refs.append(idx.add_law(art, par)); stat["law_ok"] += 1
        else:
            stat["law_skip_lowmatch"] += 1
    for r in x["annex_refs"]:
        for it in r["items"]:
            an = r["annex"]
            pk = idx.ak.get(an, {}).get(it); pr = idx.ar.get(an, {}).get(it)
            if not pk or not pr:
                stat["annex_skip_missing"] += 1; continue
            if score(expl, pk) >= ANNEX_T:
                refs.append(idx.add_annex(an, it)); stat["annex_ok"] += 1
            else:
                stat["annex_skip_lowmatch"] += 1
    return list(dict.fromkeys(refs))


def ticket_record(x, refs, stat: collections.Counter) -> dict:
    expl = x.get("explanation_ka") or ""
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
    if nu:
        t["nu"] = nu
    for l in ("ka", "en"):
        if len(t["a"][l]) != len(t["a"]["ru"]):
            stat["answer_count_mismatch_" + l] += 1
            t["a"][l] = t["a"]["ru"]
    return t
