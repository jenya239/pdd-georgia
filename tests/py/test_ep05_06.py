"""ep05 (E006, участники) and ep06 (E007, транспорт): text lessons closing the vocabulary block."""
import copy
import json
import re

import pytest

from pdd import checkitems, ontology as O, paths
from pdd.build import load_lesson

EP05_TICKETS = {811, 941, 942}
EP06_TICKETS = {921, 922, 906, 905, 892, 893, 925, 521, 537, 826, 47, 53, 69, 75}


@pytest.fixture(scope="module")
def world():
    return O.load_world()


@pytest.fixture(scope="module")
def eps():
    return {e["id"]: e for e in json.loads(paths.EPISODES_JSON.read_text(encoding="utf-8"))}


@pytest.mark.parametrize("lid,plan", [("ep05", "E006"), ("ep06", "E007")])
def test_episode_is_a_text_lesson_of_the_plan(eps, lid, plan):
    e = eps[lid]
    assert e["format"] == "text" and e["plan"] == [plan] and e["lesson"] == f"lessons/{lid}.html"
    assert (paths.LESSONS / lid / "lesson.py").exists() and (paths.LESSONS / lid / "poster.svg").exists()
    assert "чтения" in e["duration"]


def _quotes(lid):
    html = load_lesson(paths.LESSONS / lid).render()
    return html, re.findall(r'<blockquote class="lq"[^>]*><p>.*?</p><cite>(.*?)</cite>', html, re.S)


@pytest.mark.parametrize("lid,cites", [
    ("ep05", ["ст. 5, п. 61", "ст. 5, п. 49", "ст. 5, п. 87", "ст. 5, п. 34", "ст. 5, п. 32", "ст. 24, п. 5"]),
    ("ep06", ["ст. 5, п. 73", "ст. 5, п. 35", "ст. 5, п. 22", "ст. 5, п. 28", "ст. 5, п. 56", "ст. 5, п. 42",
              "ст. 5, п. 44", "ст. 36, п. 4 «в»"]),
])
def test_lesson_quotes_its_definitions(lid, cites):
    html, found = _quotes(lid)
    assert [c for c in cites if c not in found] == []
    assert "<!--AFTER-TICKETS-->" in html and 'class="chat"' in html and "<svg" in html


def test_ep06_shows_the_unit_errors_against_the_georgian_text():
    html, _ = _quotes("ep06")
    assert "кВт/ч" in html and "კმ/სთ" in html


def test_concepts_are_introduced_here(world):
    intro = world.introduced_in
    for c in ("road-user", "driver", "pedestrian", "passenger", "traffic-controller"):
        assert intro.get(c) == "ep05", c
    for c in ("vehicle", "mechanical-vehicle", "bicycle", "e-scooter", "moped", "motorcycle", "trailer",
              "vehicle-masses", "tram-priority"):
        assert intro.get(c) == "ep06", c


def test_derived_tickets_of_ep05_and_ep06(world):
    a = world.derive_assignment()["assigned"]
    assert {t for t, l in a.items() if l == "ep05"} == EP05_TICKETS
    assert {t for t, l in a.items() if l == "ep06"} == EP06_TICKETS


def test_core_tickets_are_the_lessons_own(world, eps):
    a = world.derive_assignment()["assigned"]
    for lid, e in eps.items():
        bad = [t for t in e.get("ticket_ids", []) if a.get(t) != lid]
        assert bad == [], (lid, bad)


def test_ticket_goes_to_the_first_covering_lesson_where_its_concepts_are_known(world):
    """Tram tickets: ep03 teaches 36.4.в but not the tram sentence; ep06 does -> ep06, not blocked."""
    assert world.lesson_covers("ep03", "36.4.в") and world.lesson_covers("ep06", "36.4.в")
    der = world.derive_assignment()
    for tid in (47, 53, 69, 75):
        assert der["assigned"][tid] == "ep06" and tid not in der["blocked"]
    # without the later lesson the ticket stays blocked at the first covering one
    doc = copy.deepcopy(world.doc)
    eps = copy.deepcopy(world.episodes)
    for e in eps:
        if e["id"] == "ep06":
            e["teaches"] = [s for s in e["teaches"] if not s.startswith("36.")]
    w = O.World(doc, list(world.norms.values()), list(world.questions.values()), eps)
    d = w.derive_assignment()
    assert d["blocked"][47] == {"lesson": "ep03", "missing": ["tram-priority"]}


def test_own_items(world):
    items = [i for i in checkitems.load_items() if i["lesson"] in ("ep05", "ep06")]
    by = {lid: [i for i in items if i["lesson"] == lid] for lid in ("ep05", "ep06")}
    assert len(by["ep05"]) >= 5 and len(by["ep06"]) >= 8
    assert {i["type"] for i in by["ep06"]} == set(checkitems.TYPES)
    assert checkitems.validate(items, world) == []
    tram = [i for i in by["ep06"] if i.get("fig", {}).get("kind") == "crossing"]
    assert tram and any(c.get("rail") for i in tram for c in i["fig"]["cars"])
