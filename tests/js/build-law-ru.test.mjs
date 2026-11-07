import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readOracle } from "./helpers/golden.mjs";
import { dumps, parse } from "../../packages/build/pyjson.ts";
import { lawRuJson } from "../../tools/build-law.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function pythonDump() {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "pdd-law-ru-")), "ru.json");
  const script = `
import json
from pdd.lawparse import parse_annex, parse_law
from pdd.paths import ANNEX_RU, LAW_RU
json.dump(
    {"law": parse_law(LAW_RU, "ru"), "annex": parse_annex(ANNEX_RU)},
    open(${JSON.stringify(file)}, "w", encoding="utf-8"),
    ensure_ascii=False,
    separators=(",", ":"),
)
`;
  const run = spawnSync(".venv/bin/python", ["-c", script], {
    cwd: root,
    env: { ...process.env, PYTHONPATH: "tools" },
    encoding: "utf8",
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout);
  return readOracle(file);
}

test("russian law fragments and annexes match the Python dump", () => {
  const oracle = pythonDump();
  const got = lawRuJson();
  const left = JSON.parse(got);
  const right = JSON.parse(oracle);
  assert.deepEqual(Object.keys(left.law), Object.keys(right.law));
  assert.deepEqual(Object.keys(left.annex), Object.keys(right.annex));
  for (const id of Object.keys(right.law)) {
    assert.deepEqual(left.law[id].order, right.law[id].order, id);
  }
  const gotLaw = dumps(parse(got).get("law"));
  const oracleLaw = dumps(parse(oracle).get("law"));
  assert.equal(gotLaw === oracleLaw, true, mismatch(gotLaw, oracleLaw));
  for (const annex of Object.keys(right.annex)) {
    assert.deepEqual(sortedItems(left.annex[annex]), sortedItems(right.annex[annex]), annex);
  }
});

function sortedItems(items) {
  return Object.keys(items).sort().map((key) => [key, items[key]]);
}

function mismatch(left, right) {
  const n = Math.min(left.length, right.length);
  let i = 0;
  while (i < n && left[i] === right[i]) i += 1;
  return `${left.length}/${right.length} at ${i}: ${JSON.stringify(left.slice(i, i + 160))} <> ${JSON.stringify(right.slice(i, i + 160))}`;
}
