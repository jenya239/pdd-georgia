"""Site build: assembles the published directory (docs/) from web/, packages/domain, content/ and data/.

    python3 tools/build.py            # rebuild docs/
    python3 tools/build.py --check    # fail if docs/ is not what the sources produce

Generated files (data/*.json, lessons/*.html) are produced in memory; static files are copied.
Nothing outside the repository is read."""
from __future__ import annotations

import collections
import importlib.util
import json
import re
import shutil
import sys
from pathlib import Path

from pdd import paths
from pdd.assign import assign_lessons, primary_ref, rule_key, rule_label, pitfall_for
from pdd.episodes import core_ticket_ids, linked_ticket_ids, episode_kind, lesson_ticket_ids, lesson_specs
from pdd.lawparse import parse_law, parse_annex
from pdd import checkitems, norms as norms_mod, ontology
from pdd.plan import parse_plan
from pdd.ticketdata import LawIndex, matched_refs, ticket_record, ANNEX_NAME

META = "teoria.on.ge (кат. B/B1), выгрузка 20.10.2026; закон: Matsne, ред. 25.06.2026"
EPISODE_SOURCE_KEYS = ("ticket_refs", "ticket_ids", "quote_refs", "annex_quotes", "teaches", "include", "exclude",
                       "pitfalls", "linked")


