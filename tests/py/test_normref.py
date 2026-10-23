"""Norm reference resolver (pdd.normref): real strings from the course content → norm ids.
A wrong link is worse than none: every case that must stay plain is pinned too."""
import json

import pytest

from pdd import paths, normref
from pdd.normref import find_ru, resolve_ru, find_ka, resolve_ka, explicit_cites, context_article

NORMS = {n["id"]: n for n in json.loads((paths.REPO / "content/ontology/generated/norms.json").read_text(encoding="utf-8"))["norms"]}
IDS = set(NORMS)
KA = {i: n.get("ka") or "" for i, n in NORMS.items()}


def ru(text, scopes=(), own_article=None):
    refs = find_ru(text)
    resolve_ru(refs, IDS, [explicit_cites(refs), *scopes], own_article)
    return [(r.text, r.norm if r.status == "linked" else r.status) for r in refs]


# (text from the content, [(link text, norm id | status)])
RU_CASES = [
    ("ст. 5, п. 13", [("ст. 5, п. 13", "5.13")]),
    ("(ст. 37, п. 6 «а.а»)", [("ст. 37, п. 6 «а.а»", "37.6.а.а")]),
    ("ст. 39, п. 1 «б»", [("ст. 39, п. 1 «б»", "39.1.б")]),
    ("ст. 55, пп. 1, 3, 4 «г»", [("ст. 55, пп. 1", "55.1"), ("3", "55.3"), ("4 «г»", "55.4.г")]),
    ("ст. 2, пп. 1–2", [("ст. 2, пп. 1", "2.1"), ("2", "2.2")]),
    ("ст. 5, пп. 18, 19, 52, 80", [("ст. 5, пп. 18", "5.18"), ("19", "5.19"), ("52", "5.52"), ("80", "5.80")]),
    ("ст. 43, пп. 12–13", [("ст. 43, пп. 12", "43.12"), ("13", "43.13")]),
    ("ст. 21, п. 15²", [("ст. 21, п. 15²", "21.15^2")]),
    ("ст. 11¹, п. 2", [("ст. 11¹, п. 2", "11¹.2")]),
    ("ст. 39", [("ст. 39", "39")]),
    ("п. 13 ст. 5", [("п. 13 ст. 5", "5.13")]),
    ("в пунктах 10–12 статьи 31 настоящего Закона", [("пунктах 10", "31.10"), ("12", "31.12")]),
    ("установленных пунктами 5–10, 15 и 16 статьи 31 и пунктом первым статьи 38",
     [("пунктами 5", "31.5"), ("10", "31.10"), ("15", "31.15"), ("16", "31.16"), ("статьи 38", "38")]),  # «пунктом первым» — word numerals are not parsed
    ("в соответствии с подпунктом «д» пункта 3 статьи 36 настоящего Закона", [("подпунктом «д» пункта 3 статьи 36", "36.3.д")]),
    ("кроме лиц, определенных подпунктом «а» пункта 2 статьи 19 настоящего Закона", [("подпунктом «а» пункта 2 статьи 19", "19.2.а")]),
    ("знак 5.26", [("знак 5.26", "A1:5.26")]),
    ("знаками 5.19.1 и 5.19.2", [("знаками 5.19.1", "A1:5.19.1"), ("5.19.2", "A1:5.19.2")]),
    ("Знаки 1.1, 1.2, 1.5–1.34", [("Знаки 1.1", "A1:1.1"), ("1.2", "A1:1.2"), ("1.5", "A1:1.5"), ("1.34", "A1:1.34")]),
    ("дорожными знаками 5.15.1, 5.15.2, 5.15.7 и 5.15.8",
     [("знаками 5.15.1", "A1:5.15.1"), ("5.15.2", "A1:5.15.2"), ("5.15.7", "A1:5.15.7"), ("5.15.8", "A1:5.15.8")]),
    ("разметка 1.14.1–1.14.2", [("разметка 1.14.1", "A2:1.14.1"), ("1.14.2", "A2:1.14.2")]),
    ("прил. 1, пп. 5.23.2, 5.25", [("прил. 1, пп. 5.23.2", "A1:5.23.2"), ("5.25", "A1:5.25")]),
    ("прил. 1, примечание «а» к разделу 1", [("прил. 1, примечание «а» к разделу 1", "A1:1.прим.а")]),
    ("прил. 2, п. 1.2.1–1.2.2", [("прил. 2, п. 1.2.1", "A2:1.2.1"), ("1.2.2", "A2:1.2.2")]),
    # must stay plain
    ("разметкой 1.14.1–1.14.3", [("разметкой 1.14.1", "A2:1.14.1"), ("1.14.3", "missing")]),   # 1.14.3 does not exist
    ("прил. 1, п. 5.19", [("прил. 1, п. 5.19", "missing")]),             # a group: only 5.19.1 / 5.19.2 exist
    ("Без разметки 1.14 пешеходного перехода нет", [("разметки 1.14", "missing")]),
    ("знаками 1.7.1–1.7.7", [("знаками 1.7.1", "A1:1.7.1"), ("1.7.7", "missing")]),
    ("ст. 125 Кодекса Грузии об административных правонарушениях", [("ст. 125", "external")]),
    ("Слабость п. 37: четыре критерия", [("п. 37", "ambiguous")]),     # no article anywhere
    ("вне населённого пункта 150–300 м, в населённом пункте 50–100 м", []),
    ("скорость 20 км/ч (п. 5 не о том)", [("п. 5", "ambiguous")]),
]


