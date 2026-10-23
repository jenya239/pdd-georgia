"""Machine translation (ka → ru) of the Georgian-only ticket text: the bank's explanations and the untranslated
eco-driving tickets. Translations are made once by tools/translate_ka.py with a free MT service and cached in
content/translations/explanations_ru.json as {"<ticket id>:<field>": {"h": hash of the Georgian source, "ru": text}};
the build only reads the cache.

Norm references are protected: every linked Georgian citation becomes a placeholder «§N§» before translation and
is restored as a Russian citation («ст. 36, п. 4 «в»», «знак 3.1», «прил. 1, п. 5.14») that the Russian norm linker
understands. Georgian subparagraph letters are not the Russian ones (გ is «в»), so letters come from the resolved norm.
"""
import hashlib
import json
import re

from pdd.paths import TRANSLATIONS_RU

UNTRANSLATED = "ru_text_is_georgian_untranslated"
SP = r"[\s\u00a0]*"
GAP = re.compile(rf"^{SP}(?:,|და|–|−|-|—)?{SP}$")
LAW_TAIL = re.compile(rf"^{SP}(?:ქვე)?პუნქტ\w*")
PAREN = r"\((?:[^()]|\([^()]*\))*\)"           # «(მიმთითებელი ნიშნები)», one level of nesting
ANNEX_HEAD = re.compile(rf"(?:პირველ(?:ი|მა)?|მე-2|მეორე){SP}დანართ\w*{SP}(?:მე-\d+{SP}თავ\w*{SP}(?:{PAREN}{SP})?)?$")
POINT_TAIL = re.compile(rf"^{SP}პუნქტ\w*")
SIGN_TAIL = re.compile(rf"^{SP}(?:საგზაო{SP})?(?:ნიშ|მონიშვნ)\w*")
SIGN_HEAD = re.compile(rf"(?:საგზაო{SP})?(?:ნიშ|მონიშვნ)\w*{SP}$")
KA_LETTER = re.compile(r"[„“\"«][ა-ჰ]")
TOKEN = re.compile(r"§\s*(\d+)\s*§")
# what MT makes of a token: «§2§», «§ 2 §», «статьей 2§», «§2» (a governing word before it duplicates the citation)
TOKEN_MT = re.compile(r"(?:\b(?:стать|пункт|подпункт)[а-яё]*\s+)?(?:§\s*(\d+)\s*§|§\s*(\d+)|(\d+)\s*§)")


def source_hash(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:12]


def _and(xs: list) -> str:
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " и " + xs[-1]


def ru_cite(nids, annex_point: bool = False) -> str:
    """A Russian citation of these norms, in the form pdd.normref.find_ru links."""
    nids = list(dict.fromkeys(nids))
    out, law, annex = [], {}, {}
    for n in nids:
        if n.startswith("A"):
            an, item = n[1:].split(":", 1)
            annex.setdefault(an, []).append(item)
        else:
            art, *rest = n.split(".")
            pars = law.setdefault(art, {})
            if rest:
                subs = pars.setdefault(rest[0], [])
                if rest[1:]:
                    subs.append(".".join(rest[1:]))             # 38.1.в.в → «в.в», as quote_ref writes it
    for art, pars in law.items():
        items = [p + (" " + _and([f"«{s}»" for s in subs]) if subs else "") for p, subs in pars.items()]
        out.append(f"ст. {art}, п. {_and(items)}" if items else f"ст. {art}")
    for an, items in annex.items():
        if annex_point:
            out.append(f"прил. {an}, п. {_and(items)}")
        elif an == "1":
            out.append(("знак " if len(items) == 1 else "знаки ") + _and(items))
        else:
            out.append("разметка " + _and(items))
    return "; ".join(out)


def _groups(text: str, refs) -> list:
    groups = []
    for r in sorted(refs, key=lambda r: r.start):
        g = groups[-1] if groups else None
        if g and g[-1].kind == r.kind and GAP.match(text[g[-1].end:r.start]):
            g.append(r)
        else:
            groups.append([r])
    return groups


def _usable(g) -> bool:
    for r in g:
        if r.status != "linked" or not r.norm:
            return False
        if r.kind == "law" and KA_LETTER.search(r.text) and len(r.norm.split(".")) < 3:
            return False                                    # a Georgian letter we could not map to a subparagraph
    return True


