#!/usr/bin/env bash
# Everything that must be green before a commit: unit tests, build freshness, browser test.
#   Node.js 24.22+ (Active LTS; .nvmrc). Domain tests are Node. `nvm use` runs if the shell is older.
#   PYTHON     interpreter with pytest            (default: python3)
#   E2E_PYTHON interpreter with playwright        (default: $PYTHON; set E2E=0 to skip)
#   VIDEO_PYTHON interpreter of the video venv    (video still tests skip without it)
# Python still builds the pages and the browser test. The ontology report and the
# ticket-to-lesson assignment come from Node (tools/ontology-report.mjs).
# New code is Node; do not add Python.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PYTHON:-python3}

node_ok() {
  node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major === 24 && minor >= 22 ? 0 : 1)'
}
if ! node_ok; then
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    nvm use >/dev/null
  fi
fi
if ! node_ok; then
  echo "Node.js 24.22+ (Active LTS) required, got $(node -v 2>/dev/null || echo none)" >&2
  exit 1
fi

echo "== node: domain modules";      node --test tests/js/*.test.mjs
echo "== pytest: build, ontology, lessons, video"; "$PY" -m pytest -q tests/py tests/video
echo "== build: docs/ is up to date"; "$PY" tools/build.py --check
if [ "${E2E:-1}" != 0 ]; then
  echo "== e2e: headless browser on docs/"; "${E2E_PYTHON:-$PY}" tests/e2e/site_e2e.py
fi
echo "ALL GREEN"
