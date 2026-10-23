"""Norms of the ontology: every addressable unit of the Law of Georgia on Road Traffic.

Ids reuse the lesson-spec syntax of pdd.assign:
  "37"        article            "37.6"      paragraph
  "37.6.а"    sub-point          "37.6.а.а"  nested sub-point (Russian letters)
  "A1:5.19.1" annex item (annex 1 = signs, 2 = markings)
RU and KA texts are the Matsne consolidated version (pub. 36, 2026-06-25); KA sub-points are matched to RU
by position. EN is the official 2019 translation and is attached to a paragraph only when it plausibly is
the same paragraph (same numbers in the text, similar length) — always labelled with its version.
"""
from __future__ import annotations

import json
import re

from pdd import paths
from pdd.lawparse import parse_law, parse_annex

NORMS_JSON = paths.ONTOLOGY / "generated" / "norms.json"
LAW_VERSION = "matsne pub36 2026-06-25"
EN_VERSION = "2019-06-28"
_SUB = re.compile(r"^((?:[а-яa-zა-ჰ])(?:\.[а-яa-zა-ჰ])?)\)\s")
_EN_NOISE = re.compile(r"^\s*(https?://www\.matsne\.gov\.ge.*|\s*\d+\s*)$")
_EN_ART = re.compile(r"^Article (\d+) – (.*)$")


def split_subpoints(text: str) -> list:
    """[(letters, line)] for lines of a paragraph that start a sub-point: 'а) …', 'а.а) …'."""
    out = []
    for line in (text or "").split("\n")[1:]:
        m = _SUB.match(line)
        if m:
            out.append((m.group(1), line))
    return out


def _art_id(raw: str, prev: int):
    n = int(raw)
    if n in (prev, prev + 1) or (prev == 0 and n == 1) or n > prev + 1 and n < prev + 4:
        return str(n), n
    base = int(raw[:-1]) if len(raw) > 1 else -1
    if base in (prev, prev + 1):
        return raw[:-1] + {"1": "¹", "2": "²", "3": "³", "4": "⁴"}[raw[-1]], base
    return None, prev


def parse_law_en(path) -> dict:
    """{article: {"title", "paras": {num: text}}} of the 2019 English text (hard-wrapped PDF export)."""
    arts, cur, par, prev = {}, None, None, 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if _EN_NOISE.match(line):
            continue
        m = _EN_ART.match(line.strip())
        if m:
            aid, base = _art_id(m.group(1), prev)
            if aid:
                prev = base
                cur = arts[aid] = {"title": m.group(2).strip(), "paras": {}}
                par = None
                continue
        if cur is None:
            continue
        s = line.strip()
        pm = re.match(r"^(\d+)(¹|\d)?\. (.*)$", s)
        if pm and (str(int(pm.group(1))) not in cur["paras"]) and (par is None or int(pm.group(1)) == int(par.rstrip("¹")) + 1):
            par = pm.group(1)
            cur["paras"][par] = pm.group(3)
        elif par and s:
            cur["paras"][par] += ("\n" if re.match(r"^[a-z](\.[a-z])?\)", s) else " ") + s
    for a in arts.values():
        a["paras"] = {k: re.sub(r"[ \t]+", " ", v).strip() for k, v in a["paras"].items()}
    return arts


def _numbers(s: str) -> list:
    return sorted(re.findall(r"\d+", s or ""))


def _en_matches(ru: str, en: str) -> bool:
    return _numbers(ru) == _numbers(en) and 0.6 <= len(en) / max(1, len(ru)) <= 1.7


