"""Machine translation of Georgian-only ticket text: placeholders for norm references, hash-keyed cache."""
import json

import pytest

from pdd import mt
from pdd.normref import Ref
from pdd.paths import DOCS, TICKETS_JSON

LAW = "„საგზაო მოძრაობის შესახებ“ საქართველოს კანონის 36-ე მუხლის მე-4 პუნქტის „ა“ და „დ“ ქვეპუნქტების თანახმად, მძღოლი ვალდებულია გზა დაუთმოს."


def ref(text, sub, norm, status="linked", kind="law"):
    i = LAW.index(text) if text in LAW else 0
    return Ref(start=i, end=i + len(text), text=text, kind=kind, status=status, norm=norm)


def test_adjacent_references_become_one_placeholder_with_a_russian_citation():
    refs = [ref("36-ე მუხლის მე-4 პუნქტის „ა“", "а", "36.4.а"), ref("„დ“", "г", "36.4.г")]
    masked, labels = mt.mask(LAW, refs)
    assert masked == "„საგზაო მოძრაობის შესახებ“ საქართველოს კანონის §1§ თანახმად, მძღოლი ვალდებულია გზა დაუთმოს."
    assert labels == ["ст. 36, п. 4 «а» и «г»"]


def test_groups_with_unresolved_parts_are_left_to_the_translator():
    refs = [ref("36-ე მუხლის მე-4 პუნქტის „ა“", "а", "36.4.а"), ref("„დ“", "", None, status="missing")]
    assert mt.mask(LAW, refs) == (LAW, [])


def test_russian_citations_for_law_and_annex_groups():
    assert mt.ru_cite(["36.3.а", "28.3"]) == "ст. 36, п. 3 «а»; ст. 28, п. 3"
    assert mt.ru_cite(["51.1", "51.2"]) == "ст. 51, п. 1 и 2"
    assert mt.ru_cite(["A1:5.13.1", "A1:5.14"]) == "знаки 5.13.1 и 5.14"
    assert mt.ru_cite(["A1:5.14"], annex_point=True) == "прил. 1, п. 5.14"
    assert mt.ru_cite(["A2:1.1"]) == "разметка 1.1"


def test_annex_point_absorbs_the_annex_words_around_it():
    t = "საქართველოს კანონის პირველი დანართის 3.1 პუნქტის თანახმად"
    i = t.index("3.1")
    masked, labels = mt.mask(t, [Ref(start=i, end=i + 3, text="3.1", kind="annex", status="linked", norm="A1:3.1")])
    assert masked == "საქართველოს კანონის §1§ თანახმად" and labels == ["прил. 1, п. 3.1"]


def test_sign_number_absorbs_the_sign_noun():
    t = "5.14 საგზაო ნიშნებით აღნიშნული"
    masked, labels = mt.mask(t, [Ref(start=0, end=4, text="5.14", kind="annex", status="linked", norm="A1:5.14")])
    assert masked == "§1§ აღნიშნული" and labels == ["знак 5.14"]


def test_unmask_restores_and_rejects_lost_or_duplicated_tokens():
    assert mt.unmask("Согласно § 1 § Закона и §2§.", ["ст. 5, п. 9", "знак 3.1"]) == "Согласно ст. 5, п. 9 Закона и знак 3.1."
    assert mt.unmask("кроме статьей 2§ и §1 Закона", ["ст. 5", "ст. 37, п. 1"]) == "кроме ст. 37, п. 1 и ст. 5 Закона"
    for bad in ("Согласно Закона.", "§1§ и §1§", "§1§ и §3§"):
        with pytest.raises(ValueError):
            mt.unmask(bad, ["a"] if "3" not in bad else ["a", "b"])


def test_cache_only_retranslates_new_or_changed_sources():
    jobs = {"1:ex": "ა", "2:ex": "ბ", "3:ex": "ა"}
    cache = {"1:ex": {"h": mt.source_hash("ა"), "ru": "А"}, "2:ex": {"h": mt.source_hash("old"), "ru": "x"}}
    calls = []
    out = mt.fill(jobs, cache, lambda k, s: calls.append(s) or s.upper() + "!")
    assert calls == ["ბ"]                       # 1 cached, 3 reuses 1's translation (same source), 2 changed
    assert out["2:ex"] == {"h": mt.source_hash("ბ"), "ru": "Ბ!"} and out["3:ex"]["ru"] == "А"
    assert mt.cache_errors(jobs, out) == []
    assert mt.cache_errors({**jobs, "4:q": "გ"}, out) == ["4:q: no machine translation (run tools/translate_ka.py)"]


