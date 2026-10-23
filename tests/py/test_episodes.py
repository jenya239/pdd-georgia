"""Episode assembly helpers (tools/pdd/episodes.py)."""
import sys, pathlib
import pytest


from pdd.episodes import core_ticket_ids, linked_ticket_ids, episode_kind, lesson_ticket_ids, lesson_specs

Q = [
    {"id": 1, "law_refs": [{"article": "5", "paragraph": 86}], "episodes": ["E005"]},
    {"id": 2, "law_refs": [{"article": "25", "paragraph": 2}], "episodes": ["E005", "E030"]},
    {"id": 3, "law_refs": [], "episodes": ["E005"]},
    {"id": 4, "law_refs": [{"article": "5", "paragraph": 86}], "episodes": ["E040"]},
]


def test_core_by_refs_in_source_order():
    assert core_ticket_ids({"ticket_refs": [["5", "86"]]}, Q) == [1, 4]


def test_core_explicit_ids_keep_given_order():
    assert core_ticket_ids({"ticket_ids": [3, 1], "ticket_refs": [["25", "2"]]}, Q) == [3, 1]


def test_core_explicit_unknown_id_fails():
    with pytest.raises(ValueError):
        core_ticket_ids({"ticket_ids": [77]}, Q)


def test_linked_excludes_core():
    assert linked_ticket_ids({"plan": ["E005"]}, Q, core=[1]) == [2, 3]


def test_kind_defaults_to_video():
    assert episode_kind({"id": "ep01"}) == "video"


def test_kind_text_requires_lesson_file():
    assert episode_kind({"id": "ep04", "format": "text", "lesson": "lessons/ep04.html"}) == "text"
    with pytest.raises(ValueError):
        episode_kind({"id": "ep04", "format": "text"})


def test_kind_rejects_unknown_format():
    with pytest.raises(ValueError):
        episode_kind({"id": "ep09", "format": "podcast"})


def test_lesson_ticket_ids_sorted():
    assert lesson_ticket_ids("ep04", {9: "ep04", 2: "ep03", 5: "ep04"}) == [5, 9]


def test_lesson_specs_pick_assignment_fields():
    eps = [{"id": "ep02", "num": 2, "teaches": ["5.12"], "title": "x"},
           {"id": "ep01", "num": 1}]
    assert lesson_specs(eps) == [
        {"id": "ep02", "num": 2, "teaches": ["5.12"], "include": [], "exclude": []},
        {"id": "ep01", "num": 1, "teaches": [], "include": [], "exclude": []},
    ]


def test_linked_can_come_from_lesson_assignment():
    ep = {"plan": ["E005"], "linked": "lesson"}
    assert linked_ticket_ids(ep, Q, core=[1], lesson_ids=[4, 1, 2]) == [4, 2]
