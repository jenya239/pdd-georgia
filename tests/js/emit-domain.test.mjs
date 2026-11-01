import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

test("domain emit is browser ESM and the journal still records an answer", async () => {
  const run = spawnSync(process.execPath, ["tools/emit-domain.mjs"], {
    encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr);
  const files = JSON.parse(run.stdout);
  const sources = readdirSync("packages/domain").filter((name) => name.endsWith(".ts"));
  assert.deepEqual(Object.keys(files).sort(), sources.map((name) => name.replace(/\.ts$/, ".mjs")).sort());
  for (const text of Object.values(files)) {
    assert.doesNotMatch(text, /from ["']\.[^"']+\.(ts|js)["']/);
  }
  assert.match(files["progress.mjs"], /from ["']\.\/items\.mjs["']/);
  assert.match(files["ticket-hash.mjs"], /from ["']node:crypto["']/);

  const dir = mkdtempSync(join(tmpdir(), "pdd-emit-"));
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    const { applyAnswer } = await import(pathToFileURL(join(dir, "progress.mjs")).href);
    const rec = applyAnswer(null, { t: 1, c: 0, ok: true, w: "practice", hash: "abc" });
    assert.equal(rec.s, 1);
    assert.equal(rec.events[0].hash, "abc");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
