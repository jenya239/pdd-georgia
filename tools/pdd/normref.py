"""Find references to norms in Russian and Georgian text and resolve them to ontology ids.

Pure functions, no I/O. Resolution is conservative: a reference is linked only when its target is
certain. Otherwise it gets a status and stays plain text:
  'ambiguous'  — the article is not named and the context does not pin it down;
  'missing'    — the cited norm does not exist in the law (e.g. «разметка 1.14.3»), or names a group (знак 5.19);
  'external'   — another act (Кодекс…, Закон Грузии «…»);
  'unverified' — (Georgian) resolved, but the bank's own citation list for the ticket does not confirm it.

RU forms: «ст. 5, п. 13», «статья 37 пункт 6 «а.а»», «ст. 43, пп. 3, 4», «пунктом 3 статьи 25»,
«подпункт «а» пункта 3 настоящей статьи», «п. 9 «д»» (article from context), «знак 5.26», «знаками 5.23–5.26»,
«разметка 1.14.1», «прил. 1, п. 5.25», «прил. 1, примечание «а» к разделу 1», raised numbers «11¹».
KA forms: «36-ე მუხლის მე-4 პუნქტის „გ“ ქვეპუნქტის», «ამავე მუხლის პირველი პუნქტის», «32-ე მუხლით»,
«3.16, 3.20, 3.26–3.30 ნიშნების», «1.14.1 საგზაო მონიშვნ…», «პირველი დანართის … 5.25 „…“»."""
import re
from dataclasses import dataclass, field
from typing import Optional

from pdd.assign import KA_TO_RU

SP = r"[\s\u00a0]*"
SUPS = "¹²³⁴"
NUM = rf"\d{{1,3}}[{SUPS}]?"
_UNITS = r"(?:км|м\b|метр|см|мм|кг|т\b|тонн|%|°|мест|лет|год|сек|секунд|мин|час|кВт|чел|раз|колёс|колес|руб|лари|GEL)"
PNUM = rf"{NUM}(?![\d{SUPS}]|[.,]\d|{SP}{_UNITS}|{SP}[–—-]{SP}\d+{SP}{_UNITS})"
SETTLEMENT = re.compile(r"(?:населе|населё|ненаселе)нн\w*[\s\u00a0]*$")   # «населённого пункта 150–300 м»
LETTER = r"[а-яё](?:\.[а-яё])?"
SUB = rf"«{LETTER}»"
SUBS = rf"{SUB}(?:{SP}(?:,|и|или){SP}{SUB})*"
LSEP = rf"{SP}(?:,|и|или|–|—|-){SP}"
PITEM = rf"{PNUM}(?:{SP}{SUBS})?"
PLIST = rf"{PITEM}(?:{LSEP}{PITEM})*"
DNUM = r"\d{1,2}(?:\.\d{1,2}){1,2}(?![.\d])"
DLIST = rf"{DNUM}(?:{LSEP}{DNUM})*"
NOT_WORD = r"(?<![А-Яа-яЁёA-Za-z])"

ART_KW = r"(?:[Сс]т\.|[Сс]тать(?:я|и|ю|ей|е|ёй|ях|ям|ями)|[Сс]татей)"
PAR_KW = r"(?:[Пп]п?\.|[Пп]ункт(?:а|у|ом|е|ы|ов|ам|ами|ах)?)"
SUB_KW = r"(?:[Пп]одпункт(?:а|у|ом|е|ы|ов|ам|ами|ах)?|[Пп]одп\.)"
THIS_ART = r"(?:настоящей|этой|той же) статьи"

RE_ART_FIRST = re.compile(
    rf"{NOT_WORD}(?P<akw>{ART_KW}){SP}(?P<anum>{NUM})(?![\d.{SUPS}])"
    rf"(?:{SP},?{SP}(?:(?P<pkw>{PAR_KW}){SP}(?P<plist>{PLIST})))?")
