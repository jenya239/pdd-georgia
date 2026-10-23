#!/usr/bin/env python3
"""Single entry point of the video pipeline.

usage: python video/render.py <ep01|ep02|…> [tts|video|all|still T [T…]|sheet]
  tts    edge-tts per sentence (cached) + assemble voice.wav and timeline.json
  video  music, subtitles, frames -> seg/*.mp4, final.mp4 (needs timeline.json + audio/voice.wav)
  all    tts + video
  still  render single frames at the given seconds into stills/ (no audio needed)
  sheet  contact sheets of stills/
Outputs stay in video/episodes/<ep>/ and are git-ignored; publish by copying final.mp4 to content/media/<ep>.mp4.
Run with the video venv (numpy, pillow, matplotlib, edge-tts), e.g. /workspace/.videovenv/bin/python.
"""
import os
import subprocess
import sys
from pathlib import Path

VIDEO = Path(__file__).resolve().parent
ENGINE = VIDEO / "engine"
STEPS = {
    "tts": ["tts.py", "assemble.py"],
    "video": ["music.py", "subs.py", "@clean-seg", "core.py", "@final"],
}
STEPS["all"] = STEPS["tts"] + STEPS["video"]


def episode_dir(ep: str) -> Path:
    d = VIDEO / "episodes" / ep
    if not (d / "scenes.py").exists():
        sys.exit(f"unknown episode {ep!r}: {d} has no scenes.py")
    return d


def run(ep: str, step: str, extra=()):
    d = episode_dir(ep)
    for sub in ("audio", "seg", "stills"):
        (d / sub).mkdir(exist_ok=True)
    env = {**os.environ, "PYTHONPATH": os.pathsep.join([str(ENGINE), str(d)])}

    def py(script, *args):
        subprocess.run([sys.executable, str(ENGINE / script), *args], cwd=d, env=env, check=True)

    if step == "still":
        return py("core.py", "still", *extra)
    if step == "sheet":
        return py("sheet.py", *(extra or [ep]))
    for s in STEPS[step]:
        if s == "@clean-seg":
            for f in (d / "seg").glob("*.mp4"):
                f.unlink()
        elif s == "@final":
            subprocess.run(["bash", str(ENGINE / "final.sh")], cwd=d, check=True)
        else:
            py(s)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "all", sys.argv[3:])