@pytest.mark.parametrize("text,expected", RU_CASES, ids=[c[0][:40] for c in RU_CASES])
def test_russian_references(text, expected):
    assert ru(text) == expected


def test_bare_paragraph_takes_the_article_that_cites_the_same_paragraph():
    block = "ст. 34, п. 9 «г»"
    scopes = [explicit_cites(find_ru(block))]
    assert ru("при ограниченной видимости (п. 9 «д»)", scopes) == [("п. 9 «д»", "34.9.д")]


def test_the_only_article_nearby_is_not_enough():
    """«(ст. 24, п. 12). Самокат там назван прямо; в п. 87 его нет» — п. 87 is ст. 5, not ст. 24."""
    assert ru("(ст. 24, п. 12). Самокат там назван прямо; в п. 87 его нет") == [("ст. 24, п. 12", "24.12"), ("п. 87", "ambiguous")]


def test_paragraph_cited_under_two_articles_is_ambiguous():
    assert context_article("6", [[("33", "6"), ("37", "6")]]) == (None, "paragraph cited under several articles")


def test_list_items_must_agree_on_the_article():
    scopes = [[("5", "44"), ("5", "53"), ("43", "43"), ("5", "43")]]
    assert [s for _, s in ru("Скорость в «кВт/ч» (пп. 43, 44, 53)", scopes)] == ["ambiguous"] * 3


def test_law_text_resolves_bare_paragraphs_to_its_own_article():
    assert ru("определенных пунктами 17 и 18 настоящей статьи", own_article="21") == [("пунктами 17", "21.17"), ("18", "21.18")]
    assert ru("установленных пунктом 11 этой же статьи", own_article="34") == [("пунктом 11", "34.11")]


def test_law_text_naming_another_article_does_not_guess():
    """ст. 34, п. 13: «статьей 31 (кроме пункта 5)» — п. 5 belongs to ст. 31, not to ст. 34."""
    got = ru("С учетом требований, установленных статьей 31 (кроме пункта 5) настоящего Закона", own_article="34")
    assert got == [("статьей 31", "31"), ("пункта 5", "ambiguous")]


def test_this_article_inside_a_single_article_quote():
    text = "«…предусмотренных пунктами 2, 4 и 5 настоящей статьи…» (ст. 24, п. 6)"
    assert ru(text) == [("пунктами 2", "24.2"), ("4", "24.4"), ("5", "24.5"), ("ст. 24, п. 6", "24.6")]


def test_superscripts_in_law_text_are_lost_so_numbers_stay_plain():
    # Matsne prints 15² as «152»: ст. 21 has no п. 152, so it is not linked to anything
    assert ru("определенных пунктом 152 настоящей статьи", own_article="21") == [("пунктом 152 настоящей статьи", "missing")]