RE_PAR_FIRST = re.compile(
    rf"{NOT_WORD}(?:(?P<skw>{SUB_KW}){SP}(?P<slist>{SUBS}){SP},?{SP})?(?P<pkw>{PAR_KW}){SP}(?P<plist>{PLIST})"
    rf"(?:{SP},?{SP}(?:(?P<akw>{ART_KW}){SP}(?P<anum>{NUM})(?![\d.{SUPS}])|(?P<this>{THIS_ART})))?")
RE_SIGN = re.compile(rf"{NOT_WORD}(?P<kw>[Зз]нак(?:а|у|ом|е|и|ов|ам|ами|ах)?)(?:{SP}«[^»]{{1,60}}»)?{SP}(?P<list>{DLIST})")
RE_MARK = re.compile(rf"{NOT_WORD}(?P<kw>[Рр]азметк(?:а|и|у|ой|е|ам|ами|ах)|[Рр]азметок)(?:{SP}«[^»]{{1,60}}»)?{SP}(?P<list>{DLIST})")
RE_ANNEX = re.compile(
    rf"{NOT_WORD}(?P<kw>[Пп]рил(?:\.|ожени(?:е|я|и|ю|ем))){SP}(?:№{SP})?(?P<an>[12])(?!\d)"
    rf"(?:{SP},?{SP}(?:{PAR_KW}{SP}(?P<list>{DLIST})|[Пп]римечани\w*{SP}(?P<nsub>«{LETTER}»)?{SP}(?:к|в){SP}(?:раздел\w*|глав\w*){SP}(?P<sec>\d{{1,2}})))")
RE_BARE_DOTTED = re.compile(rf"{NOT_WORD}{PAR_KW}{SP}(?P<list>{DLIST})")
RE_EXTERNAL = re.compile(r"^[\s\u00a0,]*(?:\S+\s+){0,2}?(?:Кодекс\w*|[Зз]акона Грузии(?![\s\u00a0]*«О дорожном движении»)|Конституц\w*|[Пп]остановлени\w*|[Пп]риказ\w*|Конвенц\w*)")

_SUP_ID = {"¹": ["¹", "^1"], "²": ["^2", "²"], "³": ["^3", "³"], "⁴": ["^4", "⁴"]}


@dataclass
class Ref:
    start: int
    end: int
    text: str
    kind: str                      # law | annex
    art: Optional[str] = None      # law: article as written ('11¹'); None → from context
    par: Optional[str] = None
    sub: Optional[str] = None
    annex: Optional[str] = None
    item: Optional[str] = None
    this_article: bool = False     # «настоящей статьи»
    status: str = "pending"
    norm: Optional[str] = None
    extra: dict = field(default_factory=dict)


def _sub_letters(s: str) -> list:
    return [(m.start(), m.end(), m.group(1)) for m in re.finditer(rf"«({LETTER})»", s)]


def _plist_items(s: str, offset: int) -> list:
    """[(start, end, number, [ (s, e, letter) ... ])] for a paragraph list."""
    out = []
    for m in re.finditer(rf"(?P<n>{PNUM})(?:{SP}(?P<subs>{SUBS}))?", s):
        subs = [(offset + m.start("subs") + a, offset + m.start("subs") + b, l)
                for a, b, l in _sub_letters(m.group("subs"))] if m.group("subs") else []
        out.append((offset + m.start(), offset + m.end(), m.group("n"), subs))
    return out


def _law_refs(text: str, m, first_start: int, art, this_art, tail_end=None, lead_subs=None) -> list:
    """One Ref per paragraph number (and per sub-point letter). The first span starts at the keyword."""
    refs = []
    items = _plist_items(m.group("plist"), m.start("plist"))
    for k, (s, e, num, subs) in enumerate(items):
        start = first_start if k == 0 else s
        if lead_subs:                                  # «подпунктами «а» и «б» пункта 3»
            for j, (a, b, l) in enumerate(lead_subs):
                refs.append(Ref(first_start if j == 0 else a, b, "", "law", art, num, l, this_article=this_art))
            continue
        if not subs:
            refs.append(Ref(start, e, "", "law", art, num, None, this_article=this_art))
            continue
        for j, (a, b, l) in enumerate(subs):
            refs.append(Ref(start if j == 0 else a, b, "", "law", art, num, l, this_article=this_art))
    if tail_end and len(refs) == 1:
        refs[0].end = tail_end
    for r in refs:
        r.text = text[r.start:r.end]
        r.extra["grp"] = m.start()
    return refs