def mask(text: str, refs) -> tuple:
    """(text with «§N§» placeholders, Russian citations N = 1..)."""
    spans = []
    for g in _groups(text, refs):
        if not _usable(g):
            continue
        a, b, point = g[0].start, g[-1].end, False
        if g[0].kind == "law":
            m = LAW_TAIL.match(text[b:])
            b += m.end() if m else 0
        else:
            head = ANNEX_HEAD.search(text[:a])
            point = bool(head) or "დანართ" in text[a:b]
            if head:
                a = head.start()
            m = (POINT_TAIL if point else SIGN_TAIL).match(text[b:])
            b += m.end() if m else 0
            noun = None if point else SIGN_HEAD.search(text[:a])
            if noun and not m:                          # «საგზაო ნიშანი 4.3 „…“» → «знак 4.3 «…»»
                a = noun.start()
        spans.append((a, b, ru_cite([r.norm for r in g], point)))
    out, pos, labels = "", 0, []
    for a, b, label in spans:
        labels.append(label)
        out += text[pos:a] + f"§{len(labels)}§"
        pos = b
    return out + text[pos:], labels


def unmask(text: str, labels: list) -> str:
    num = lambda m: int(next(g for g in m.groups() if g))
    found = [num(m) for m in TOKEN_MT.finditer(text)]
    if sorted(found) != list(range(1, len(labels) + 1)):
        raise ValueError(f"placeholders {found} do not match {len(labels)} citations")
    return TOKEN_MT.sub(lambda m: labels[num(m) - 1], text)


def jobs(questions: list) -> dict:
    """Georgian-only source strings: {"<id>:ex" | "<id>:q" | "<id>:a<i>": Georgian text}."""
    out = {}
    for x in questions:
        if x.get("explanation_ka"):
            out[f"{x['id']}:ex"] = x["explanation_ka"]
        if UNTRANSLATED in x["flags"]:
            out[f"{x['id']}:q"] = x["ka"]["question"]
            for i, a in enumerate(x["ka"]["answers"]):
                out[f"{x['id']}:a{i}"] = a["text"]
    return out


def fill(jobs: dict, cache: dict, translate) -> dict:
    """Cache entries for all jobs; translate(key, source) is called only for sources not translated yet.
    It returns the Russian text or an entry {"ru": ..., other fields} (e.g. "masked": False)."""
    memo = {e["h"]: e for e in cache.values()}
    out = {}
    for key, src in jobs.items():
        h = source_hash(src)
        if cache.get(key, {}).get("h") == h:
            out[key] = cache[key]
            continue
        if h not in memo:
            r = translate(key, src)
            memo[h] = {"h": h, **(r if isinstance(r, dict) else {"ru": r})}
        out[key] = memo[h]
    return out


def clean(text: str) -> str:
    """Typesetting debris of the bank text that makes MT drop words: «სატრა¬ნსპორტო» hyphens, broken characters.
    «��მავე» (tickets 506, 509) is read as «. ამავე» («the same …») — наш вывод from the context."""
    text = re.sub("\ufffd+მავე", ". ამავე", text.replace("\u00ac", ""))
    return " ".join(re.sub("\ufffd+", " ", text).split())


def sentences(text: str) -> list:
    """Split at sentence ends so a long text can go one sentence per line (MT then keeps every sentence)."""
    return [x for x in re.split(r"(?<=[.;:])\s+(?=\S)", text.strip()) if x]


def cache_errors(jobs: dict, cache: dict) -> list:
    err = []
    for key, src in jobs.items():
        e = cache.get(key)
        if not e:
            err.append(f"{key}: no machine translation (run tools/translate_ka.py)")
        elif e["h"] != source_hash(src):
            err.append(f"{key}: machine translation is stale (run tools/translate_ka.py)")
        elif not e["ru"].strip() or TOKEN.search(e["ru"]):
            err.append(f"{key}: empty translation or an unrestored placeholder")
    return err


def load_cache(path=TRANSLATIONS_RU) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))["items"] if path.exists() else {}


def save_cache(items: dict, engine: str, path=TRANSLATIONS_RU) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = {"engine": engine, "note": "machine translation ka→ru, made by tools/translate_ka.py; key = ticket id:field, h = hash of the Georgian source",
           "items": dict(sorted(items.items(), key=lambda kv: (int(kv[0].split(":")[0]), kv[0])))}
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
