"""Text lessons: quotes are verbatim from the vendored law text; SVG ids are unique and referenced ids exist."""
import html as H
import re

import pytest

from pdd import paths
from pdd.build import load_lesson

LESSONS = sorted(d.name for d in paths.LESSONS.iterdir() if (d / "lesson.py").exists())


def norm(s):
    # PDF->TXT wraps lines after a hyphen ("стоп-\nлинией"): keep the hyphen, drop the break
    return re.sub(r"\s+", " ", re.sub(r"-\n", "-", H.unescape(s))).strip()


@pytest.fixture(scope="module")
def law_text():
    return norm(paths.LAW_RU.read_text(encoding="utf-8")) + " " + norm(paths.ANNEX_RU.read_text(encoding="utf-8"))


@pytest.fixture(scope="module", params=LESSONS)
def lesson(request):
    return request.param, load_lesson(paths.LESSONS / request.param).render()


def test_block_quotes_verbatim(lesson, law_text):
    _, html = lesson
    bq = re.findall(r'<blockquote class="lq"[^>]*><p>(.*?)</p>', html, re.S)
    assert len(bq) >= 6
    bad = [p[:90] for q in bq for p in re.split(r"\s*…\s*", norm(re.sub(r"<[^>]+>", "", q)).strip("«»"))
           if p and p.rstrip(";.") not in law_text]
    assert bad == []


def test_inline_cited_quotes_verbatim(lesson, law_text):
    text = norm(re.sub(r"<[^>]+>", "", lesson[1]))
    inl = [m.group(1) for m in re.finditer(r"«([^«»]{25,})»[^«»]{0,40}?\((?:ст\.|прил\.)", text)]
    miss = [q[:80] for q in inl if any(p.strip().rstrip(";.,") not in law_text for p in q.split("…") if p.strip())]
    assert miss == []


def test_svg_ids_unique_and_refs_resolve(lesson):
    name, html = lesson
    ids = re.findall(r'\sid="([^"]+)"', html)
    assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
    for svg in re.findall(r"<svg.*?</svg>", html, re.S):
        local = set(re.findall(r'\sid="([^"]+)"', svg))
        refs = set(re.findall(r"url\(#([^)]+)\)", svg))
        assert refs <= local, refs - local
    defs = [i for i in ids if re.search(r"<(marker|pattern|linearGradient|clipPath)[^>]*id=\"" + re.escape(i), html)]
    assert all(i.startswith(name + "-") for i in defs), defs
