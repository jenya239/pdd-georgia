"""Lightweight ontology of the course (content/ontology/*.json). Pure functions + one loader.

Entities
  norm           generated from the law (generated/norms.json, see pdd.norms)
  concept        an idea a learner must hold; `norms` = specs where the law states it (auto-matched
                 against the norms a ticket checks), `part_of` = related norms that are *not* matched
  lesson         `introduces` concepts, `relies_on` earlier concepts, `assumes` general terms never taught
  ticket         annotation for a bank ticket: extra `concepts`, extra `norms`, `context_norms` (cited by the
                 bank but not needed for the answer, e.g. a sign that is only scenery), distractor ->
                 misconception, `note` (why the ticket is or is not in a lesson)
  misconception  a wrong belief behind a distractor; `norms`/`concepts` that correct it

Which norms a ticket checks: every law reference (sub-point from the Georgian citation), every annex
item, every cited annex note (parsed from the Georgian explanation) and annotated extra norms,
minus annotated context norms.
Its concepts: all concepts whose `norms` cover one of those norms, plus annotated ones.

Derived assignment: the earliest lesson whose `teaches` covers the ticket's primary norm, provided every
concept of the ticket is available there (introduced in that or an earlier lesson, or assumed).
Otherwise the ticket is blocked (reported with the missing concepts). This is the only assignment: the
site build uses it as is (no hand lists). `strict` (the earliest lesson by which *every* checked norm is
taught) is reported next to it in generated/report.json for review."""
from __future__ import annotations

import collections
import json
import re
from functools import cached_property

from pdd import paths
from pdd.assign import KA_TO_RU, _number, primary_ref, subpoint_for
from pdd.norms import NORMS_JSON, resolve

ONTOLOGY = paths.ONTOLOGY
REPORT_JSON = ONTOLOGY / "generated" / "report.json"
FILES = ("concepts", "misconceptions", "lessons", "tickets")

_CHAPTER = re.compile(r"(\S+)\s+თავის")
_ANNEX = re.compile(r"(\S+)\s+დანართის")
_NOTE_CIT = re.compile(r"შენიშვნის\s+((?:[„“\"][^„“”\"]{1,5}[“”\"](?:\s*,\s*|\s+და\s+)?)+)\s*(?:ქვე)?პუნქტ")
_LETTERS = re.compile(r"[„“\"]([^„“”\"]{1,5})[“”\"]")


def covers_id(spec: str, norm_id: str) -> bool:
    return norm_id == spec or norm_id.startswith(spec + ".")


def _ru_letters(ka: str):
    parts = ka.split(".")
    if all(p in KA_TO_RU for p in parts):
        return ".".join(KA_TO_RU[p] for p in parts)
    return None


def note_citations(q: dict, norm_ids, norm_text: dict) -> list:
    """Annex-note sub-points cited in the Georgian explanation, as norm ids ('A1:1.прим.а')."""
    text = q.get("explanation_ka") or ""
    items = [str(it) for a in q.get("annex_refs") or [] for it in a.get("items") or []]
    out = []
    for m in _NOTE_CIT.finditer(text):
        before = text[:m.start()]
        annex = 1
        for am in _ANNEX.finditer(before):
            n = _number(am.group(1))
            if n:
                annex = n
        chapter = None
        for cm in _CHAPTER.finditer(before):
            n = _number(cm.group(1))
            if n:
                chapter = n
        if chapter is None and items:
            chapter = int(items[0].split(".")[0])
        if chapter is None:
            continue
        for ka in _LETTERS.findall(m.group(1)):
            ru = _ru_letters(ka)
            if not ru:
                continue
            pat = re.compile(rf"^A{annex}:{chapter}\.прим\d*\.{re.escape(ru)}$")
            cands = sorted(i for i in norm_ids if pat.match(i))
            if not cands:
                continue
            mentions = [c for c in cands if any(re.search(rf"(?<![\d.]){re.escape(it)}(?![\d])",
                                                          norm_text.get(c, "")) for it in items)]
            nid = (mentions or cands)[0]
            if nid not in out:
                out.append(nid)
    return out


def _law_id(art, par, sub, norm_ids):
    base = str(art) if par is None else f"{art}.{par}"
    if sub and f"{base}.{sub}" in norm_ids:
        return f"{base}.{sub}"
    return base if base in norm_ids else None


