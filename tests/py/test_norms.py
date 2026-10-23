"""Norms: every addressable unit of the law (article / paragraph / sub-point / annex item), RU+KA(+EN 2019)."""
import json
import re

import pytest

from pdd import paths
from pdd.norms import split_subpoints, parse_law_en, generate_norms, resolve, NORMS_JSON


def test_split_subpoints_nested():
    text = "Остановка запрещается:\nа) на проезжей части:\nа.а) на переходах;\nа.б) на путях;\nб) в любых местах."
    assert split_subpoints(text) == [("а", "а) на проезжей части:"), ("а.а", "а.а) на переходах;"),
                                     ("а.б", "а.б) на путях;"), ("б", "б) в любых местах.")]


def test_split_subpoints_georgian():
    assert [k for k, _ in split_subpoints("x:\nა) ერთი;\nა.ბ) ორი")] == ["ა", "ა.ბ"]


def test_split_subpoints_none():
    assert split_subpoints("Просто текст без подпунктов.") == []


def test_parse_law_en_2019():
    en = parse_law_en(paths.LAW_EN)
    assert en["5"]["paras"]["2"].startswith("Motorway")
    assert "63¹" in en and "47(13)" not in en and "33(7)" not in en
    assert "http" not in en["5"]["paras"]["7"]


@pytest.fixture(scope="module")
def norms():
    return generate_norms()


def test_norm_ids_and_verbatim_text(norms):
    by = {n["id"]: n for n in norms}
    law_ru = paths.LAW_RU.read_text(encoding="utf-8")
    n = by["37.6.а.а"]
    assert n["ru"].startswith("а.а) на пешеходных переходах")
    assert n["ka"].startswith("ა.ა)")
    assert n["parent"] == "37.6.а" and by["37.6.а"]["parent"] == "37.6" and by["37.6"]["parent"] == "37"
    assert " ".join(n["ru"].split()) in " ".join(law_ru.split())
    assert by["A1:5.19.1"]["kind"] == "annex"


def test_en_only_where_aligned_and_versioned(norms):
    with_en = [n for n in norms if "en" in n]
    assert with_en, "some paragraphs carry the 2019 English text"
    assert all(n["en_version"] == "2019-06-28" for n in with_en)
    assert all(n["kind"] == "law" and n.get("sub") is None for n in with_en)


def test_resolve_exact_or_group(norms):
    ids = {n["id"] for n in norms}
    assert resolve("37.6.а.а", ids) == ["37.6.а.а"]
    assert "A1:5.19.1" in resolve("A1:5.19", ids)
    assert resolve("99.1", ids) == []


def test_generated_norms_file_is_fresh(norms):
    """content/ontology/generated/norms.json == generate_norms(); rebuild with python3 tools/build.py."""
    assert json.loads(NORMS_JSON.read_text(encoding="utf-8"))["norms"] == norms


def test_annex_notes_are_norms(norms):
    """Annex notes ('Примечания: а) …') are binding text too, e.g. where warning signs stand (tickets 611/670/671)."""
    by = {n["id"]: n for n in norms}
    a = by["A1:1.прим.а"]
    assert a["kind"] == "annex" and a["parent"] == "A1:1.прим" and a["annex"] == 1
    assert a["ru"].startswith("а) знаки 1.1, 1.2, 1.5–1.34 устанавливаются вне населенного пункта на расстоянии 150–300")
    assert a["ka"].startswith("ა)")
    assert by["A1:3.прим"]["ru"].startswith("Примечание. При одновременном использовании знаков 3.29 и 3.30")
    assert by["A1:3.прим2.в.а"]["ru"].startswith("в.а) знаков 3.1–3.3")
    assert by["A2:1.прим"]["ru"].startswith("Примечание. Для обозначения горизонтальных разметок 1.1–1.11")
    assert by["A2:1.прим2"]["ru"].startswith("Примечание. Наличие разметки 1.28")
    ann = paths.ANNEX_RU.read_text(encoding="utf-8")
    assert all(n["ru"] in ann for n in norms if ".прим" in n["id"])


def test_annex_items_missing_in_russian_are_georgian_only_norms(norms):
    by = {n["id"]: n for n in norms}
    n = by["A1:3.2"]   # the Matsne RU translation skips signs 3.1 and 3.2
    assert n["ru"] is None and n["ru_missing"] is True
    assert n["ka"].startswith("3.2. „მოძრაობა აკრძალულია“")
    assert "ru_missing" not in by["A1:3.3"]
    assert by["A1:3.1"]["ru"] is None      # not the picture-caption row "3.1  3.2  3.3  3.4"
    assert all(n["ru"] is None or re.search(r"[А-Яа-яЁё]", n["ru"]) for n in norms if n["kind"] == "annex")
