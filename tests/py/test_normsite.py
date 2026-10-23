"""Permanent norm pages + auto-links in the built site."""
import json
import re

import pytest

from pdd import paths
from pdd.build import generate, links_report
from pdd.normids import slug, chunk_of
from pdd.normlink import Linker, utf16

NORMS = {n["id"]: n for n in json.loads((paths.REPO / "content/ontology/generated/norms.json").read_text(encoding="utf-8"))["norms"]}
SLUGS = {slug(i) for i in NORMS}


@pytest.fixture(scope="module")
def files():
    f, copies, _ = generate()
    return {k: (v.decode() if isinstance(v, bytes) else v) for k, v in f.items()}, copies


def test_one_page_per_norm_plus_index(files):
    f, _ = files
    pages = {k[5:-5] for k in f if re.fullmatch(r"norm/[^/]+\.html", k)}
    assert pages == SLUGS | {"index"}
    assert len(SLUGS) == len(NORMS) == 1459


def _targets(html):
    return re.findall(r'href="([^"#?]+\.html)', html)


def test_every_norm_link_in_the_site_points_to_an_existing_page(files):
    f, _ = files
    n = 0
    for name, html in f.items():
        if not name.endswith(".html"):
            continue
        # lesson fragments (lessons/*.html) are injected into episode.html at the site root
        base = name.rsplit("/", 1)[0] + "/" if "/" in name and not name.startswith("lessons/") else ""
        for a in re.findall(r'<a class="nref" href="([^"]+)" data-norm="([^"]+)"', html):
            n += 1
            href, s = a
            assert s in SLUGS, (name, s)
            path = re.sub(r"[^/]+/\.\./", "", base + href)
            assert path == f"norm/{s}.html" and path in f, (name, href)
    assert n > 1000


def test_internal_links_on_norm_pages_resolve(files):
    f, copies = files
    for name, html in f.items():
        if name.startswith("norm/") and name.endswith(".html"):
            for href in _targets(html):
                if href.startswith("http"):
                    continue
                path = re.sub(r"[^/]+/\.\./", "", "norm/" + href)
                assert path in f or path in copies, (name, href)


def _annotated(obj, out):
    if isinstance(obj, dict):
        for f, spans in (obj.get("_r") or {}).items():
            out.append((obj[f], spans))
        for v in obj.values():
            _annotated(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _annotated(v, out)
    return out


@pytest.mark.parametrize("data", ["data/tickets.json", "data/items.json", "data/episodes.json"])
def test_data_annotations_are_valid_utf16_spans_to_existing_norms(files, data):
    f, _ = files
    found = _annotated(json.loads(f[data]), [])
    assert found, data
    for text, spans in found:
        u = text.encode("utf-16-le")
        last = 0
        for a, b, s in spans:
            assert s in SLUGS and last <= a < b <= len(u) // 2, (text, spans)
            frag = u[2 * a:2 * b].decode("utf-16-le")
            assert frag.strip() == frag != "" and not frag[-1] in ",.;", frag   # spans sit on the reference itself
            last = b


def test_chunks_cover_every_norm_once(files):
    f, _ = files
    seen = {}
    for name, body in f.items():
        if name.startswith("norm/chunks/"):
            for s, e in json.loads(body).items():
                assert chunk_of(s) == name[12:-5], s
                assert s not in seen
                seen[s] = e
                assert e["c"] and (e["ru"] or e.get("ka")), s
    assert set(seen) == SLUGS
    assert seen["st5-p87"]["ru"] == NORMS["5.87"]["ru"]
    assert seen["sign-5.19.1"]["img"] == "img/sign_5_19_1.png"
    assert max(len(b) for n, b in f.items() if n.startswith("norm/chunks/")) < 120_000


def test_norm_page_content(files):
    f, _ = files
    p = f["norm/st37-p6-a-a.html"]
    assert "ст. 37, п. 6 «а.а»" in p
    assert NORMS["37.6.а.а"]["ru"][:60] in p.replace("&quot;", '"')
    assert "matsne.gov.ge" in p and "Где это в курсе" in p
    assert 'href="st37-p6-a.html"' in p               # parent
    sign = f["norm/sign-5.19.1.html"]
    assert 'src="img/sign_5_19_1.png"' in sign
    art = f["norm/st5.html"]
    assert art.count("<li") >= 100                     # all paragraphs of the article


def test_backlinks_reach_lessons_items_and_tickets(files):
    f, _ = files
    p = f["norm/st5-p87.html"]
    assert "../episode.html?id=ep05" in p and "../practice.html?ids=o-ep05" in p
    tickets = [s for s in SLUGS if "Билеты" in f[f"norm/{s}.html"]]
    assert len(tickets) > 100


def test_index_lists_every_norm(files):
    f, _ = files
    idx = f["norm/index.html"]
    assert len(re.findall(r'<li class="d\d" data-id=', idx)) == len(NORMS)
    assert 'id="nq"' in idx


def test_links_report_is_committed_fresh():
    assert (paths.REPO / "content/ontology/generated/links.json").read_text(encoding="utf-8") == links_report()


def test_wrong_links_are_never_made():
    """Decisions a reviewer flagged: these strings in the content must stay plain."""
    rep = json.loads(links_report())
    linked = "\n".join(x for v in rep["linked"].values() for x in v)
    assert "| п. 1 → 43.1" not in linked             # ep06 «Автобус … (п. 1)» is ст. 5
    assert "→ 24.87" not in linked and "| пункта 5 → 34.5" not in linked
    for ctype in ("lessons", "episodes", "own_items", "typical_errors", "misconceptions"):
        assert rep["stats"][ctype]["linked"] > 0


def test_lesson_html_links_text_but_not_svg_or_existing_links():
    L = Linker(NORMS)
    html = ('<p>См. ст. 5, п. 87 и <a href="x">ст. 5, п. 1</a>.</p><svg><text>ст. 5, п. 2</text></svg>'
            '<blockquote>«…пешком…» <cite>ст. 5, п. 87</cite></blockquote>')
    out = L.lesson_html("lessons", "t", html, href_prefix="norm/")
    assert out.count('class="nref"') == 2
    assert '<a class="nref" href="norm/st5-p87.html" data-norm="st5-p87">ст. 5, п. 87</a> и <a href="x">' in out
    assert "<text>ст. 5, п. 2</text>" in out


def test_ru_fields_spans_are_utf16():
    L = Linker(NORMS)
    obj = {"t": "🚗 см. знак 5.26"}
    L.ru_fields("x", "k", obj, ["t"])
    a, b, s = obj["_r"]["t"][0]
    assert s == "sign-5.26" and a == utf16(obj["t"], obj["t"].index("знак")) == 7 and b == a + 9
