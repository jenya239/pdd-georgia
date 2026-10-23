from pdd.plan import parse_plan
from pdd import paths


def test_course_plan_has_107_numbered_series():
    plan = parse_plan(paths.PLAN_MD.read_text(encoding="utf-8"))
    assert len(plan) == 107
    assert [p["e"] for p in plan[:3]] == ["E001", "E002", "E003"]
    assert all(p["title"] for p in plan)
