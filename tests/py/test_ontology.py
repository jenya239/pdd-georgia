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


def test_no_live_hand_assignment(world):
    assert not hasattr(world, "live_assignment")


def test_every_lesson_ticket_is_annotated(world):
    lesson_tickets = sorted(world.derive_assignment()["assigned"])
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
    # tickets once removed by hand are blocked by an untaught concept, not by a list
    for tid in (47, 53, 69, 75, 21, 59, 256, 605, 614, 618, 794):
        assert tid in derived["blocked"], tid
    assert set(order) == {"ep01", "ep02", "ep03", "ep04"}


# --- verdicts for tickets the old heuristic put into lessons ----------------------

DROPPED = {224: ["min-speed-sign"], 274: ["warning-sign-repeat"], 425: ["railway-approach-signs", "warning-sign-repeat"],
           434: ["railway-approach-signs"], 436: ["railway-approach-signs", "warning-sign-repeat"],
           1262: ["sign-zone-of-action"], 794: ["settlement-sign-look"]}


def test_dropped_tickets_are_blocked_with_a_recorded_reason(world):
    blocked = world.derive_assignment()["blocked"]
    for tid, missing in DROPPED.items():
        assert blocked[tid]["missing"] == missing, (tid, blocked.get(tid))
        assert len(world.annotation(tid).get("note", "")) > 20, tid


def test_794_needs_the_look_of_settlement_signs(world):
    c = world.concepts["settlement-sign-look"]
    assert c["norms"] == [] and "settlement-sign-look" in world.untaught
    assert "рисун" in c["gap"] and "5.26" in world.annotation(794)["note"]


def test_515_living_zone_speed_is_taught_in_ep04(world):
    # the question itself says «в жилой зоне»; ep04 quotes 33.6 «в жилых зонах – … не более 20 км/ч»
    assert world.derive_assignment()["assigned"][515] == "ep04"
    a = world.annotation(515)
    assert a["context_norms"] == ["A1:5.21"] and a["note"]
    tn = world.ticket_norms(515)
    assert "A1:5.21" not in tn["norms"] and "33.6" in tn["norms"] and tn["context"] == ["A1:5.21"]
    assert "living-zone" not in world.ticket_concepts(515)


def test_context_norms_must_be_cited_by_the_bank_and_not_primary(world):
    import copy
    doc = copy.deepcopy(world.doc)
    doc["tickets"]["515"]["context_norms"] = ["33.6", "5.58"]
    w = O.World(doc, list(world.norms.values()), list(world.questions.values()), world.episodes)
    errs = w.integrity_errors()
    assert "ticket 515: context norm 33.6 is its primary norm" in errs
    assert "ticket 515: context norm 5.58 is not cited by the bank" in errs


def test_shoulder_is_a_concept_without_a_definition(world):
    c = world.concepts["shoulder"]
    assert c["norms"] == [] and c["gap"].startswith("Закон не определяет обочину")
    for n in ("5.12", "5.15", "31.18", "24.5", "A2:1.2.1"):
        assert n in c["part_of"], n
    assert world.introduced_in.get("shoulder") == "ep02"


def test_report_has_no_live_assignment(world):
    rep = world.report()
    assert set(rep["assignment"]) == {"derived", "strict", "blocked", "blocked_tickets", "diff_derived_vs_strict"}
    assert rep["assignment"]["blocked_tickets"]["794"]["missing"] == ["settlement-sign-look"]


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
