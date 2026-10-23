"""Written breakdowns («Разбор») of selected bank tickets: content/breakdowns/<ticket id>.json.

    {"ticket": 884,
     "steps": [2–3 strings: question → norm → answer],
     "quotes": [{"norm": "5.9", "text": verbatim RU law text}, …],
     "why_not": {"<wrong option index>": {"text": one line, "mc": misconception id | null}, …},
     "trap": optional string, "concepts": [concept ids]}

Nothing here may state a rule of its own: quotes are verified against the law, every «ст. N, п. M» in the
text must resolve to a norm, typical errors must be the ones the ontology maps to that option, and our own
inferences are marked «наш вывод» in the text.
"""
import json

from pdd import normref
from pdd.checkitems import quote_errors, quote_ref
from pdd.paths import BREAKDOWNS

REQUIRED = ("ticket", "steps", "quotes", "why_not", "concepts")
WORDS = (60, 170)              # ~80–150 words of our own text (quotes not counted)


def load(root=BREAKDOWNS) -> list:
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(root.glob("*.json"), key=lambda p: int(p.stem))]


def texts(b: dict) -> list:
    """Our own prose of a breakdown (everything except the law quotes)."""
    return [*b.get("steps", []), *[w.get("text", "") for w in b.get("why_not", {}).values()], b.get("trap") or ""]


def _scope(b: dict) -> list:
    """Quoted norms as citation context for bare «п. N»."""
    out = []
    for q in b.get("quotes", []):
        parts = str(q.get("norm", "")).split(".")
        if not parts[0].startswith("A"):
            out.append((parts[0], parts[1] if len(parts) > 1 else None))
    return out


def ref_errors(text: str, ids, scope=()) -> list:
    refs = normref.find_ru(text)
    normref.resolve_ru(refs, ids, [normref.explicit_cites(refs), list(scope)])
    return [f"norm reference {r.text!r} does not resolve ({r.status})" for r in refs if r.status not in ("linked", "external")]


def validate(items: list, world) -> list:
    err, seen = [], set()
    assigned = world.derive_assignment()["assigned"]
    onto = world.doc["tickets"]
    for b in items:
        key = f"breakdown {b.get('ticket', '?')}"
        missing = [f for f in REQUIRED if f not in b]
        if missing:
            err.append(f"{key}: missing {missing}")
            continue
        tid = b["ticket"]
        if tid in seen:
            err.append(f"{key}: duplicate")
        seen.add(tid)
        q, lesson = world.questions.get(tid), assigned.get(tid)
        if not q or not lesson:
            err.append(f"{key}: not a ticket assigned to a lesson")
            continue
        if not 2 <= len(b["steps"]) <= 3 or not all(isinstance(s, str) and s.strip() for s in b["steps"]):
            err.append(f"{key}: needs 2–3 reasoning steps")
        if not b["quotes"]:
            err.append(f"{key}: needs at least one law quote")
        for qt in b["quotes"]:
            err += [f"{key}: {e}" for e in quote_errors(qt, world.norm_text)]
        wrong = {str(i) for i in range(len(q["answers"])) if i != q["correct"] - 1}   # bank `correct` is 1-based
        if set(b["why_not"]) != wrong:
            err.append(f"{key}: why_not must cover exactly the wrong options {sorted(wrong)}")
        mapped = onto.get(str(tid), {}).get("distractors", {})
        for i, w in b["why_not"].items():
            if not w.get("text", "").strip():
                err.append(f"{key}: why_not {i} has no text")
            mc = w.get("mc")
            if mc is not None and mc not in world.misconceptions:
                err.append(f"{key}: unknown misconception {mc}")
            elif mc != mapped.get(i):
                err.append(f"{key}: option {i} typical error {mc!r} differs from the ontology ({mapped.get(i)!r})")
        avail = world.available_concepts(lesson)
        for c in b["concepts"]:
            if c not in world.concepts:
                err.append(f"{key}: unknown concept {c}")
            elif c not in avail:
                err.append(f"{key}: concept {c} is not introduced by {lesson} or earlier")
        for t in texts(b):
            err += [f"{key}: {e}" for e in ref_errors(t, world.norm_ids, _scope(b))]
        words = sum(len(t.split()) for t in texts(b))
        if not WORDS[0] <= words <= WORDS[1]:
            err.append(f"{key}: {words} words, expected {WORDS[0]}–{WORDS[1]}")
    return err


def export(b: dict, world) -> dict:
    """The ticket's `br` record (norm refs are linked later by normsite.link_content)."""
    lesson = world.derive_assignment()["assigned"][b["ticket"]]
    ep = world._ep(lesson)
    rec = {"steps": [{"t": s} for s in b["steps"]],
           "quotes": [{"norm": q["norm"], "ref": quote_ref(q["norm"]), "text": q["text"]} for q in b["quotes"]],
           "why_not": [{"i": int(i), "t": w["text"], "mc": w.get("mc")} for i, w in sorted(b["why_not"].items(), key=lambda kv: int(kv[0]))],
           "lesson": {"id": lesson, "title": ep.get("title", ""), "num": ep.get("num")},
           "concepts": [world.concepts[c]["label"] for c in b["concepts"]]}
    if b.get("trap"):
        rec["trap"] = {"t": b["trap"]}
    return rec
