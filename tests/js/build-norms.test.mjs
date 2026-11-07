import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slug } from "../../packages/lesson/slug.ts";
import { readOracle } from "./helpers/golden.mjs";
import { normsJson } from "../../tools/build-norms.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function pythonDump() {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "pdd-norms-")), "norms.json");
  const script = `
import json
from pdd.norms import generate_norms
json.dump(generate_norms(), open(${JSON.stringify(file)}, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
`;
  const run = spawnSync(".venv/bin/python", ["-c", script], {
    cwd: root,
    env: { ...process.env, PYTHONPATH: "tools" },
    encoding: "utf8",
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout);
  return readOracle(file);
}

function slugRows() {
  return readOracle("tests/py/fixtures/norm_slugs.tsv")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("\t"));
}

test("norm list matches Python and the frozen slug ids", () => {
  const oracle = pythonDump();
  const got = normsJson();
  assert.equal(got === oracle, true, mismatch(got, oracle));
  const ids = JSON.parse(got).map((norm) => norm.id);
  const rows = slugRows();
  const missing = [];
  const moved = [];
  for (const [name, id] of rows) {
    if (!ids.includes(id)) missing.push(id);
    else if (slug(id) !== name) moved.push(`${name} -> ${slug(id)}`);
  }
  const known = new Set(rows.map((row) => row[1]));
  const extras = ids.filter((id) => !known.has(id));
  assert.deepEqual(ids, rows.map((row) => row[1]));
  assert.equal(missing.length, 0, `missing tsv ids: ${missing.slice(0, 5).join(", ")}`);
  assert.equal(moved.length, 0, `moved slugs: ${moved.slice(0, 5).join(", ")}`);
  assert.equal(extras.length, 0, `extra ids: ${extras.slice(0, 5).join(", ")}`);
});

function mismatch(left, right) {
  const n = Math.min(left.length, right.length);
  let i = 0;
  while (i < n && left[i] === right[i]) i += 1;
  return `${left.length}/${right.length} at ${i}: ${JSON.stringify(left.slice(i, i + 180))} <> ${JSON.stringify(right.slice(i, i + 180))}`;
}