def find_ru(text: str) -> list:
    """All norm references in a Russian text, unresolved (see resolve_ru). Non-overlapping, in order."""
    cands = []
    for m in RE_ART_FIRST.finditer(text):
        art = m.group("anum")
        if m.group("plist"):
            refs = _law_refs(text, m, m.start(), art, False)
        else:
            refs = [Ref(m.start(), m.end(), m.group(0), "law", art)]
        cands.append((m.start(), m.end(), refs))
    for m in RE_PAR_FIRST.finditer(text):
        if SETTLEMENT.search(text[max(0, m.start() - 20):m.start()]):
            continue
        art = m.group("anum")
        lead = None
        if m.group("slist"):
            lead = [(a + m.start("slist"), b + m.start("slist"), l) for a, b, l in _sub_letters(m.group("slist"))]
        refs = _law_refs(text, m, m.start(), art, bool(m.group("this")), tail_end=m.end(), lead_subs=lead)
        cands.append((m.start(), m.end(), refs))
    for rx, annex in ((RE_SIGN, "1"), (RE_MARK, "2")):
        for m in rx.finditer(text):
            refs = []
            for k, d in enumerate(re.finditer(DNUM, m.group("list"))):
                s, e = m.start("list") + d.start(), m.start("list") + d.end()
                refs.append(Ref(m.start() if k == 0 else s, e, "", "annex", annex=annex, item=d.group(0)))
            for r in refs:
                r.text = text[r.start:r.end]
            cands.append((m.start(), m.end(), refs))
    for m in RE_ANNEX.finditer(text):
        an = m.group("an")
        refs = []
        if m.group("list"):
            for k, d in enumerate(re.finditer(DNUM, m.group("list"))):
                s, e = m.start("list") + d.start(), m.start("list") + d.end()
                refs.append(Ref(m.start() if k == 0 else s, e, "", "annex", annex=an, item=d.group(0)))
        else:
            letters = m.group("nsub")[1:-1] if m.group("nsub") else ""
            refs.append(Ref(m.start(), m.end(), "", "annex", annex=an, item=f"{m.group('sec')}.прим",
                            extra={"note_letters": letters}))
        for r in refs:
            r.text = text[r.start:r.end]
        cands.append((m.start(), m.end(), refs))
    for m in RE_BARE_DOTTED.finditer(text):
        cands.append((m.start(), m.end(), [Ref(m.start(), m.end(), m.group(0), "annex", status="ambiguous",
                                                 extra={"why": "dotted number without annex"})]))
    # earliest start wins, then the longest match
    cands.sort(key=lambda c: (c[0], -(c[1] - c[0])))
    out, last = [], -1
    for s, e, refs in cands:
        if s < last:
            continue
        last = e
        if RE_EXTERNAL.match(text[e:e + 60]):
            for r in refs:
                r.status = "external"
        out.extend(refs)
    return out


def _par_ids(par: str) -> list:
    for k, alts in _SUP_ID.items():
        if par.endswith(k):
            return [par[:-1] + a for a in alts]
    return [par]


def law_id(art: str, par: Optional[str], sub: Optional[str], ids) -> Optional[str]:
    if par is None:
        return art if art in ids else None
    for p in _par_ids(par):
        nid = f"{art}.{p}" + (f".{sub}" if sub else "")
        if nid in ids:
            return nid
    return None


