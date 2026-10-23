"""Pure helpers for assembling released episodes (used by build.py)."""
from __future__ import annotations

FORMATS = ("video", "text")


def core_ticket_ids(ep: dict, questions: list) -> list:
    """Main tickets of an episode: explicit `ticket_ids` (ordered) or all tickets
    whose law references hit one of `ticket_refs` [(article, paragraph)]."""
    known = {q["id"] for q in questions}
    if "ticket_ids" in ep:
        unknown = [i for i in ep["ticket_ids"] if i not in known]
        if unknown:
            raise ValueError(f"{ep.get('id')}: unknown ticket ids {unknown}")
        return list(ep["ticket_ids"])
    keys = {(str(a), str(p)) for a, p in ep.get("ticket_refs", [])}
    return [q["id"] for q in questions
            if any((str(r["article"]), str(r["paragraph"])) in keys for r in q["law_refs"])]


def linked_ticket_ids(ep: dict, questions: list, core: list, lesson_ids=()) -> list:
    """Secondary tickets: the rest of the lesson's assigned tickets (`"linked": "lesson"`)
    or, by default, all tickets mapped to the episode's plan items."""
    seen = set(core)
    if ep.get("linked") == "lesson":
        return [i for i in lesson_ids if i not in seen]
    plan = set(ep.get("plan", []))
    return [q["id"] for q in questions if q["id"] not in seen and plan & set(q.get("episodes", []))]


def episode_kind(ep: dict) -> str:
    kind = ep.get("format", "video")
    if kind not in FORMATS:
        raise ValueError(f"{ep.get('id')}: unknown format {kind!r}")
    if kind == "text" and not ep.get("lesson"):
        raise ValueError(f"{ep.get('id')}: text episode needs a 'lesson' file")
    return kind


def lesson_ticket_ids(lesson_id: str, assignment: dict) -> list:
    return sorted(tid for tid, lid in assignment.items() if lid == lesson_id)


def lesson_specs(episodes: list) -> list:
    return [{"id": e["id"], "num": e["num"], "teaches": list(e.get("teaches", [])),
             "include": list(e.get("include", [])), "exclude": list(e.get("exclude", []))}
            for e in episodes]
