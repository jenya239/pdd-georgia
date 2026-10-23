"""Written breakdowns («Разбор») for bank tickets: schema, verbatim quotes, linked norm refs, ontology mapping."""
import copy
import json

import pytest

from pdd import breakdowns, ontology
from pdd.paths import DOCS

GOOD = {
    "ticket": 884,
    "steps": ["Вопрос — определение из ст. 5, п. 9.", "Закон: разделительная полоса — конструктивно выделенный элемент, разделяющий смежные проезжие части.",
              "Это вариант 3: его формулировка совпадает с определением почти дословно; ехать по такой полосе безрельсовым ТС нельзя."],
    "quotes": [{"norm": "5.9", "text": "конструктивно выделенный элемент дороги, разделяющий смежные проезжие части"}],
    "why_not": {"0": {"text": "Это описание проезжей части (ст. 5, п. 15), а не разделительной полосы — по ней как раз ездят.", "mc": "mc-road-elements"},
                "1": {"text": "Это определение полосы движения (ст. 5, п. 45): её отмечают разметкой, а разделительную полосу строят.", "mc": "mc-road-elements"}},
    "trap": "Все три варианта звучат как «часть дороги»; отличает только слово «конструктивно».",
    "concepts": ["dividing-strip"],
}


@pytest.fixture(scope="module")
def world():
    return ontology.load_world()


def errs(world, **change):
    b = copy.deepcopy(GOOD)
    b.update(change)
    return breakdowns.validate([b], world)


def test_good_breakdown_passes(world):
    assert breakdowns.validate([GOOD], world) == []


def test_quote_must_be_verbatim(world):
    assert errs(world, quotes=[{"norm": "5.9", "text": "любая полоса дороги"}])


def test_steps_two_or_three(world):
    assert errs(world, steps=GOOD["steps"][:1])
    assert errs(world, steps=GOOD["steps"] * 2)


def test_why_not_covers_exactly_the_wrong_options(world):
    assert errs(world, why_not={"0": GOOD["why_not"]["0"]})
    assert errs(world, why_not={**GOOD["why_not"], "2": {"text": "правильный", "mc": None}})


def test_misconception_must_match_the_ontology(world):
    wn = copy.deepcopy(GOOD["why_not"])
    wn["0"]["mc"] = "mc-oncoming-side"
    assert errs(world, why_not=wn)
    wn["0"]["mc"] = "mc-no-such"
    assert errs(world, why_not=wn)


def test_concepts_known_and_introduced_by_the_lesson(world):
    assert errs(world, concepts=["no-such-concept"])
    assert errs(world, concepts=["moped"])          # introduced only in ep06; ticket 884 is ep02


def test_every_norm_reference_resolves(world):
    assert errs(world, trap="См. ст. 99, п. 99.")


def test_length_is_concise(world):
    assert errs(world, trap="слово " * 200)


def test_ticket_must_be_assigned(world):
    assert errs(world, ticket=999999)


def test_repository_breakdowns_are_valid_and_varied(world):
    items = breakdowns.load()
    assert len(items) == 10 and breakdowns.validate(items, world) == []
    lessons = {world.derive_assignment()["assigned"][b["ticket"]] for b in items}
    assert lessons == {"ep02", "ep03", "ep04", "ep05", "ep06"}


def test_built_tickets_carry_linked_breakdowns():
    D = json.loads((DOCS / "data/tickets.json").read_text(encoding="utf-8"))
    with_br = [t for t in D["tickets"] if t.get("br")]
    assert sorted(t["id"] for t in with_br) == sorted(b["ticket"] for b in breakdowns.load())
    for t in with_br:
        br = t["br"]
        assert br["lesson"]["id"] == t["lesson"] and br["lesson"]["title"]
        assert all(q["n"] and q["ref"].startswith(("ст.", "Прил")) for q in br["quotes"])
        assert {w["i"] for w in br["why_not"]} == set(range(len(t["a"]["ru"]))) - {t["c"]}
        assert br["concepts"] and all(isinstance(c, str) for c in br["concepts"])
