/** Prints one plain lesson edition. Figures come from that lesson's figs.py when it exists. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lessonId = process.argv[2];
if (!/^ep\d+$/.test(lessonId || "")) {
  console.error("usage: node tools/render-plain-lesson.mjs epNN");
  process.exit(2);
}

const dir = join(root, "content/lessons", lessonId);
const figsPath = join(dir, "figs.py");
let figs = {};
if (existsSync(figsPath)) {
  const py = process.env.PYTHON || (existsSync(join(root, ".venv/bin/python")) ? join(root, ".venv/bin/python") : "python3");
  const code = `
import importlib.util, json, sys
from pathlib import Path
d = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("lesson_figs", d / "figs.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
out = {name: getattr(mod, name)() for name in dir(mod) if name.startswith("fig_")}
json.dump(out, sys.stdout, ensure_ascii=False)
`;
  const run = spawnSync(py, ["-c", code, dir], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (run.status !== 0) {
    console.error(run.stderr || run.stdout || "figure render failed");
    process.exit(run.status || 1);
  }
  figs = JSON.parse(run.stdout);
}

const mod = await import(pathToFileURL(join(dir, "plain.mjs")).href);
process.stdout.write(mod.render(figs));