def test_every_georgian_only_text_has_a_cached_translation():
    Q = json.loads(TICKETS_JSON.read_text(encoding="utf-8"))["questions"]
    jobs = mt.jobs(Q)
    assert sum(k.endswith(":ex") for k in jobs) == sum(1 for q in Q if q.get("explanation_ka"))
    assert sum(k.endswith(":q") for k in jobs) == 51
    assert mt.cache_errors(jobs, mt.load_cache()) == []


def test_built_tickets_carry_linked_russian_explanations():
    T = json.loads((DOCS / "data/tickets.json").read_text(encoding="utf-8"))["tickets"]
    with_ex = [t for t in T if t.get("ex")]
    assert with_ex and all(t.get("ex_ru") for t in with_ex)
    assert sum(1 for t in with_ex if (t.get("_r") or {}).get("ex_ru")) > 0.8 * len(with_ex)
    eco = [t for t in T if "ru" in t.get("nu", [])]
    assert len(eco) == 51 and all(t["mt"]["q"] and len(t["mt"]["a"]) == len(t["a"]["ka"]) for t in eco)


def test_sign_noun_before_the_number_is_absorbed_and_article_only_citations_work():
    t = "საგზაო ნიშანი 4.3 „წრიული მოძრაობა”"
    i = t.index("4.3")
    assert mt.mask(t, [Ref(start=i, end=i + 3, text="4.3", kind="annex", status="linked", norm="A1:4.3")]) \
        == ("§1§ „წრიული მოძრაობა”", ["знак 4.3"])
    assert mt.ru_cite(["36"]) == "ст. 36"
    assert mt.ru_cite(["38.1.а", "38.1.в.в"]) == "ст. 38, п. 1 «а» и «в.в»"


def test_translator_may_return_flagged_entries_and_long_texts_split_into_sentences():
    out = mt.fill({"1:ex": "ა"}, {}, lambda k, s: {"ru": "А", "masked": False})
    assert out["1:ex"] == {"h": mt.source_hash("ა"), "ru": "А", "masked": False}
    assert mt.sentences("ერთი §1§ თანახმად. ორი: სამი;  ოთხი") == ["ერთი §1§ თანახმად.", "ორი:", "სამი;", "ოთხი"]


def test_clean_removes_typesetting_debris_before_translation():
    assert mt.clean("სატრა¬ნსპორტო  შესრულებისას \ufffd\ufffdმავე \ufffd") == "სატრანსპორტო შესრულებისას . ამავე"


def test_annex_chapter_with_its_title_is_part_of_the_point_citation():
    t = "კანონის პირველი დანართის მე-4 თავის (მიმთითებელი ნიშნები (დაფები)) 4.6 პუნქტის თანახმად"
    i = t.index("4.6")
    assert mt.mask(t, [Ref(start=i, end=i + 3, text="4.6", kind="annex", status="linked", norm="A1:4.6")]) \
        == ("კანონის §1§ თანახმად", ["прил. 1, п. 4.6"])


def test_the_traffic_law_named_in_full_is_not_another_act():
    from pdd import normref
    assert [r.status for r in normref.find_ru("Согласно ст. 36, п. 4 «в» Закона Грузии «О дорожном движении»")] != ["external"]
    assert [r.status for r in normref.find_ru("ст. 5 Закона Грузии «О полиции»")] == ["external"]


def test_machine_translated_subparagraph_links_are_confirmed_by_the_georgian_original():
    import re
    T = json.loads((DOCS / "data/tickets.json").read_text(encoding="utf-8"))["tickets"]
    for t in T:
        r = t.get("_r") or {}
        ka = {sp[2] for sp in r.get("ex", [])}
        assert all(sp[2] in ka for sp in r.get("ex_ru", []) if re.match(r"st[\d_]+-p\d+-", sp[2])), t["id"]
