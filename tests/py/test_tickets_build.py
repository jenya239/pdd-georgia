"""The committed ticket database is exactly what the ticket pipeline produces from parsed_all.json + manual_fixes.json."""
import subprocess
import sys

from pdd.paths import REPO, TICKETS


def test_build_tickets_is_reproducible(tmp_path):
    subprocess.run([sys.executable, str(REPO / "tools/pdd/tickets/build_tickets.py"), f"--out={tmp_path}"],
                   check=True, capture_output=True)
    for name in ("tickets_ru.json", "stats.json"):
        assert (tmp_path / name).read_bytes() == (TICKETS / name).read_bytes(), name
