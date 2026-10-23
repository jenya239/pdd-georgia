#!/usr/bin/env bash
# Everything that must be green before a commit: unit tests, build freshness, browser test.
#   PYTHON     interpreter with pytest            (default: python3)
#   E2E_PYTHON interpreter with playwright        (default: $PYTHON; set E2E=0 to skip)
#   VIDEO_PYTHON interpreter of the video venv    (video still tests skip without it)
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PYTHON:-python3}
echo "== node: domain modules";      node --test tests/js
echo "== pytest: build, ontology, lessons, video"; "$PY" -m pytest -q tests/py tests/video
echo "== build: docs/ is up to date"; "$PY" tools/build.py --check
if [ "${E2E:-1}" != 0 ]; then
  echo "== e2e: headless browser on docs/"; "${E2E_PYTHON:-$PY}" tests/e2e/site_e2e.py
fi
echo "ALL GREEN"
