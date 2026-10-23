"""Data behind the post-answer «Нормы» tab: per ticket / own item the checked and context norms
(slug + citation), the course concepts, and the lesson names (docs/data/*.json)."""
import json

from pdd import paths
from pdd.build import norm_refs
from pdd.ontology import load_world

DATA = paths.DOCS / "data"


def _load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def test_norm_refs_are_slug_and_citation_pairs_in_order():
    w = load_world()
    assert norm_refs(w, ["36.4.в", "5.37"]) == [["st36-p4-v", "ст. 36, п. 4 «в»"], ["st5-p37", "ст. 5, п. 37"]]


def test_bank_ticket_carries_main_and_context_norms_and_concepts():
    D = _load("tickets.json")
    t = {x["id"]: x for x in D["tickets"]}[54]
    assert t["nm"]["m"][0] == ["st36-p4-v", "ст. 36, п. 4 «в»"]
    assert ["st5-p37", "ст. 5, п. 37"] in t["nm"]["m"]
    assert {"main-road", "right-hand-rule"} <= set(t["cn"])
    assert all(c in D["meta"]["concepts"] for x in D["tickets"] for c in x.get("cn", []))
    assert D["meta"]["lessons"]["ep03"].startswith("Выпуск 3.")
    ctx = [x for x in D["tickets"] if x.get("nm", {}).get("x")]
    assert ctx, "annotated context norms are exported"


def test_own_items_carry_their_norms_and_concepts():
    I = _load("items.json")["items"]
    it = {x["id"]: x for x in I}["o-ep01-01"]
    assert ["st1-p2", "ст. 1, п. 2"] in it["nm"]["m"]
    assert it["cn"]