def explicit_cites(refs) -> list:
    """(article, paragraph) pairs a text names explicitly — the context for bare «п. N»."""
    return [(r.art, r.par) for r in refs if r.kind == "law" and r.art and r.status == "pending"]


def context_article(par: str, scopes) -> tuple:
    """Article for a bare paragraph number. scopes: innermost first, each a list of explicit (article, paragraph).
    The innermost scope in which this very paragraph is cited with an article decides; two articles there →
    ambiguous. «The only article nearby» is not enough: «(ст. 24, п. 12) … в п. 87» means ст. 5. Returns (article|None, reason)."""
    for cites in scopes:
        same = {a for a, p in cites if p == par}
        if len(same) == 1:
            return next(iter(same)), "same paragraph cited"
        if len(same) > 1:
            return None, "paragraph cited under several articles"
    return None, "paragraph never cited with an article"


def resolve_ru(refs, ids, scopes=(), own_article: Optional[str] = None) -> list:
    """Fill status/norm. scopes: context for bare paragraphs (see context_article); own_article: the article
    a law text belongs to (for «настоящей статьи» and bare «пункт N» inside the law itself).
    A list («пп. 43, 44, 53») without an article is linked only if every item resolves to the same article."""
    arts = {}
    for k, r in enumerate(refs):
        if r.status != "pending":
            continue
        if r.kind == "annex":
            _resolve_annex(r, ids)
            continue
        art = r.art if r.art is not None else _bare_article(r, scopes, own_article, ids)
        if art is not None:
            arts[k] = art
    groups = {}
    for k, r in enumerate(refs):
        if r.kind == "law" and r.art is None and "grp" in r.extra and r.status == "pending":
            groups.setdefault(r.extra["grp"], []).append(k)
    for ks in groups.values():
        if len({arts.get(k) for k in ks}) > 1:
            for k in ks:
                arts.pop(k, None)
                refs[k].status, refs[k].extra["why"] = "ambiguous", "list items point to different articles"
    for k, r in enumerate(refs):
        if r.status != "pending":
            continue
        if k not in arts:
            r.status = "ambiguous"
            continue
        nid = law_id(arts[k], r.par, r.sub, ids)
        r.status, r.norm = ("linked", nid) if nid else ("missing", None)
    return refs


def _resolve_annex(r: Ref, ids) -> None:
    if ".прим" in r.item:
        sec = r.item.split(".")[0]
        letters = r.extra.get("note_letters", "")
        pat = re.compile(rf"^A{r.annex}:{sec}\.прим\d*" + (rf"\.{re.escape(letters)}$" if letters else "$"))
        cands = sorted(i for i in ids if pat.match(i))
        if len(cands) == 1:
            r.status, r.norm = "linked", cands[0]
        else:
            r.status = "ambiguous" if cands else "missing"
        return
    nid = f"A{r.annex}:{r.item}"
    r.status, r.norm = ("linked", nid) if nid in ids else ("missing", None)


def _bare_article(r: Ref, scopes, own_article, ids=frozenset()) -> Optional[str]:
    """The article of a «пункт N» written without one, or None (reason in r.extra['why'])."""
    others = {a for a, _ in scopes[0]} - {own_article} if scopes else set()
    if own_article is not None:
        if r.this_article or not others:
            return own_article                    # a law text's bare «пункт N» — unless it also names other articles
        r.extra["why"] = "bare paragraph in a text that names another article"
        return None
    if r.this_article:                            # «настоящей статьи» in a quote: the quote's only article
        arts = {a for a, _ in scopes[0]} if scopes else set()
        if len(arts) == 1:
            return next(iter(arts))
        r.extra["why"] = "«настоящей статьи» outside a single-article block"
        return None
    art, why = context_article(r.par, scopes)
    if art is not None:
        rivals = {a for cites in scopes for a, _ in cites if a != art and law_id(a, r.par, r.sub, ids)}
        if rivals:                                # «Автобус … (п. 1)» next to «ст. 43, п. 1» — ст. 5 has a п. 1 too
            art, why = None, "the paragraph exists in another article cited nearby"
    if art is None:
        r.extra["why"] = why
    return art


