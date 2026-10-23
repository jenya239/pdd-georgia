#!/usr/bin/env python3
"""Entry point: python3 tools/build.py [--check] [--out=DIR]. See tools/pdd/build.py."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pdd.build import main  # noqa: E402

sys.exit(main())
