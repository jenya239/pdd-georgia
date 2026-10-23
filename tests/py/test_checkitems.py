"""Own check items («наш вопрос»): every item is tied to taught norms and concepts and quotes the law verbatim."""
import json
import re

import pytest

from pdd import checkitems, ontology
from pdd.paths import CHECKITEMS


@pytest.fixture(scope="module")
def world():
    return ontology.load_world()


@pytest.fixture(scope="module")
def items():
    return checkitems.load_items()


def test_normalize_ignores_whitespace_and_dashes():
    assert checkitems.norm_text("150–300  метров\n") == checkitems.norm_text("150-300 метров")


def test_quote_must_be_verbatim():
    law = {"37.6.а.а": "а.а) на пешеходных переходах и переходах для велосипедистов, а также ближе 5 метров перед ними;"}
    good = {"norm": "37.6.а.а", "text": "ближе 5 метров перед ними"}
    bad = {"norm": "37.6.а.а", "text": "ближе 10 метров перед ними"}
    assert checkitems.quote_errors(good, law) == []
    assert checkitems.quote_errors(bad, law)
    assert checkitems.quote_errors({"norm": "99.9", "text": "x"}, law)


def test_flashcard_answer_numbers_come_from_quote():
    item = {"type": "flashcard", "options": ["50", "100"], "answer": 1, "quote": {"text": "ближе чем за 100 метров"}}
    assert checkitems.type_errors(item) == []
    assert checkitems.type_errors({**item, "answer": 0})


def test_cloze_blank_is_the_answer_inside_the_quote():
    item = {"type": "cloze", "q": "«…закрыт, закрывается или ___»", "options": ["поднимается", "открыт"], "answer": 0,
            "quote": {"text": "закрыт, закрывается или поднимается"}}
    assert checkitems.type_errors(item) == []
    assert checkitems.type_errors({**item, "answer": 1})


def test_rule_of_norm_matches_ticket_rule_keys():
    assert checkitems.rule_for("37.6.а.а") == {"key": "37.6", "label": "ст. 37, п. 6 «а.а»"}
    assert checkitems.rule_for("A1:2.1") == {"key": "A1:2.1", "label": "прил. 1, знак 2.1"}
    assert checkitems.rule_for("A1:1.прим.а")["key"] == "A1:1.прим.а"


def test_files_exist_for_ep01_to_ep06():
    assert sorted(p.stem for p in CHECKITEMS.glob("ep*.json")) == ["ep01", "ep02", "ep03", "ep04", "ep05", "ep06"]


def test_items_are_valid(items, world):
    assert checkitems.validate(items, world) == []


def test_every_type_is_used_and_every_lesson_has_items(items):
    assert {i["type"] for i in items} == set(checkitems.TYPES)
    assert {i["lesson"] for i in items} == {"ep01", "ep02", "ep03", "ep04", "ep05", "ep06"}


def test_items_json_export(items, world):
    data = checkitems.export(items, world)
    assert len(data["items"]) == len(items)
    first = data["items"][0]
    assert first["quote"]["ref"] and first["rule"]["key"]
    assert set(data["misconceptions"]) >= {m for i in items for m in i["distractors"].values() if m}
    assert data["ticket_distractors"]["611"]["0"] == "mc-sign-distance"
    json.dumps(data, ensure_ascii=False)


def test_validate_reports_untaught_norm_and_future_concept(world, items):
    bad = dict(items[0], id="o-ep01-99", norms=["36.4.в"], concepts=["intersection"])
    errs = checkitems.validate([bad], world)
    assert any("36.4.в" in e for e in errs) and any("intersection" in e for e in errs)


def test_ep04_lesson_questions_are_recorded_items(items):
    """The former unrecorded Н1–Н3 of the ep04 text are ordinary items now (one each, no duplicates)."""
    ep04 = [i for i in items if i["lesson"] == "ep04"]
    by_quote = {i["quote"]["norm"]: i for i in ep04}
    assert "5.58" in by_quote and "Мост" in by_quote["5.58"]["q"]          # Н2: a bridge is not a crossing
    assert "A1:5.25" in by_quote and "60 км/ч" in by_quote["A1:5.25"]["q"]  # Н3: rules of settlements off
    signs_stop = [i for i in ep04 if "5.19.1" in i["q"] and "остановиться" in i["q"]]
    assert len(signs_stop) == 1                                               # Н1, merged with the width item
    qs = [re.sub(r"\W+", " ", i["q"]).lower() for i in items]
    assert len(qs) == len(set(qs))


def test_items_are_hand_authored_source():
    """content/checkitems/*.json is the source of truth (no generator); files are tidy, ids in order."""
    for f in sorted(CHECKITEMS.glob("ep*.json")):
        raw = f.read_text(encoding="utf-8")
        data = json.loads(raw)
        assert raw == json.dumps(data, ensure_ascii=False, indent=1) + "\n", f.name
        assert [i["id"] for i in data] == [f"o-{f.stem}-{n:02d}" for n in range(1, len(data) + 1)], f.name
