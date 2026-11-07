import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderNormPages } from "../../tools/render-norm-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("norm pages, index and chunks match the published site", () => {
  const got = renderNormPages();
  const files = walk(path.join(root, "site/norm")).filter((rel) => rel.endsWith(".html") || rel.startsWith("chunks/"));
  assert.equal(files.length > 1400, true, `published norm files: ${files.length}`);
  const missing = files.filter((rel) => got[`norm/${rel}`] === undefined);
  assert.deepEqual(missing, []);
  for (const rel of files) {
    const expected = readFileSync(path.join(root, "site/norm", rel), "utf8");
    const actual = got[`norm/${rel}`];
    assert.equal(actual === expected, true, `${rel}: ${mismatch(actual, expected)}`);
  }
});

function walk(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const rel = prefix ? `${prefix}/${name}` : name;
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
}

function mismatch(left, right) {
  const n = Math.min(left.length, right.length);
  let i = 0;
  while (i < n && left[i] === right[i]) i += 1;
  return `${left.length}/${right.length} at ${i}: ${JSON.stringify(left.slice(Math.max(0, i - 40), i + 140))}`;
}