def ka(tid_norms, text, strict=False):
    refs = resolve_ka(find_ka(text), IDS, KA, tid_norms, strict)
    return [(r.text, r.norm if r.status == "linked" else r.status) for r in refs]


KA_CASES = [
    # ticket 1
    ("საგზაო მოძრაობის შესახებ კანონის 36-ე მუხლის მე-4 პუნქტის „გ“ ქვეპუნქტის თანახმად", ["36.4.в"],
     [("36-ე მუხლის მე-4 პუნქტის „გ“ ქვეპუნქტის", "36.4.в")]),
    # ticket 110: Georgian «ე» is the fifth letter → Russian «д»
    ("29-ე მუხლის მე-2 პუნქტის „ე“ ქვეპუნქტის", [], [("29-ე მუხლის მე-2 პუნქტის „ე“ ქვეპუნქტის", "29.2.д")]),
    # ticket 1007
    ("31-ე მუხლის მე-5 – მე-10, მე-15 და მე-16 პუნქტებით", ["31"],
     [("31-ე მუხლის მე-5", "31.5"), ("მე-10", "31.10"), ("მე-15", "31.15"), ("მე-16", "31.16")]),
    ("38-ე მუხლის პირველი პუნქტით", [], [("38-ე მუხლის პირველი პუნქტით", "38.1")]),
    ("3.16, 3.20 და 3.26 ნიშნების", [], [("3.16", "A1:3.16"), ("3.20", "A1:3.20"), ("3.26", "A1:3.26")]),
    ("1.14.1 საგზაო მონიშვნა", [], [("1.14.1", "A2:1.14.1")]),
    # implicit: needs the bank's confirmation
    ("ამ მუხლის მე-3 პუნქტით", [], [("ამ მუხლის მე-3 პუნქტით", "ambiguous")]),
    ("38-ე მუხლის ... ამავე მუხლის მე-3 პუნქტის", [], [("38-ე მუხლის", "38"), ("ამავე მუხლის მე-3 პუნქტის", "unverified")]),
    ("38-ე მუხლის ... ამავე მუხლის მე-3 პუნქტის", ["38.3"], [("38-ე მუხლის", "38"), ("ამავე მუხლის მე-3 პუნქტის", "38.3")]),
    ("პირველი დანართის 8.1.1 „მანძილი ობიექტამდე“", [], [("8.1.1", "unverified")]),
    ("პირველი დანართის 8.1.1 „მანძილი ობიექტამდე“", ["A1:8.1.1"], [("8.1.1", "A1:8.1.1")]),
    ("ადმინისტრაციულ სამართალდარღვევათა კოდექსის 125-ე მუხლის", [], [("125-ე მუხლის", "external")]),
]


@pytest.mark.parametrize("text,confirmed,expected", KA_CASES, ids=[c[0][:30] for c in KA_CASES])
def test_georgian_references(text, confirmed, expected):
    assert ka(confirmed, text) == expected


def test_unresolved_bank_citation_tickets_link_only_what_the_bank_confirms():
    """The 12 tickets whose bank citation list could not be fully resolved: nothing beyond the confirmed norms."""
    text = "1.4.1 – 1.4.3 ნიშნები … 1.41 ნიშანი"
    assert ka(["A1:1.4.1"], text, strict=True) == [("1.4.1", "A1:1.4.1"), ("1.4.3", "unverified"), ("1.41", "missing")]


def test_a_paragraph_that_exists_in_another_cited_article_stays_plain():
    """ep06: «Автобус — больше 8 сидячих мест кроме водителя (п. 1)» is ст. 5, п. 1 — but the lesson also cites ст. 43, п. 1."""
    scopes = [[("43", "1"), ("43", "12"), ("5", "28")]]
    assert ru("Автобус — больше 8 сидячих мест кроме водителя (п. 1)", scopes) == [("п. 1", "ambiguous")]
    assert ru("Дальше п. 28 перечисляет", scopes) == [("п. 28", "5.28")]          # ст. 43 has no п. 28