def generate_norms() -> list:
    ru, ka = parse_law(paths.LAW_RU, "ru"), parse_law(paths.LAW_KA, "ka")
    en = parse_law_en(paths.LAW_EN)
    out = []
    for art, a in ru.items():
        k = ka.get(art, {})
        out.append({"id": art, "kind": "article", "parent": None, "article": art, "title": a["title"],
                    "title_ka": k.get("title"), "version": LAW_VERSION})
        for par in a["order"]:
            text, text_ka = a["paras"][par], k.get("paras", {}).get(par)
            pid = f"{art}.{par}"
            n = {"id": pid, "kind": "law", "parent": art, "article": art, "paragraph": par, "sub": None,
                 "ru": text, "ka": text_ka, "version": LAW_VERSION}
            text_en = en.get(art, {}).get("paras", {}).get(par)
            if text_en and _en_matches(text, text_en):
                n["en"], n["en_version"] = text_en, EN_VERSION
            out.append(n)
            subs_ru, subs_ka = split_subpoints(text), split_subpoints(text_ka)
            same_shape = [s.count(".") for s, _ in subs_ru] == [s.count(".") for s, _ in subs_ka]
            for i, (letters, line) in enumerate(subs_ru):
                sid = f"{pid}.{letters}"
                parent = f"{pid}.{letters.rsplit('.', 1)[0]}" if "." in letters else pid
                out.append({"id": sid, "kind": "law", "parent": parent, "article": art, "paragraph": par,
                            "sub": letters, "ru": line, "ka": subs_ka[i][1] if same_shape else None,
                            "version": LAW_VERSION})
    ar, ak = parse_annex(paths.ANNEX_RU), parse_annex(paths.ANNEX_KA)
    for an in sorted(ar):
        ids = set(ar[an]) | set(ak.get(an, {}))
        for item in sorted(ids, key=lambda s: [int(x) for x in s.split(".")]):
            parts = item.split(".")
            parent = next((f"A{an}:{'.'.join(parts[:i])}" for i in range(len(parts) - 1, 0, -1)
                           if ".".join(parts[:i]) in ids), None)
            n = {"id": f"A{an}:{item}", "kind": "annex", "parent": parent, "annex": an, "item": item,
                 "ru": ar[an].get(item), "ka": ak.get(an, {}).get(item), "version": LAW_VERSION}
            if n["ru"] is None:
                n["ru_missing"] = True   # item exists only in the Georgian text
            out.append(n)
    out += _note_norms(parse_annex_notes(paths.ANNEX_RU), parse_annex_notes(paths.ANNEX_KA))
    return out


_NOTE = re.compile(r"^\s*(Примечани[ея]|შენიშვნა)\s*[.:]\s*(.*)$")
_SECTION = re.compile(r"^\s*(\d)\.\s+[^\d\s]")
_ANNEX_HEAD = re.compile(r"^\s*(?:Приложение|დანართი)\s*№\s*(\d)")
_NOTE_SUB = re.compile(r"^\s*((?:[а-яა-ჰ])(?:\.[а-яა-ჰ])?)\)\s")


def parse_annex_notes(path) -> dict:
    """{annex: [(note_id, [line, (letters, line)…])]} — 'Примечания:' blocks of the annexes, in order.

    note_id is '<section>.прим' (a second note in the same section: '.прим2'); sub-points keep the
    source letters, so KA ones are mapped to RU letters by position."""
    out, annex, section, cur = {}, None, None, None
    for line in path.read_text(encoding="utf-8").replace("\ufeff", "").splitlines():
        h = _ANNEX_HEAD.match(line)
        if h:
            annex, section, cur = int(h.group(1)), None, None
            out.setdefault(annex, [])
            continue
        if annex is None:
            continue
        m = _NOTE.match(line)
        if m and section:
            seen = sum(1 for nid, _ in out[annex] if nid.split(".")[0] == section)
            cur = [f"{section}.прим" + (str(seen + 1) if seen else ""), [line.strip()]]
            out[annex].append(cur)
            continue
        sm = _SECTION.match(line)
        if sm:
            section, cur = sm.group(1), None
            continue
        sub = _NOTE_SUB.match(line)
        if cur is not None and sub:
            cur[1].append((sub.group(1), line.strip()))
        else:
            cur = None
    return out


def _note_norms(ru: dict, ka: dict) -> list:
    out = []
    for an in sorted(ru):
        ka_notes = dict((nid, body) for nid, body in ka.get(an, []))
        for nid, body in ru[an]:
            kbody = ka_notes.get(nid, [])
            gid = f"A{an}:{nid}"
            out.append({"id": gid, "kind": "annex", "parent": None, "annex": an, "item": nid,
                        "ru": body[0], "ka": kbody[0] if kbody else None, "version": LAW_VERSION})
            subs, ksubs = body[1:], kbody[1:]
            same = [l.count(".") for l, _ in subs] == [l.count(".") for l, _ in ksubs]
            for i, (letters, line) in enumerate(subs):
                parent = f"{gid}.{letters.rsplit('.', 1)[0]}" if "." in letters else gid
                out.append({"id": f"{gid}.{letters}", "kind": "annex", "parent": parent, "annex": an,
                            "item": f"{nid}.{letters}", "ru": line, "ka": ksubs[i][1] if same else None,
                            "version": LAW_VERSION})
    return out


def resolve(spec: str, ids) -> list:
    """Norm ids a spec stands for: the norm itself, or (for a group such as 'A1:5.19') the norms under it."""
    if spec in ids:
        return [spec]
    return sorted(i for i in ids if i.startswith(spec + "."))


def dump(norms: list) -> str:
    return json.dumps({"_generated": "python3 tools/build.py (pdd.norms.generate_norms); do not edit",
                       "norms": norms}, ensure_ascii=False, indent=0) + "\n"
