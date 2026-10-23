"""Permanent ids of norms: ontology id ⇄ URL slug, citation label, lazy-chunk name.

Scheme (docs/norm/<slug>.html; README "Постоянные ссылки на нормы"):
  article            5 → st5,        11¹ → st11_1
  paragraph          5.13 → st5-p13, 21.3¹ → st21-p3_1, 21.15^2 → st21-p15_2
  sub-point          37.6.а.а → st37-p6-a-a   (Russian letters transliterated)
  annex 1 (signs)    A1:5.26 → sign-5.26
  annex 2 (marking)  A2:1.14.1 → mark-1.14.1
  annex notes        A1:3.прим2.ж.в → sign-3-notes2-zh-v
Slugs are frozen in tests/py/fixtures/norm_slugs.tsv: a published slug never changes meaning."""
import re

from pdd import paths

SLUG_SNAPSHOT = paths.REPO / "tests/py/fixtures/norm_slugs.tsv"
TRANSLIT = dict(zip("абвгдежзиклмнопрстуфхцчшэюя",
                    "a b v g d e zh z i k l m n o p r s t u f kh ts ch sh ee yu ya".split()))
_SUP = {"¹": "1", "²": "2", "³": "3", "⁴": "4"}
_SUP_SHOW = {"^2": "²", "^3": "³", "^4": "⁴"}
ANNEX = {"1": "sign", "2": "mark"}


def _num(s: str) -> str:
    """'11¹' → '11_1', '15^2' → '15_2'."""
    s = s.replace("^", "_")
    for k, v in _SUP.items():
        s = s.replace(k, "_" + v)
    return s


def slug(norm_id: str) -> str:
    if norm_id.startswith("A"):
        annex, item = norm_id[1:].split(":", 1)
        head = ANNEX[annex]
        m = re.fullmatch(r"(\d+)\.прим(\d*)((?:\.[а-я])*)", item)
        if m:
            letters = "".join("-" + TRANSLIT[c] for c in m.group(3).split(".") if c)
            return f"{head}-{m.group(1)}-notes{m.group(2)}{letters}"
        return f"{head}-{item}"
    art, *rest = norm_id.split(".")
    out = "st" + _num(art)
    if rest:
        out += "-p" + _num(rest[0])
        out += "".join("-" + TRANSLIT[c] for c in rest[1:])
    return out


def norm_of_slug(ids) -> dict:
    return {slug(i): i for i in ids}


def chunk_of(s: str) -> str:
    """Name of the lazily loaded JSON chunk holding a norm: its article, or its annex section."""
    if s.startswith("st"):
        return s.split("-", 1)[0]
    head, rest = s.split("-", 1)
    return f"{head}-{re.match(r'\d+', rest).group(0)}"


def _show(num: str) -> str:
    for k, v in _SUP_SHOW.items():
        num = num.replace(k, v)
    return num


def citation(n: dict) -> str:
    """Short Russian citation, as the lessons write it: 'ст. 37, п. 6 «а.а»', 'знак 5.26'."""
    nid = n["id"]
    if nid.startswith("A"):
        annex, item = nid[1:].split(":", 1)
        m = re.fullmatch(r"(\d+)\.прим(\d*)((?:\.[а-я])*)", item)
        if m:
            out = f"прил. {annex}, разд. {m.group(1)}, примечание" + (f" {m.group(2)}" if m.group(2) else "")
            letters = m.group(3).lstrip(".")
            return out + (f" «{letters}»" if letters else "")
        return ("знак " if annex == "1" else "разметка ") + item
    art, *rest = nid.split(".")
    out = f"ст. {art}"
    if rest:
        out += f", п. {_show(rest[0])}"
        if rest[1:]:
            out += f" «{'.'.join(rest[1:])}»"
    return out
