"""Ticket -> primary lesson assignment. Pure functions, no I/O.

Rule (documented in README):
  * The *primary rule* of a ticket is its first law reference (article, paragraph and,
    when the Georgian explanation names it, the sub-point); tickets without law
    references fall back to their first annex item (sign / marking).
  * A lesson declares what it teaches as specs: "5.86", "37.6.а.а", "A1:5.19.1".
  * The ticket's lesson is the earliest released lesson (by number) whose specs cover
    the primary rule. Explicit "include"/"exclude" ticket ids of a lesson override it
    (used only after checking the ticket against the lesson text).
  * Otherwise the ticket stays unassigned (its topic is not taught yet).
"""
from __future__ import annotations

import re
from typing import NamedTuple, Optional

KA_LETTERS = "აბგდევზთიკლმნოპჟრსტუფ"
RU_LETTERS = "абвгдежзиклмнопрстуф"
KA_TO_RU = dict(zip(KA_LETTERS, RU_LETTERS))
ANNEX_KIND = {"1": "знак", "2": "разметка"}

_CITATION = re.compile(r"(\S+)\s+მუხლის\s+(\S+)\s+პუნქტის\s+[„“\"]([^„“”\"]+)[“”\"]\s+ქვეპუნქტ")


class Ref(NamedTuple):
    kind: str           # "law" | "annex"
    major: str          # article number or annex number
    minor: object       # paragraph (int) or annex item (str)
    sub: Optional[str]  # sub-point in Russian letters, e.g. "а.а"


def parse_spec(spec: str) -> Ref:
    if spec.startswith("A"):
        annex, item = spec[1:].split(":", 1)
        return Ref("annex", annex, item, None)
    parts = spec.split(".", 2)
    return Ref("law", parts[0], int(parts[1]), parts[2] if len(parts) > 2 else None)


def _number(token: str) -> Optional[int]:
    if token.startswith("პირველ"):
        return 1
    m = re.search(r"\d+", token)
    return int(m.group()) if m else None


def subpoint_for(explanation_ka: Optional[str], article: str, paragraph: int) -> Optional[str]:
    """Sub-point cited for article/paragraph in the explanation, in Russian letters."""
    for m in _CITATION.finditer(explanation_ka or ""):
        if _number(m.group(1)) == int(article) and _number(m.group(2)) == paragraph:
            letters = m.group(3).split(".")
            if all(len(x) == 1 and x in KA_TO_RU for x in letters):
                return ".".join(KA_TO_RU[x] for x in letters)
            return None
    return None


def primary_ref(ticket: dict) -> Optional[Ref]:
    laws = ticket.get("law_refs") or []
    if laws:
        art, par = str(laws[0]["article"]), laws[0]["paragraph"]
        if par is None:
            return Ref("law", art, None, None)
        par = int(par)
        return Ref("law", art, par, subpoint_for(ticket.get("explanation_ka"), art, par))
    for a in ticket.get("annex_refs") or []:
        if a.get("items"):
            return Ref("annex", str(a["annex"]), a["items"][0], None)
    return None


def _nested(spec: str, value: Optional[str]) -> bool:
    return value is not None and (value == spec or value.startswith(spec + "."))


def covers(spec: Ref, ref: Ref) -> bool:
    if spec.kind != ref.kind or spec.major != ref.major:
        return False
    if spec.kind == "annex":
        return _nested(spec.minor, ref.minor)
    if spec.minor != ref.minor:
        return False
    return spec.sub is None or _nested(spec.sub, ref.sub)


def assign_lessons(tickets: list, lessons: list) -> dict:
    ordered = sorted(lessons, key=lambda l: l["num"])
    specs = [(l, [parse_spec(s) for s in l.get("teaches", [])]) for l in ordered]
    out = {}
    for t in tickets:
        tid = t["id"]
        explicit = [l["id"] for l in ordered if tid in l.get("include", [])]
        if explicit:
            out[tid] = explicit[0]
            continue
        ref = primary_ref(t)
        if ref is None:
            continue
        for lesson, lesson_specs in specs:
            if tid in lesson.get("exclude", []):
                continue
            if any(covers(s, ref) for s in lesson_specs):
                out[tid] = lesson["id"]
                break
    return out


def rule_key(ref: Ref) -> str:
    return f"A{ref.major}:{ref.minor}" if ref.kind == "annex" else f"{ref.major}.{ref.minor}"


def rule_label(ref: Ref) -> str:
    if ref.kind == "annex":
        return f"прил. {ref.major}, {ANNEX_KIND.get(ref.major, 'пункт')} {ref.minor}"
    return f"ст. {ref.major}, п. {ref.minor}" + (f" «{ref.sub}»" if ref.sub else "")


def pitfall_for(ref: Optional[Ref], pitfalls: dict) -> Optional[str]:
    """Lesson-grounded 'why people get it wrong' note for a rule; most specific spec wins."""
    if ref is None:
        return None
    hits = [(spec, text) for spec, text in pitfalls.items() if covers(parse_spec(spec), ref)]
    return max(hits, key=lambda h: len(h[0]))[1] if hits else None