# ---------------- Georgian ----------------
KNUM = r"(?:(?P<{0}a>\d+)-ე|მე-(?P<{0}b>\d+)(?:-ე)?|(?P<{0}c>პირველ(?:ი|მა)?)|(?P<{0}d>მეორე))"
_KN = r"(?:\d+-ე|მე-\d+(?:-ე)?|პირველ(?:ი|მა)?|მეორე)"
KSEP = r"[\s\u00a0]*(?:,|და|–|−|-|—)[\s\u00a0]*"
KQ = r"[„“\"«]"
KQE = r"[“”\"»]"
KLET = r"[ა-ჰ](?:\.[ა-ჰ])?"
RE_KA_LAW = re.compile(
    rf"(?P<art>(?:(?P<this>ამ(?:ავე)?)|(?P<anum>{_KN}))[\s\u00a0]+მუხლ(?:ის|ით|ითა|ში|ზე|ი)?)(?![ა-ჰ])"
    rf"(?:[\s\u00a0]+(?P<plist>{_KN}(?:{KSEP}{_KN})*)[\s\u00a0]+პუნქტ[ა-ჰ]*"
    rf"(?:[\s\u00a0]+(?P<slist>{KQ}{KLET}{KQE}(?:{KSEP}{KQ}{KLET}{KQE})*)[\s\u00a0]+ქვეპუნქტ[ა-ჰ]*)?)?")
RE_KA_DOTTED = re.compile(rf"(?<![\d.])(?P<list>{DNUM}(?:{KSEP}{DNUM})*)(?P<after>[\s\u00a0]*(?:საგზაო[\s\u00a0]+)?(?:ნიშ|მონიშვნ|{KQ}))?")
RE_KA_ANNEX = re.compile(r"(პირველ(?:ი|მა)?|მე-2|მეორე)[\s\u00a0]+დანართ")
RE_KA_EXTERNAL_BEFORE = re.compile(r"(?:კოდექსის|კონსტიტუციის|კონვენციის|დადგენილების|ბრძანების)[\s\u00a0]*$")


def ka_number(tok: str) -> Optional[int]:
    tok = tok.strip()
    if tok.startswith("პირველ"):
        return 1
    if tok == "მეორე":
        return 2
    m = re.search(r"\d+", tok)
    return int(m.group(0)) if m else None


def _ka_numbers(s: str, offset: int) -> list:
    return [(offset + m.start(), offset + m.end(), ka_number(m.group(0))) for m in re.finditer(_KN, s)]