def ticket_norms(q: dict, norm_ids, norm_text: dict, extra=()) -> dict:
    """{'primary': id|None, 'norms': [ids], 'unresolved': [refs]} for a raw bank ticket."""
    norms, unresolved = [], []

    def add(i):
        if i not in norms:
            norms.append(i)

    expl = q.get("explanation_ka")
    for r in q.get("law_refs") or []:
        par = None if r["paragraph"] is None else int(r["paragraph"])
        sub = subpoint_for(expl, str(r["article"]), par) if par is not None else None
        i = _law_id(r["article"], par, sub, norm_ids)
        add(i) if i else unresolved.append(f"{r['article']}.{par}")
    for a in q.get("annex_refs") or []:
        for it in a.get("items") or []:
            i = f"A{a['annex']}:{it}"
            add(i) if i in norm_ids else unresolved.append(i)
    for i in note_citations(q, norm_ids, norm_text):
        add(i)
    for spec in extra:
        for i in resolve(spec, norm_ids) or [spec]:
            add(i) if i in norm_ids else unresolved.append(spec)
    ref = primary_ref(q)
    primary = None
    if ref and ref.kind == "law":
        primary = _law_id(ref.major, ref.minor, ref.sub, norm_ids)
    elif ref:
        primary = f"A{ref.major}:{ref.minor}" if f"A{ref.major}:{ref.minor}" in norm_ids else None
    return {"primary": primary, "norms": norms, "unresolved": unresolved}


def load_doc(root=ONTOLOGY) -> dict:
    return {k: json.loads((root / f"{k}.json").read_text(encoding="utf-8")) for k in FILES}


