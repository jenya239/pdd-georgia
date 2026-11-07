import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("node build --check matches the published site tree", { timeout: 180_000 }, () => {
  const run = spawnSync(process.execPath, ["tools/build.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /up to date/);
  assert.doesNotMatch(run.stdout, /differences/);
});
