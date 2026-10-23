"""Course plan (content/plan/structure.md, section 4) -> list of planned episodes (pure)."""
import re

_ROW = re.compile(r"^\| (E\d{3})(?:–(E\d{3}))? \| (\d+) \| ([^|]+) \| ([^|]+) \|", re.M)


def parse_plan(md: str) -> list:
    sec = md.split("## 4.")[1]
    plan = []
    for m in _ROW.finditer(sec):
        a, b = int(m.group(1)[1:]), int((m.group(2) or m.group(1))[1:])
        n = b - a + 1
        for i, e in enumerate(range(a, b + 1)):
            plan.append({"e": "E%03d" % e, "block": int(m.group(3)),
                         "title": m.group(4).strip() + (f" ({i+1}/{n})" if n > 1 else ""), "src": m.group(5).strip()})
    return plan
