"""Ticket -> primary lesson assignment (tools/pdd/assign.py)."""
import sys, pathlib


from pdd.assign import Ref, parse_spec, subpoint_for, primary_ref, covers, assign_lessons, rule_key, rule_label


def ticket(tid, laws=(), annex=(), expl=""):
    return {"id": tid,
            "law_refs": [{"article": a, "paragraph": p} for a, p in laws],
            "annex_refs": [{"annex": n, "items": list(items)} for n, items in annex],
            "explanation_ka": expl}


EXPL_37 = "„საგზაო მოძრაობის შესახებ“ საქართველოს კანონის 37-ე მუხლის მე-6 პუნქტის „ა.ა“ ქვეპუნქტის თანახმად, აკრძალულია"


def test_parse_spec_law_paragraph():
    assert parse_spec("5.86") == Ref("law", "5", 86, None)


def test_parse_spec_law_subpoint():
    assert parse_spec("37.6.а.а") == Ref("law", "37", 6, "а.а")


def test_parse_spec_annex():
    assert parse_spec("A1:5.19.1") == Ref("annex", "1", "5.19.1", None)


def test_subpoint_is_translated_from_georgian_letters():
    assert subpoint_for(EXPL_37, "37", 6) == "а.а"


def test_subpoint_first_paragraph_word():
    expl = "კანონის 39-ე მუხლის პირველი პუნქტის „ბ“ ქვეპუნქტის თანახმად"
    assert subpoint_for(expl, "39", 1) == "б"


def test_subpoint_none_when_other_article():
    assert subpoint_for(EXPL_37, "41", 3) is None


def test_subpoint_none_when_absent():
    assert subpoint_for("კანონის 5-ე მუხლის 58-ე პუნქტის თანახმად", "5", 58) is None


def test_primary_ref_is_first_law_ref_with_subpoint():
    t = ticket(1, laws=[("37", 6), ("41", 3)], annex=[(1, ["5.14"])], expl=EXPL_37)
    assert primary_ref(t) == Ref("law", "37", 6, "а.а")


def test_primary_ref_falls_back_to_first_annex_item():
    t = ticket(2, annex=[(1, ["2.1", "2.4"])])
    assert primary_ref(t) == Ref("annex", "1", "2.1", None)


def test_primary_ref_none_without_refs():
    assert primary_ref(ticket(3)) is None


def test_paragraph_spec_covers_any_subpoint():
    assert covers(parse_spec("37.6"), Ref("law", "37", 6, "б"))


def test_subpoint_spec_covers_nested_subpoint_only():
    spec = parse_spec("37.6.а")
    assert covers(spec, Ref("law", "37", 6, "а.а"))
    assert not covers(spec, Ref("law", "37", 6, "б"))


def test_subpoint_spec_does_not_cover_unknown_subpoint():
    assert not covers(parse_spec("37.6.а.а"), Ref("law", "37", 6, None))


def test_annex_spec_covers_item_and_children():
    assert covers(parse_spec("A1:5.19"), Ref("annex", "1", "5.19.1", None))
    assert not covers(parse_spec("A1:5.1"), Ref("annex", "1", "5.19.1", None))


def test_law_spec_never_covers_annex_ref():
    assert not covers(parse_spec("5.19"), Ref("annex", "1", "5.19", None))


LESSONS = [
    {"id": "ep02", "num": 2, "teaches": ["5.12"]},
    {"id": "ep03", "num": 3, "teaches": ["36.7", "37.6.а.в"]},
    {"id": "ep04", "num": 4, "teaches": ["5.58", "36.7", "37.6.а.а"], "include": [99], "exclude": [11]},
]


def test_assign_earliest_lesson_teaching_primary_ref():
    out = assign_lessons([ticket(10, laws=[("36", 7)])], LESSONS)
    assert out == {10: "ep03"}


def test_assign_uses_only_primary_ref():
    # secondary ref 5.58 is taught in ep04 but the primary 33.2 is not taught
    out = assign_lessons([ticket(12, laws=[("33", 2), ("5", 58)])], LESSONS)
    assert out == {}


def test_assign_respects_subpoints():
    out = assign_lessons([ticket(13, laws=[("37", 6)], expl=EXPL_37)], LESSONS)
    assert out == {13: "ep04"}


def test_explicit_exclude_and_include():
    out = assign_lessons([ticket(11, laws=[("5", 58)]), ticket(99, laws=[("1", 1)])], LESSONS)
    assert out == {99: "ep04"}


def test_include_wins_over_earlier_lesson():
    lessons = LESSONS + [{"id": "ep05", "num": 5, "teaches": [], "include": [10]}]
    out = assign_lessons([ticket(10, laws=[("36", 7)])], lessons)
    assert out == {10: "ep05"}


def test_lessons_are_ordered_by_num_not_list_order():
    out = assign_lessons([ticket(10, laws=[("36", 7)])], list(reversed(LESSONS)))
    assert out == {10: "ep03"}


def test_rule_key_and_label():
    r = Ref("law", "37", 6, "а.а")
    assert rule_key(r) == "37.6"
    assert rule_label(r) == "ст. 37, п. 6 «а.а»"
    a = Ref("annex", "1", "5.19.1", None)
    assert rule_key(a) == "A1:5.19.1"
    assert rule_label(a) == "прил. 1, знак 5.19.1"
    assert rule_label(Ref("annex", "2", "1.14.1", None)) == "прил. 2, разметка 1.14.1"


def test_primary_ref_article_without_paragraph():
    t = ticket(4, laws=[("39", None)])
    assert primary_ref(t) == Ref("law", "39", None, None)
    assert not covers(parse_spec("39.1"), primary_ref(t))


from pdd.assign import pitfall_for


def test_pitfall_most_specific_spec_wins():
    pits = {"39.1": "general", "39.1.б": "barrier rising"}
    assert pitfall_for(Ref("law", "39", 1, "б"), pits) == "barrier rising"
    assert pitfall_for(Ref("law", "39", 1, "а"), pits) == "general"


def test_pitfall_none_when_not_grounded():
    assert pitfall_for(Ref("law", "33", 6, None), {"39.1": "x"}) is None
    assert pitfall_for(None, {"39.1": "x"}) is None