def dumps_compact(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def load_law_index() -> LawIndex:
    return LawIndex(parse_law(paths.LAW_RU, "ru"), parse_law(paths.LAW_KA, "ka"),
                    parse_annex(paths.ANNEX_RU), parse_annex(paths.ANNEX_KA))


def load_lesson(lesson_dir: Path):
    """Import content/lessons/<id>/lesson.py (its sibling modules are importable while loading)."""
    sys.path.insert(0, str(lesson_dir))
    try:
        spec = importlib.util.spec_from_file_location(f"lesson_{lesson_dir.name}", lesson_dir / "lesson.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    finally:
        sys.path.remove(str(lesson_dir))
        for name in [n for n, m in sys.modules.items() if getattr(m, "__file__", None) and
                     Path(m.__file__).parent == lesson_dir]:
            del sys.modules[name]


def lesson_asset_refs(html: str, prefix: str) -> list:
    return sorted(set(re.findall(r'(?:src|href)="' + re.escape(prefix) + r'([^"/]+)"', html)))


def generate():
    """Returns (generated text files {relpath: str}, copies {relpath: source Path}, report)."""
    idx = load_law_index()
    Q = json.loads(paths.TICKETS_JSON.read_text(encoding="utf-8"))["questions"]
    stat = collections.Counter()
    tickets = [ticket_record(x, matched_refs(x, idx, stat), stat) for x in Q]
    stat["tickets_with_quotes"] = sum(1 for t in tickets if t["law"])
    topics = {x["topic_id"]: x["topic_ru"] for x in Q}

    plan = parse_plan(paths.PLAN_MD.read_text(encoding="utf-8"))
    cnt = collections.Counter(e for t in tickets for e in t["ep"])
    for p in plan:
        p["n"] = cnt.get(p["e"], 0)

    eps = json.loads(paths.EPISODES_JSON.read_text(encoding="utf-8"))
    assignment = assign_lessons(Q, lesson_specs(eps))
    pitfalls = {e["id"]: e.get("pitfalls", {}) for e in eps}
    for x, t in zip(Q, tickets):
        ref = primary_ref(x)
        t["lesson"] = assignment.get(x["id"])
        if ref:
            t["rule"] = {"key": rule_key(ref), "label": rule_label(ref)}
        why = pitfall_for(ref, pitfalls.get(t["lesson"], {})) if t["lesson"] else None
        if why:
            t["why"] = why

    world = load_world()
    items = checkitems.load_items()
    errors = checkitems.validate(items, world)
    if errors:
        raise ValueError("own check items are invalid:\n" + "\n".join(errors))

    files, copies = {}, {}
    for ep in eps:
        ep["kind"] = episode_kind(ep)
        own = [i["id"] for i in items if i["lesson"] == ep["id"]]
        if own:
            ep["own_items"] = own
        ep["tickets_lesson"] = lesson_ticket_ids(ep["id"], assignment)
        core = core_ticket_ids(ep, Q)
        ep["tickets_core"] = core
        ep["tickets_linked"] = linked_ticket_ids(ep, Q, core, ep["tickets_lesson"])
        ep["law_quotes"] = [idx.law_quote(a, p) for a, p in ep.get("quote_refs", [])]
        ep["law_quotes"] += [idx.annex_quote(an, it) for an, it in ep.get("annex_quotes", [])]
        for q in ep["law_quotes"]:
            assert q["text"], q
        for k in EPISODE_SOURCE_KEYS:
            ep.pop(k, None)
        if ep["kind"] == "text":
            lesson_dir = paths.LESSONS / ep["id"]
            html = load_lesson(lesson_dir).render()
            files[ep["lesson"]] = html
            prefix = f"lessons/{ep['id']}/"
            for name in lesson_asset_refs(html, prefix):
                src = lesson_dir / name
                copies[prefix + name] = src if src.exists() else paths.SIGNS / name
        for key in ("poster", "video"):
            rel = ep.get(key)
            if rel and rel.startswith("lessons/"):
                copies[rel] = paths.LESSONS / rel[len("lessons/"):]
            elif rel and rel.startswith("media/"):
                copies[rel] = paths.MEDIA / rel[len("media/"):]

    meta = {"built_from": META, "count": len(tickets), "topics": topics, "stats": stat}
    files["data/tickets.json"] = dumps_compact({"meta": meta, "tickets": tickets, "laws": idx.quotes})
    files["data/items.json"] = dumps_compact(checkitems.export(items, world))
    files["data/episodes.json"] = json.dumps({"plan": plan, "released": eps}, ensure_ascii=False, indent=1)

    for t in tickets:
        if t["img"]:
            copies[t["img"]] = paths.TICKET_IMAGES / Path(t["img"]).name
    for src in sorted(paths.WEB.rglob("*")):
        if src.is_file():
            copies[src.relative_to(paths.WEB).as_posix()] = src
    for src in sorted(paths.DOMAIN.glob("*.mjs")):
        copies["assets/domain/" + src.name] = src
    files[".nojekyll"] = ""

    report = {"stats": dict(stat), "quotes": len(idx.quotes), "plan": len(plan),
              "missing_files": sorted(r for r, s in copies.items() if not s.exists()),
              "episodes": {ep["id"]: {"kind": ep["kind"], "core": len(ep["tickets_core"]),
                                      "linked": len(ep["tickets_linked"]), "lesson": len(ep["tickets_lesson"])} for ep in eps},
              "unassigned": sum(1 for t in tickets if not t["lesson"])}
    return files, copies, report


_WORLD = []


def load_world():
    """The course ontology over freshly generated norms (computed once per process)."""
    if not _WORLD:
        _WORLD.append(ontology.World(ontology.load_doc(), norms_mod.generate_norms(),
                                     json.loads(paths.TICKETS_JSON.read_text(encoding="utf-8"))["questions"],
                                     json.loads(paths.EPISODES_JSON.read_text(encoding="utf-8"))))
    return _WORLD[0]


def generated_sources() -> dict:
    """Generated files kept in the repository (content/ontology/generated): {Path: text}."""
    world = load_world()
    return {norms_mod.NORMS_JSON: norms_mod.dump(list(world.norms.values())),
            ontology.REPORT_JSON: ontology.dump(world.report(checkitems.load_items()))}


def expected_tree(files, copies) -> dict:
    tree = {rel: ("text", text) for rel, text in files.items()}
    for rel, src in copies.items():
        if rel in tree:
            raise ValueError(f"{rel} is both generated and copied")
        tree[rel] = ("copy", src)
    return tree


def diff_tree(out: Path, tree: dict) -> list:
    """Differences between `out` and the expected tree (missing / changed / extra files)."""
    problems = []
    for rel, (kind, val) in sorted(tree.items()):
        f = out / rel
        if not f.is_file():
            problems.append(f"missing {rel}")
        elif kind == "text" and f.read_text(encoding="utf-8") != val:
            problems.append(f"changed {rel}")
        elif kind == "copy" and f.read_bytes() != val.read_bytes():
            problems.append(f"changed {rel}")
    existing = {p.relative_to(out).as_posix() for p in out.rglob("*") if p.is_file()} if out.exists() else set()
    problems += [f"extra {rel}" for rel in sorted(existing - set(tree))]
    return problems


def write_tree(out: Path, tree: dict):
    if out.exists():
        shutil.rmtree(out)
    for rel, (kind, val) in tree.items():
        f = out / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        if kind == "text":
            f.write_text(val, encoding="utf-8")
        else:
            shutil.copyfile(val, f)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    check = "--check" in argv
    out = Path(next((a.split("=", 1)[1] for a in argv if a.startswith("--out=")), paths.DOCS))
    files, copies, report = generate()
    if report["missing_files"]:
        print("missing source files:", report["missing_files"], file=sys.stderr)
        return 2
    tree = expected_tree(files, copies)
    sources = generated_sources()
    if check:
        problems = [f"{p.relative_to(paths.REPO)}: out of date" for p, text in sources.items()
                    if not p.exists() or p.read_text(encoding="utf-8") != text]
        problems += diff_tree(out, tree)
        for p in problems[:50]:
            print(p)
        print(f"{out}: {'OUT OF DATE (' + str(len(problems)) + ' differences)' if problems else 'up to date'}")
        return 1 if problems else 0
    for p, text in sources.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    write_tree(out, tree)
    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
