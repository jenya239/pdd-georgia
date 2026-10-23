"""Repository paths for the video engine (no absolute paths in episode code)."""
from pathlib import Path

ENGINE = Path(__file__).resolve().parent
VIDEO = ENGINE.parent
REPO = VIDEO.parent
SOURCES = REPO / "data" / "sources"
TICKETS = REPO / "data" / "tickets"
SIGNS = REPO / "content" / "assets" / "signs"
