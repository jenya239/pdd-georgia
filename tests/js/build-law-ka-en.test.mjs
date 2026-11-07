import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readOracle } from "./helpers/golden.mjs";
import { dumps, parse } from "../../packages/build/pyjson.ts";
import { lawKaEnJson } from "../../tools/build-law.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function pythonDump() {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "pdd-law-ka-en-")), "ka-en.json");
  const script = `
import json
from pdd.lawparse import parse_annex, parse_law
from pdd.norms import parse_law_en
from pdd.paths import ANNEX_KA, LAW_EN, LAW_KA
json.dump(
    {"ka": parse_law(LAW_KA, "ka"), "kaAnnex": parse_annex(ANNEX_KA), "en": parse_law_en(LAW_EN)},
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

test("Georgian and English law fields match the Python dump", () => {
  const oracle = pythonDump();
  const got = lawKaEnJson();
  const left = JSON.parse(got);
  const right = JSON.parse(oracle);
  assert.deepEqual(Object.keys(left.ka), Object.keys(right.ka));
  assert.deepEqual(Object.keys(left.en), Object.keys(right.en));
  assert.deepEqual(Object.keys(left.kaAnnex), Object.keys(right.kaAnnex));
  for (const id of Object.keys(right.ka)) {
    assert.deepEqual(left.ka[id].order, right.ka[id].order, id);
  }
  const gotKa = section(got, "ka");
  const oracleKa = section(oracle, "ka");
  assert.equal(gotKa === oracleKa, true, mismatch(gotKa, oracleKa));
  const gotEn = section(got, "en");
  const oracleEn = section(oracle, "en");
  assert.equal(gotEn === oracleEn, true, mismatch(gotEn, oracleEn));
  for (const annex of Object.keys(right.kaAnnex)) {
    assert.deepEqual(sortedItems(left.kaAnnex[annex]), sortedItems(right.kaAnnex[annex]), annex);
  }
  assert.equal(left.en["5"].paras["2"].startsWith("Motorway"), true);
  assert.equal("63¹" in left.en, true);
  assert.equal("47(13)" in left.en, false);
  assert.equal("33(7)" in left.en, false);
  assert.equal(left.en["5"].paras["7"].includes("http"), false);
});

function section(dump, name) {
  return dumps(parse(dump).get(name));
}

function sortedItems(items) {
  return Object.keys(items).sort().map((key) => [key, items[key]]);
}

function mismatch(left, right) {
  const n = Math.min(left.length, right.length);
  let i = 0;
  while (i < n && left[i] === right[i]) i += 1;
  return `${left.length}/${right.length} at ${i}: ${JSON.stringify(left.slice(i, i + 160))} <> ${JSON.stringify(right.slice(i, i + 160))}`;
}
