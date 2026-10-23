import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBundle, parseBundle, mergeState, FORMAT } from "../../packages/domain/bundle.mjs";

const STATE = {
  progress: { 5: { s: 1, c: 1, w: 0, l: 1, t: 1, k: 1 } },
  runs: [{ id: "a", lesson: "ep04", date: 1, total: 3, correct: 2, score: 67, wrong: [6] }],
  active: { ep04: { id: "r2", lesson: "ep04", ids: [5], answers: {} } },
  settings: { order: "mixed" },
};

test("bundle round-trips through JSON text", () => {
  const b = makeBundle(STATE, 1234);
  assert.equal(b.format, FORMAT);
  assert.equal(b.version, 1);
  assert.equal(b.exportedAt, new Date(1234).toISOString());
  assert.deepEqual(parseBundle(JSON.stringify(b)), STATE);
});

test("foreign or broken files are rejected with a readable message", () => {
  assert.throws(() => parseBundle("{nope"), /JSON/);
  assert.throws(() => parseBundle(JSON.stringify({ format: "other" })), /не файл прогресса/);
  assert.throws(() => parseBundle(JSON.stringify({ format: FORMAT, version: 99 })), /версия/);
});

test("a bare v1 progress map (old localStorage dump) is accepted and migrated", () => {
  const s = parseBundle(JSON.stringify({ 7: { s: 1, c: 0, w: 1, l: 0, t: 3 } }));
  assert.deepEqual(s.progress, { 7: { s: 1, c: 0, w: 1, l: 0, t: 3, k: 0 } });
  assert.deepEqual(s.runs, []);
});

test("import merges: progress summed, runs de-duplicated by id, local active runs kept", () => {
  const incoming = {
    progress: { 5: { s: 1, c: 0, w: 1, l: 0, t: 9, k: 0, lw: 9, lc: 2, p: { 2: 1 } } },
    runs: [STATE.runs[0], { id: "b", lesson: "ep03", date: 2, total: 1, correct: 1, score: 100, wrong: [] }],
    active: { ep04: { id: "other" }, ep03: { id: "r3" } },
    settings: { order: "new-first" },
  };
  const m = mergeState(STATE, incoming);
  assert.deepEqual(m.progress[5], { s: 2, c: 1, w: 1, l: 0, t: 9, k: 0, lw: 9, lc: 2, p: { 2: 1 } });
  assert.deepEqual(m.runs.map(r => r.id), ["a", "b"]);
  assert.equal(m.active.ep04.id, "r2");
  assert.equal(m.active.ep03.id, "r3");
  assert.deepEqual(m.settings, { order: "mixed" });
});
