"""The published tree (docs/) is a pure function of the repository; it must be committed fresh."""
import re
from pathlib import Path

import pytest

from pdd import paths
from pdd.build import generate, expected_tree, diff_tree


@pytest.fixture(scope="module")
def built():
    files, copies, report = generate()
    return files, copies, report, expected_tree(files, copies)


def test_build_reads_only_inside_repo():
    for name in dir(paths):
        v = getattr(paths, name)
        if isinstance(v, Path):
            assert paths.REPO in (v, *v.parents), name


def test_no_missing_files(built):
    assert built[2]["missing_files"] == []


def test_docs_is_fresh(built):
    """Fails when sources changed but `python3 tools/build.py` was not run."""
    assert diff_tree(paths.DOCS, built[3]) == []


def test_pages_have_no_inline_scripts(built):
    files = built[0]
    for name, data in files.items():
        if name.endswith(".html") and "/" not in name:
            html = data.decode() if isinstance(data, bytes) else data
            assert re.findall(r"<script(?![^>]*\bsrc=)[^>]*>", html) == [], name
            assert 'type="module"' in html, name


def test_published_episode_data_has_no_source_only_keys(built):
    import json
    E = json.loads(built[0]["data/episodes.json"])
    for r in E["released"]:
        assert not {"include", "exclude", "ticket_refs", "teaches"} & set(r), r["id"]


def test_own_items_are_published_and_listed_per_episode(built):
    import json
    data = json.loads(built[0]["data/items.json"])
    ids = [i["id"] for i in data["items"]]
    assert len(ids) == len(set(ids)) >= 4
    E = json.loads(built[0]["data/episodes.json"])
    by_ep = {r["id"]: r.get("own_items", []) for r in E["released"]}
    for lid in ("ep01", "ep02", "ep03", "ep04"):
        assert by_ep[lid] and all(i.startswith(f"o-{lid}-") for i in by_ep[lid])
    assert sorted(i for v in by_ep.values() for i in v) == sorted(ids)
