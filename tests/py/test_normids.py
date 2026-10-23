"""Permanent norm ids: one stable, human-readable slug per norm (docs/norm/<slug>.html)."""
import json

import pytest

from pdd import paths
from pdd.normids import slug, norm_of_slug, chunk_of, citation, SLUG_SNAPSHOT

NORMS = json.loads((paths.REPO / "content/ontology/generated/norms.json").read_text(encoding="utf-8"))["norms"]


@pytest.mark.parametrize("nid, want", [
    ("5", "st5"), ("11¹", "st11_1"), ("46¹", "st46_1"),
    ("5.13", "st5-p13"), ("21.3¹", "st21-p3_1"), ("21.15^2", "st21-p15_2"),
    ("37.6.а", "st37-p6-a"), ("37.6.а.а", "st37-p6-a-a"), ("36.4.в", "st36-p4-v"), ("37.1.ж", "st37-p1-zh"),
    ("A1:5.26", "sign-5.26"), ("A1:5.19.1", "sign-5.19.1"), ("A2:1.14.1", "mark-1.14.1"),
    ("A1:1.прим", "sign-1-notes"), ("A1:3.прим2", "sign-3-notes2"), ("A1:1.прим.б", "sign-1-notes-b"),
    ("A1:3.прим2.ж.в", "sign-3-notes2-zh-v"), ("A2:1.прим2", "mark-1-notes2"),
])
def test_slug_scheme(nid, want):
    assert slug(nid) == want


def test_slugs_unique_and_url_safe():
    s = [slug(n["id"]) for n in NORMS]
    assert len(set(s)) == len(s) == len(NORMS)
    assert all(x.isascii() and all(c.isalnum() or c in "-._" for c in x) for x in s)


def test_slug_inverse():
    ids = [n["id"] for n in NORMS]
    back = norm_of_slug(ids)
    assert all(back[slug(i)] == i for i in ids)


def test_slugs_stable_against_snapshot():
    """Published permalinks never move: every slug ever shipped still names the same norm."""
    current = {slug(n["id"]): n["id"] for n in NORMS}
    rows = [l.split("\t") for l in SLUG_SNAPSHOT.read_text(encoding="utf-8").splitlines() if l and not l.startswith("#")]
    assert len(rows) >= 1459
    moved = [(s, i, current.get(s)) for s, i in rows if current.get(s) != i]
    assert not moved, moved[:5]


@pytest.mark.parametrize("s, want", [("st5-p13", "st5"), ("st11_1-p2", "st11_1"), ("st11_1", "st11_1"),
                                     ("sign-5.26", "sign-5"), ("sign-1-notes-b", "sign-1"), ("mark-1.14.1", "mark-1")])
def test_chunk_of(s, want):
    assert chunk_of(s) == want


def test_citation():
    by = {n["id"]: n for n in NORMS}
    assert citation(by["5"]) == "ст. 5"
    assert citation(by["5.13"]) == "ст. 5, п. 13"
    assert citation(by["37.6.а.а"]) == "ст. 37, п. 6 «а.а»"
    assert citation(by["21.15^2"]) == "ст. 21, п. 15²"
    assert citation(by["A1:5.26"]) == "знак 5.26"
    assert citation(by["A2:1.14.1"]) == "разметка 1.14.1"
    assert citation(by["A1:1.прим.б"]) == "прил. 1, разд. 1, примечание «б»"
    assert citation(by["A1:3.прим2"]) == "прил. 1, разд. 3, примечание 2"