def find_ka(text: str) -> list:
    """Norm references in a Georgian ticket explanation, before resolution (see resolve_ka)."""
    refs = []
    last_art = None
    for m in RE_KA_LAW.finditer(text):
        if m.group("this"):
            art, this = last_art, True
        else:
            art, this = str(ka_number(m.group("anum"))), False
            if RE_KA_EXTERNAL_BEFORE.search(text[max(0, m.start() - 40):m.start()]):
                refs.append(Ref(m.start(), m.end(), m.group(0), "law", art, status="external"))
                continue
            last_art = art
        if not m.group("plist"):
            refs.append(Ref(m.start(), m.end(), m.group(0), "law", art, this_article=this))
            if art is None:
                refs[-1].status = "ambiguous"
            continue
        pars = _ka_numbers(m.group("plist"), m.start("plist"))
        letters = [(m.start("slist") + x.start(1), m.start("slist") + x.end(1), x.group(1))
                   for x in re.finditer(rf"{KQ}({KLET}){KQE}", m.group("slist") or "")]
        if letters and len(pars) == 1:
            for j, (a, b, l) in enumerate(letters):
                refs.append(Ref(m.start() if j == 0 else a - 1, m.end() if len(letters) == 1 else b + 1, "", "law",
                                art, str(pars[0][2]), None, this_article=this, extra={"ka_sub": l}))
        else:
            for k, (a, b, n) in enumerate(pars):
                end = m.end() if len(pars) == 1 else b
                refs.append(Ref(m.start() if k == 0 else a, end, "", "law", art, str(n), None, this_article=this))
        for r in refs:
            if r.art is None and r.status == "pending":
                r.status = "ambiguous"
    taken = [(r.start, r.end) for r in refs]
    for m in RE_KA_DOTTED.finditer(text):
        if any(a < m.end() and m.start() < b for a, b in taken):
            continue
        after = (m.group("after") or "").strip()
        if "მონიშვნ" in after:
            annex = "2"
        elif "ნიშ" in after:
            annex = "1"
        else:
            prev = list(RE_KA_ANNEX.finditer(text[:m.start()]))
            annex = None if not prev else ("1" if prev[-1].group(1).startswith("პირველ") else "2")
        for d in re.finditer(DNUM, m.group("list")):
            s, e = m.start("list") + d.start(), m.start("list") + d.end()
            r = Ref(s, e, d.group(0), "annex", annex=annex, item=d.group(0), extra={"explicit": "ნიშ" in after or "მონიშვნ" in after})
            if annex is None:
                r.status = "ambiguous"
            refs.append(r)
    refs.sort(key=lambda r: r.start)
    for r in refs:
        if not r.text:
            r.text = text[r.start:r.end]
    return refs


def resolve_ka(refs, ids, ka_text: dict, confirmed, strict: bool = False) -> list:
    """Resolve Georgian refs. ka_text: norm id → Georgian text (to read sub-point letters exactly as the law
    numbers them). confirmed: ids the ticket's own bank citation list stands for.
    Explicit references (a numbered article; a dotted number followed by ნიშანი/მონიშვნა) are linked when the norm
    exists. Implicit ones («ამ მუხლის …», a dotted number whose annex is taken from an earlier «დანართი») — and every
    reference when strict (the bank's own list could not be fully resolved) — only when `confirmed` agrees."""
    confirmed = set(confirmed)
    for r in refs:
        if r.status != "pending":
            continue
        explicit = not strict and (r.extra.get("explicit", False) if r.kind == "annex" else not r.this_article)
        if r.kind == "annex":
            nid = f"A{r.annex}:{r.item}"
            if nid not in ids:
                r.status = "missing"
            elif explicit or _confirmed(nid, confirmed):
                r.status, r.norm = "linked", nid
            else:
                r.status = "unverified"
            continue
        par_id = law_id(r.art, r.par, None, ids) if r.par else law_id(r.art, None, None, ids)
        if par_id is None:
            r.status = "missing"
            continue
        nid = par_id
        if "ka_sub" in r.extra:
            sub = _ka_sub(par_id, r.extra["ka_sub"], ids, ka_text)
            if sub:
                nid = sub
        ok = explicit or _confirmed(nid, confirmed)
        if nid != par_id and not ok and _confirmed(par_id, confirmed):   # the bank confirms only the paragraph
            nid, ok = par_id, True
        r.status, r.norm = ("linked", nid) if ok else ("unverified", None)
    return refs


def _confirmed(nid: str, confirmed) -> bool:
    """The bank cites this norm, a part of it, or a norm it belongs to."""
    return any(nid == c or c.startswith(nid + ".") or nid.startswith(c + ".") for c in confirmed)


def _ka_sub(par_id: str, ka_letter: str, ids, ka_text: dict) -> Optional[str]:
    """Sub-point of a paragraph whose Georgian text starts with «გ)»; else the positional letter if that exists."""
    hits = [i for i in ids if i.startswith(par_id + ".") and (ka_text.get(i) or "").lstrip().startswith(ka_letter + ")")]
    if len(hits) == 1:
        return hits[0]
    ru = ".".join(KA_TO_RU.get(x, "?") for x in ka_letter.split("."))
    nid = f"{par_id}.{ru}"
    return nid if nid in ids and not hits else None
