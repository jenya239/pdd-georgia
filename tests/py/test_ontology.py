"""Lightweight ontology: norms, concepts, lessons, tickets, misconceptions (content/ontology)."""
import json

import pytest

from pdd import ontology as O
from pdd.ontology import note_citations, ticket_norms, covers_id


# --- pure helpers -------------------------------------------------------------

def test_covers_id():
    assert covers_id("37.6", "37.6.а.а") and covers_id("37.6.а.а", "37.6.а.а")
    assert not covers_id("5.1", "5.12") and not covers_id("A1:5.2", "A1:5.23")
    assert covers_id("A1:1.прим", "A1:1.прим.а") and not covers_id("A1:1.прим", "A1:1.прим2")


@pytest.fixture(scope="module")
def world():
    return O.load_world()


def _q(world, tid):
    return world.questions[tid]


def test_note_citations_explicit_chapter(world):
    # 611: «…პირველი დანართის პირველი თავის (…) შენიშვნის „ა“ ქვეპუნქტის…» -> A1 ch.1 note а
    assert note_citations(_q(world, 611), world.norm_ids, world.norm_text) == ["A1:1.прим.а"]
    # 618 cites „ა“, „ბ“ და „ვ“ (KA ვ = RU е)
    assert note_citations(_q(world, 618), world.norm_ids, world.norm_text) == [
        "A1:1.прим.а", "A1:1.прим.б", "A1:1.прим.е"]
    # 745: two-level letter „გ.ა“ in chapter 3 (the lettered note is the second one)
    assert note_citations(_q(world, 745), world.norm_ids, world.norm_text) == ["A1:3.прим2.в.а"]


def test_note_citations_same_chapter_fallback(world):
    # 1262: «ამავე თავის შენიშვნის „ე“» after a chapter-3 sign; KA ე = RU д
    assert note_citations(_q(world, 1262), world.norm_ids, world.norm_text) == ["A1:3.прим2.д"]
    assert note_citations(_q(world, 13), world.norm_ids, world.norm_text) == ["A1:2.прим.а"]
    # 187: «ამავე პუნქტის შენიშვნის „ბ“» for 5.15.x -> the 5.15 note, not the 5.27 one
    assert note_citations(_q(world, 187), world.norm_ids, world.norm_text) == ["A1:5.прим.б"]


def test_ticket_norms(world):
    tn = ticket_norms(_q(world, 314), world.norm_ids, world.norm_text)
    assert tn["primary"] == "37.6.а.а" and "37.6.а.а" in tn["norms"] and tn["unresolved"] == []
    tn = ticket_norms(_q(world, 611), world.norm_ids, world.norm_text)
    assert "A1:1.прим.а" in tn["norms"]


# --- the authored ontology ----------------------------------------------------

def test_schema_valid(world):
    jsonschema = pytest.importorskip("jsonschema")
    schema = json.loads((O.ONTOLOGY / "schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(world.doc, schema)


def test_integrity(world):
    assert world.integrity_errors() == []


def test_every_live_lesson_ticket_is_annotated(world):
    live = world.live_assignment
    lesson_tickets = sorted(t for t, l in live.items())
    missing = [t for t in lesson_tickets if "distractors" not in world.doc["tickets"].get(str(t), {})]
    assert missing == []


def test_derived_assignment_respects_concepts(world):
    derived = world.derive_assignment()
    order = world.lesson_order
    for tid, lesson in derived["assigned"].items():
        q_concepts = world.ticket_concepts(tid)
        avail = world.available_concepts(lesson)
        assert set(q_concepts) <= avail, (tid, lesson, set(q_concepts) - avail)
        assert world.lesson_covers(lesson, world.ticket_norms(tid)["primary"])
    # tickets that need an untaught concept are blocked, not assigned
    assert derived["blocked"][224]["missing"] == ["min-speed-sign"]
    assert derived["blocked"][1262]["missing"] == ["sign-zone-of-action"]
    # ep04 states note «а» to section 1 of annex 1 (150–300 / 50–100 m), so these stay in ep04
    assert all(derived["assigned"].get(t) == "ep04" for t in (611, 670, 671))
    # the hand-made excludes of ep03/ep04 are explained by untaught concepts (794 is not: reported)
    for tid in (47, 53, 69, 75, 21, 59, 256, 605, 614, 618):
        assert tid in derived["blocked"], tid
    assert set(order) == {"ep01", "ep02", "ep03", "ep04"}


def test_report_is_fresh(world):
    path = O.REPORT_JSON
    assert path.exists(), "run tools/build.py"
    from pdd import checkitems
    assert json.loads(path.read_text(encoding="utf-8")) == json.loads(O.dump(world.report(checkitems.load_items())))


def test_report_counts_own_items_and_their_misconceptions(world):
    from pdd import checkitems
    items = checkitems.load_items()
    rep = world.report(items)
    assert rep["own_items"]["total"] == len(items)
    assert sum(rep["own_items"]["by_type"].values()) == len(items)
    assert rep["gaps"]["unused_misconceptions"] == []
