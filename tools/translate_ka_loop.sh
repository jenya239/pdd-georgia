#!/usr/bin/env bash
# Resumable wrapper around tools/translate_ka.py (free web translator rate-limits and drops requests).
# The script skips texts already in content/translations/explanations_ru.json, so restart until "errors: 0".
#   PYTHON  interpreter with the `translators` package (pip install -r requirements-translate.txt)
#   TRIES   max restarts (default 20), PAUSE seconds between restarts (default 120)
# Afterwards: python3 tools/build.py && tools/check.sh
set -uo pipefail
cd "$(dirname "$0")/.."
PY=${PYTHON:-python3}
LOG=$(mktemp -t translate_ka.XXXXXX.log)
for i in $(seq 1 "${TRIES:-20}"); do
  "$PY" -u tools/translate_ka.py "$@" 2>&1 | tee "$LOG"
  grep -q "errors: 0" "$LOG" && { echo "ALL TRANSLATED (log: $LOG)"; exit 0; }
  echo "=== restart $i after failures; sleeping ${PAUSE:-120}s"; sleep "${PAUSE:-120}"
done
echo "still untranslated texts after ${TRIES:-20} runs (log: $LOG)"; exit 1