class World:
    """Ontology + norms + bank tickets + episodes."""

    def __init__(self, doc, norms, questions, episodes):
        self.doc = doc
        self.norms = {n["id"]: n for n in norms}
        self.norm_ids = set(self.norms)
        self.norm_text = {i: n.get("ru") or "" for i, n in self.norms.items()}
        self.questions = {q["id"]: q for q in questions}
        self.episodes = sorted(episodes, key=lambda e: e["num"])
        self.concepts = {c["id"]: c for c in doc["concepts"]}
        self.misconceptions = {m["id"]: m for m in doc["misconceptions"]}
        self.lessons = {l["id"]: l for l in doc["lessons"]}
        self.lesson_order = [e["id"] for e in self.episodes]

    # -- lessons ---------------------------------------------------------------
    def _ep(self, lesson):
        return next(e for e in self.episodes if e["id"] == lesson)

    def teaches(self, lesson):
        return list(self._ep(lesson).get("teaches", []))

    def quoted(self, lesson):
        ep = self._ep(lesson)
        specs = [str(a) if p is None else f"{a}.{p}" for a, p in ep.get("quote_refs", [])]
        specs += [f"A{an}:{it}" for an, it in ep.get("annex_quotes", [])]
        return self.teaches(lesson) + specs + list(self.lessons.get(lesson, {}).get("states", []))

    def lesson_covers(self, lesson, norm_id):
        return norm_id is not None and any(covers_id(s, norm_id) for s in self.teaches(lesson))

    def _upto(self, lesson):
        return self.lesson_order[:self.lesson_order.index(lesson) + 1]

    @cached_property
    def introduced_in(self):
        out = {}
        for lid in self.lesson_order:
            for c in self.lessons.get(lid, {}).get("introduces", []):
                out.setdefault(c, lid)
        return out

    def available_concepts(self, lesson):
        out = set()
        for lid in self._upto(lesson):
            l = self.lessons.get(lid, {})
            out |= set(l.get("introduces", [])) | set(l.get("assumes", []))
        return out

    @cached_property
    def assumed(self):
        return sorted({c for l in self.doc["lessons"] for c in l.get("assumes", [])} - set(self.introduced_in))

    @cached_property
    def untaught(self):
        return sorted(set(self.concepts) - set(self.introduced_in) - set(self.assumed))

    # -- tickets ---------------------------------------------------------------
    def annotation(self, tid):
        return self.doc["tickets"].get(str(tid), {})

    def bank_norms(self, tid):
        """Norms as cited by the bank (plus annotated extra norms), before context norms are removed."""
        return ticket_norms(self.questions[tid], self.norm_ids, self.norm_text, self.annotation(tid).get("norms", []))

    def ticket_norms(self, tid):
        tn = self.bank_norms(tid)
        ctx = self.annotation(tid).get("context_norms", [])
        if not ctx:
            return tn
        drop = [n for n in tn["norms"] if any(covers_id(c, n) for c in ctx)]
        return {**tn, "norms": [n for n in tn["norms"] if n not in drop], "context": sorted(drop)}

    def concepts_for_norms(self, norm_ids):
        return sorted(c for c, d in self.concepts.items()
                      if any(covers_id(s, n) for s in d.get("norms", []) for n in norm_ids))

    def ticket_concepts(self, tid):
        tn = self.ticket_norms(tid)
        return sorted(set(self.concepts_for_norms(tn["norms"])) | set(self.annotation(tid).get("concepts", [])))

    def derive_assignment(self):
        """A ticket goes to the first lesson that teaches its primary norm and by which all its concepts are known.
        If no covering lesson has them all, it is blocked at the first covering lesson (with what is missing there)."""
        assigned, blocked = {}, {}
        for tid in sorted(self.questions):
            tn = self.ticket_norms(tid)
            covering = [l for l in self.lesson_order if self.lesson_covers(l, tn["primary"])]
            if not covering:
                continue
            need = set(self.ticket_concepts(tid))
            lesson = next((l for l in covering if need <= self.available_concepts(l)), None)
            if lesson is None:
                blocked[tid] = {"lesson": covering[0], "missing": sorted(need - self.available_concepts(covering[0]))}
            else:
                assigned[tid] = lesson
        return {"assigned": assigned, "blocked": blocked}

    def strict_assignment(self):
        out = {}
        for tid in sorted(self.questions):
            norms = self.ticket_norms(tid)["norms"]
            if not norms:
                continue
            for lid in self.lesson_order:
                if all(any(self.lesson_covers(l, n) for l in self._upto(lid)) for n in norms):
                    out[tid] = lid
                    break
        return out

    # -- integrity -------------------------------------------------------------
    def _spec_ok(self, spec):
        return bool(resolve(spec, self.norm_ids))

    def integrity_errors(self):
        err = []
        ids = set(self.concepts)
        for c in self.doc["concepts"]:
            for s in c.get("norms", []) + c.get("part_of", []):
                if not self._spec_ok(s):
                    err.append(f"concept {c['id']}: unknown norm {s}")
        for m in self.doc["misconceptions"]:
            for s in m.get("norms", []):
                if not self._spec_ok(s):
                    err.append(f"misconception {m['id']}: unknown norm {s}")
            for c in m.get("concepts", []):
                if c not in ids:
                    err.append(f"misconception {m['id']}: unknown concept {c}")
        seen = {}
        for l in self.doc["lessons"]:
            lid = l["id"]
            if lid not in self.lesson_order:
                err.append(f"lesson {lid}: not in episodes.json")
                continue
            for key in ("introduces", "relies_on", "assumes"):
                for c in l.get(key, []):
                    if c not in ids:
                        err.append(f"lesson {lid}: {key} unknown concept {c}")
            for s in l.get("states", []):
                if not self._spec_ok(s):
                    err.append(f"lesson {lid}: unknown stated norm {s}")
            for c in l.get("introduces", []):
                if c in seen:
                    err.append(f"concept {c} introduced twice ({seen[c]}, {lid})")
                seen.setdefault(c, lid)
                quoted = self.quoted(lid)
                for s in self.concepts.get(c, {}).get("norms", []):
                    if not any(covers_id(q, n) for q in quoted for n in resolve(s, self.norm_ids)):
                        err.append(f"lesson {lid}: introduces {c} but neither teaches nor quotes {s}")
        for lid in self.lesson_order:
            l = self.lessons.get(lid, {})
            before = set()
            for prev in self.lesson_order[:self.lesson_order.index(lid)]:
                before |= set(self.lessons.get(prev, {}).get("introduces", []))
            assumed_upto = set()
            for prev in self._upto(lid):
                assumed_upto |= set(self.lessons.get(prev, {}).get("assumes", []))
            for c in l.get("relies_on", []):
                if c not in before | assumed_upto:
                    err.append(f"lesson {lid}: relies on {c} before it is introduced")
        for key, a in self.doc["tickets"].items():
            tid = int(key)
            q = self.questions.get(tid)
            if q is None:
                err.append(f"ticket {key}: not in the bank")
                continue
            for c in a.get("concepts", []):
                if c not in ids:
                    err.append(f"ticket {key}: unknown concept {c}")
            for s in a.get("norms", []):
                if not self._spec_ok(s):
                    err.append(f"ticket {key}: unknown norm {s}")
            if a.get("context_norms"):
                bank = self.bank_norms(tid)
                for s in a["context_norms"]:
                    if bank["primary"] is not None and covers_id(s, bank["primary"]):
                        err.append(f"ticket {key}: context norm {s} is its primary norm")
                    elif not any(covers_id(s, n) for n in bank["norms"]):
                        err.append(f"ticket {key}: context norm {s} is not cited by the bank")
            correct = q["correct"] - 1
            dist = a.get("distractors")
            if dist is not None:
                want = {str(i) for i in range(len(q["answers"])) if i != correct}
                if set(dist) != want:
                    err.append(f"ticket {key}: distractor keys {sorted(dist)} != {sorted(want)}")
                for i, mid in dist.items():
                    if mid is not None and mid not in self.misconceptions:
                        err.append(f"ticket {key}: unknown misconception {mid}")
        derived = self.derive_assignment()["assigned"]
        for tid, lid in derived.items():
            if not self.lesson_covers(lid, self.ticket_norms(tid)["primary"]):
                err.append(f"ticket {tid}: assigned to {lid} but its primary norm is not taught there")
        return err

    # -- report ----------------------------------------------------------------
    def report(self, items=()):
        """`items`: own check items (pdd.checkitems) — counted, and their distractors count as misconception use."""
        der = self.derive_assignment()
        strict = self.strict_assignment()
        kinds = {}
        for n in self.norms.values():
            k = "annex note" if ".прим" in n["id"] else n["kind"]
            kinds[k] = kinds.get(k, 0) + 1
        assigned = der["assigned"]
        strict_diffs = [{"ticket": t, "derived": assigned.get(t), "strict": strict.get(t)}
                        for t in sorted(set(assigned) | set(strict)) if assigned.get(t) != strict.get(t)]
        annotated = self.doc["tickets"]
        dist = [m for a in annotated.values() for m in (a.get("distractors") or {}).values()]
        by_lesson = lambda asg: {l: sum(1 for v in asg.values() if v == l) for l in self.lesson_order}
        mis_use = {}
        for a in annotated.values():
            for m in (a.get("distractors") or {}).values():
                if m:
                    mis_use[m] = mis_use.get(m, 0) + 1
        for it in items:
            for m in it["distractors"].values():
                if m:
                    mis_use[m] = mis_use.get(m, 0) + 1
        return {
            "_generated": "python3 tools/build.py (pdd.ontology); do not edit",
            "stats": {
                "norms": len(self.norms), "norms_by_kind": dict(sorted(kinds.items())),
                "concepts": len(self.concepts),
                "introduced": {l: len(self.lessons.get(l, {}).get("introduces", [])) for l in self.lesson_order},
                "assumed": len(self.assumed), "untaught": len(self.untaught),
                "misconceptions": len(self.misconceptions),
                "annotated_tickets": len(annotated),
                "distractors": len(dist), "distractors_mapped": sum(1 for m in dist if m),
            },
            "assignment": {
                "derived": by_lesson(assigned), "strict": by_lesson(strict), "blocked": len(der["blocked"]),
                "blocked_tickets": {str(t): {**b, **({"note": self.annotation(t)["note"]}
                                                     if self.annotation(t).get("note") else {})}
                                    for t, b in sorted(der["blocked"].items())},
                "diff_derived_vs_strict": strict_diffs,
            },
            "gaps": {
                "assumed_concepts": [{"id": c, "label": self.concepts[c]["label"]} for c in self.assumed],
                "untaught_concepts": [{"id": c, "label": self.concepts[c]["label"],
                                       "blocks": sorted(t for t, b in der["blocked"].items() if c in b["missing"])}
                                      for c in self.untaught],
                "concept_notes": [{"id": c["id"], "gap": c["gap"]} for c in self.doc["concepts"] if c.get("gap")],
                "unmapped_distractors": sorted(f"{t}:{i}" for t, a in annotated.items()
                                               for i, m in (a.get("distractors") or {}).items() if m is None),
                "unused_misconceptions": sorted(set(self.misconceptions) - set(mis_use)),
                "unresolved_ticket_refs": {str(t): u for t in sorted(self.questions)
                                           for u in [self.ticket_norms(t)["unresolved"]] if u},
            },
            "own_items": {
                "total": len(items),
                "by_lesson": {l: sum(1 for i in items if i["lesson"] == l) for l in self.lesson_order
                              if any(i["lesson"] == l for i in items)},
                "by_type": dict(sorted(collections.Counter(i["type"] for i in items).items())),
            },
            "misconception_use": dict(sorted(mis_use.items())),
        }


def dump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def load_world(root=ONTOLOGY) -> World:
    norms = json.loads(NORMS_JSON.read_text(encoding="utf-8"))["norms"]
    questions = json.loads(paths.TICKETS_JSON.read_text(encoding="utf-8"))["questions"]
    episodes = json.loads(paths.EPISODES_JSON.read_text(encoding="utf-8"))
    return World(load_doc(root), norms, questions, episodes)
