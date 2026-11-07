import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { backlinkModel } from "../../packages/build/backlinks.ts";
import { dumps, parse } from "../../packages/build/pyjson.ts";
import { loadWorld } from "../../tools/load-ontology.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("backlinks match the Python norm model for every norm", () => {
  const oracle = pythonModel();
  const got = dumps(backlinkModel(input()));
  const right = dumps(parse(oracle));
  assert.equal(got === right, true, mismatch(got, right));
});

function input() {
  const world = loadWorld(root);
  const norms = JSON.parse(readFileSync(path.join(root, "content/ontology/generated/norms.json"), "utf8")).norms.map((norm) => norm.id);
  const items = JSON.parse(readFileSync(path.join(root, "site/data/items.json"), "utf8")).items.map((item) => ({
    id: item.id,
    q: item.q,
    quoteSlug: item.quote.n ?? null,
  }));
  const linked = parse(readFileSync(path.join(root, "content/ontology/generated/links.json"), "utf8")).get("linked");
  const mentions = [];
  for (const [type, lines] of linked) {
    for (const line of lines) {
      const bar = line.indexOf(" | ");
      const arrow = line.lastIndexOf(" → ");
      mentions.push({ type, key: line.slice(0, bar), norm: line.slice(arrow + " → ".length) });
    }
  }
  return {
    norms,
    lessons: world.lessonOrder.map((id) => ({
      id,
      num: world.episode(id).num,
      teaches: world.teaches(id),
      quoted: world.quoted(id),
    })),
    introduced: world.introducedIn(),
    concepts: Object.values(world.concepts).map((concept) => ({ id: concept.id, label: concept.label, norms: concept.norms || [] })),
    misconceptions: Object.values(world.misconceptions).map((item) => ({ belief: item.belief, truth: item.truth, norms: item.norms || [] })),
    tickets: [...world.questions.keys()].sort((a, b) => a - b).map((id) => ({ id, norms: world.ticketNorms(id).norms })),
    items,
    mentions,
  };
}

function pythonModel() {
  const script = `
import json, sys
from pdd import build
captured = {}
orig = build.normsite.norm_files
def wrap(*args, **kwargs):
    model, copies, site = orig(*args, **kwargs)
    captured["model"] = model
    return model, copies, site
build.normsite.norm_files = wrap
build.generate()
json.dump(captured["model"], sys.stdout, ensure_ascii=False)
`;
  const proc = spawnSync(path.join(root, ".venv/bin/python"), ["-c", script], {
    cwd: root,
    env: { ...process.env, PYTHONPATH: "tools" },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(proc.status, 0, proc.stderr?.slice(0, 500) || proc.stdout?.slice(0, 500));
  return proc.stdout;
}

function mismatch(left, right) {
  const n = Math.min(left.length, right.length);
  let i = 0;
  while (i < n && left[i] === right[i]) i += 1;
  return `${left.length}/${right.length} at ${i}: ${JSON.stringify(left.slice(i, i + 180))} <> ${JSON.stringify(right.slice(i, i + 180))}`;
}
