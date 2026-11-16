"""Episode assembly helpers (tools/pdd/episodes.py)."""
import json
import sys, pathlib
import pytest


from pdd.episodes import core_ticket_ids, linked_ticket_ids, episode_kind, lesson_ticket_ids

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


def test_linked_can_come_from_lesson_assignment():
    ep = {"plan": ["E005"], "linked": "lesson"}
    assert linked_ticket_ids(ep, Q, core=[1], lesson_ids=[4, 1, 2]) == [4, 2]


def test_new_text_opens_before_the_old_editions():
    root = pathlib.Path(__file__).resolve().parents[2]
    released = {ep["id"]: ep for ep in json.loads((root / "site/data/episodes.json").read_text(encoding="utf-8"))["released"]}
    for eid in ("ep01", "ep02", "ep03", "ep04", "ep05", "ep06"):
        editions = released[eid]["editions"]
        assert editions[0]["id"] == "plain", eid
        assert editions[0]["label"] == "Без персонажей"
        assert [e["id"] for e in editions].count("plain") == 1
    assert [e["label"] for e in released["ep02"]["editions"]] == ["Без персонажей", "Ролик"]
    assert [e["label"] for e in released["ep04"]["editions"]] == ["Без персонажей", "С диалогом", "Ролик"]
    assert [e["label"] for e in released["ep05"]["editions"]] == ["Без персонажей", "С диалогом"]
    page = (root / "web/assets/pages/episode.mjs").read_text(encoding="utf-8")
    assert 'aria-label="Другие редакции"' in page
    assert "settings().edition" not in page


def test_ep04_film_separates_a_jam_from_a_stop():
    root = pathlib.Path(__file__).resolve().parents[2]
    script = (root / "video/episodes/ep04/scenes.py").read_text(encoding="utf-8")
    assert "нарушает запрет остановки на самом переходе" not in script
    assert "стояние в потоке остановкой не считается" in script
    episodes = json.loads((root / "content/episodes.json").read_text(encoding="utf-8"))
    ep04 = next(ep for ep in episodes if ep["id"] == "ep04")
    note = ep04["video_note"]
    assert "в случае необходимости" in note and "ст. 25, п. 2" in note
    assert "нарушает запрет остановки" not in note
    assert "без остановки безопасный проход не сохранить" in script
    assert "останавливаются, если человек на переходе или выходит из-за неё." not in script
    dialogue = (root / "packages/lesson/ep04.ts").read_text(encoding="utf-8")
    assert "Главная обязанность водителя у перехода — пропустить пешехода" not in dialogue
    cues = "\n".join(
        cue[2]
        for beat in json.loads((root / "video/episodes/ep04/timeline.json").read_text(encoding="utf-8"))["beats"]
        for cue in beat["cues"]
    )
    assert "нарушает запрет остановки" not in cues
    assert "стояние в потоке остановкой не считается" in cues
    assert "не без прицепа" in cues
    assert "Знак 100 на другой дороге не поднимает потолок 90." in cues
    assert "останавливаются, если человек на переходе или выходит из-за неё." in cues
    page = (root / "web/assets/pages/episode.mjs").read_text(encoding="utf-8")
    assert 'lk(r, "video_note")' in page


def test_ep03_film_does_not_limit_the_right_hand_rule_to_a_slogan():
    root = pathlib.Path(__file__).resolve().parents[2]
    cues = "\n".join(
        cue[2]
        for beat in json.loads((root / "video/episodes/ep03/timeline.json").read_text(encoding="utf-8"))["beats"]
        for cue in beat["cues"]
    )
    assert "только на равнозначном" not in cues
    assert "Помеха справа — правило равнозначного перекрёстка. Двор им не является." in cues
    assert "Если главная меняет направление, водители на ней между собой едут как на равнозначных." in cues
