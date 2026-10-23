"""Video engine regression: frames rendered now are pixel-identical to the committed baselines.

Needs the video venv (numpy, pillow, matplotlib) and the fonts used by the engine; skipped otherwise.
Set VIDEO_PYTHON to that interpreter (default /workspace/.videovenv/bin/python).
"""
import os
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
BASE = Path(__file__).parent / "baseline"
PY = os.environ.get("VIDEO_PYTHON", "/workspace/.videovenv/bin/python")
CASES = [(d.name, f.name) for d in sorted(BASE.iterdir()) for f in sorted(d.glob("t*.png"))]

pytestmark = pytest.mark.skipif(not Path(PY).exists() or not Path("/usr/share/fonts/truetype/sand-box").exists(),
                                reason="video venv / engine fonts not available")


@pytest.mark.parametrize("ep,still", CASES)
def test_still_matches_baseline(ep, still):
    t = still[1:-4].lstrip("0") or "0"
    out = REPO / "video" / "episodes" / ep / "stills" / still
    out.unlink(missing_ok=True)
    subprocess.run([PY, str(REPO / "video" / "render.py"), ep, "still", t], check=True, capture_output=True)
    code = ("import sys; from PIL import Image, ImageChops; a, b = (Image.open(p).convert('RGB') for p in sys.argv[1:]);"
            "sys.exit(1 if ImageChops.difference(a, b).getbbox() else 0)")
    assert subprocess.run([PY, "-c", code, str(out), str(BASE / ep / still)]).returncode == 0, f"{ep} {still} differs"
