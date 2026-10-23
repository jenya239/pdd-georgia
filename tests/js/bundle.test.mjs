import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBundle, parseBundle, mergeState, applyImport, previewImport, summarize, FORMAT } from "../../packages/domain/bundle.mjs";
import { SCHEMA_VERSION } from "../../packages/domain/registry.mjs";

const STATE = {
  progress: { 5: { s: 1, c: 1, w: 0, l: 1, t: 1, k: 1 } },
  runs: [{ id: "a", lesson: "ep04", date: 1, total: 3, correct: 2, score: 67, wrong: [6] }],
  active: { ep04: { id: "r2", lesson: "ep04", ids: [5], answers: {} } },
  settings: { order: "mixed" },
  exams: [{ d: 50, ok: 26, pass: true, s: 900 }],
  theme: "dark",
  notes: { 5: { x: "заметка", t: 3 } },
};

test("bundle carries format, schema version, app version and export date and round-trips", () => {
  const b = makeBundle(STATE, 1234, "0.6.0");
  assert.equal(b.format, FORMAT);
  assert.equal(b.schema, SCHEMA_VERSION);
  assert.equal(b.app, "0.6.0");
  assert.equal(b.exportedAt, new Date(1234).toISOString());
  const p = parseBundle(JSON.stringify(b));
  assert.deepEqual(p.state, STATE);
  assert.equal(p.schema, SCHEMA_VERSION);
  assert.equal(p.migratedFrom, null);
});

test("foreign, broken and newer files are rejected with a readable message", () => {
  assert.throws(() => parseBundle("{nope"), /JSON/);
  assert.throws(() => parseBundle("[]"), /не файл прогресса/);
  assert.throws(() => parseBundle(JSON.stringify({ format: "other" })), /не файл прогресса/);
  assert.throws(() => parseBundle(JSON.stringify({ format: FORMAT, schema: SCHEMA_VERSION + 1, data: {} })), /более новой версией/);
  assert.throws(() => parseBundle(JSON.stringify({ format: FORMAT, schema: "x", data: {} })), /версия/);
  assert.throws(() => parseBundle(JSON.stringify({ format: FORMAT, schema: SCHEMA_VERSION, data: [] })), /повреждён/);
});

test("schema 1 files (previous export format) are migrated", () => {
  const v1 = { format: FORMAT, version: 1, exportedAt: "x", progress: STATE.progress, runs: STATE.runs, active: STATE.active, settings: STATE.settings };
  const p = parseBundle(JSON.stringify(v1));
  assert.equal(p.migratedFrom, 1);
  assert.deepEqual(p.state, { progress: STATE.progress, runs: STATE.runs, active: STATE.active, settings: STATE.settings });
});

test("a bare progress map (old localStorage dump) is accepted and migrated", () => {
  const p = parseBundle(JSON.stringify({ 7: { s: 1, c: 0, w: 1, l: 0, t: 3 } }));
  assert.deepEqual(p.state, { progress: { 7: { s: 1, c: 0, w: 1, l: 0, t: 3, k: 0 } } });
  assert.equal(p.migratedFrom, 0);
});

test("invalid sections and values are dropped, not imported", () => {
  const p = parseBundle(JSON.stringify({ format: FORMAT, schema: SCHEMA_VERSION, data: {
    progress: { 1: { s: "bad" } }, runs: [{ no: "id" }], exams: [{ d: "x" }, { d: 5, ok: 20, pass: false, s: 10 }], lang: "fr", theme: "pink", unknown: 1 } }));
  assert.deepEqual(p.state, { progress: {}, runs: [], exams: [{ d: 5, ok: 20, pass: false, s: 10 }] });
});

test("merge: progress summed, runs and exams united, local unfinished runs and preferences kept", () => {
  const incoming = {
    progress: { 5: { s: 1, c: 0, w: 1, l: 0, t: 9, k: 0, lw: 9, lc: 2, p: { 2: 1 } } },
    runs: [STATE.runs[0], { id: "b", lesson: "ep03", date: 2, total: 1, correct: 1, score: 100, wrong: [] }],
    active: { ep04: { id: "other" }, ep03: { id: "r3" } },
    settings: { order: "new-first", own: false },
    exams: [STATE.exams[0], { d: 10, ok: 20, pass: false, s: 1000 }],
    theme: "light",
    notes: { 5: { x: "новее", t: 9 }, 6: { x: "с телефона", t: 1 } },
  };
  const m = mergeState(STATE, incoming);
  assert.deepEqual(m.notes, { 5: { x: "новее", t: 9 }, 6: { x: "с телефона", t: 1 } }, "notes: the newer text per ticket");
  assert.deepEqual(m.progress[5], { s: 2, c: 1, w: 1, l: 0, t: 9, k: 0, lw: 9, lc: 2, p: { 2: 1 } });
  assert.deepEqual(m.runs.map(r => r.id), ["a", "b"]);
  assert.equal(m.active.ep04.id, "r2");
  assert.equal(m.active.ep03.id, "r3");
  assert.deepEqual(m.settings, { order: "mixed", own: false });
  assert.deepEqual(m.exams.map(e => e.d), [10, 50]);
  assert.equal(m.theme, "dark");
  assert.equal(mergeState({}, { theme: "light" }).theme, "light", "an unset local preference is taken from the file");
});

test("replace: the file's state wins entirely, sections absent from the file are cleared", () => {
  const r = applyImport(STATE, { progress: { 9: { s: 1, c: 1, w: 0, l: 1, t: 1, k: 1 } } }, "replace");
  assert.deepEqual(r, { progress: { 9: { s: 1, c: 1, w: 0, l: 1, t: 1, k: 1 } } });
  assert.throws(() => applyImport(STATE, {}, "wipe"), /режим/);
});

test("summary and preview count what the learner cares about", () => {
  assert.deepEqual(summarize(STATE), { tickets: 1, own: 0, wrong: 0, mastered: 0, runs: 1, active: 1, exams: 1, settings: true, theme: "dark", notes: 1 });
  assert.deepEqual(summarize({}), { tickets: 0, own: 0, wrong: 0, mastered: 0, runs: 0, active: 0, exams: 0, settings: false, theme: null, notes: 0 });
  const incoming = { progress: { 8: { s: 2, c: 0, w: 2, l: 0, t: 3, k: 0 }, "o-ep05-01": { s: 2, c: 2, w: 0, l: 1, t: 3, k: 2 } } };
  const pv = previewImport(STATE, incoming, "merge");
  assert.equal(pv.before.tickets, 1);
  assert.equal(pv.file.tickets, 1);
  assert.equal(pv.file.own, 1);
  assert.equal(pv.file.wrong, 1);
  assert.equal(pv.file.mastered, 1);
  assert.equal(pv.after.tickets, 2);
  assert.equal(pv.after.runs, 1);
  assert.equal(previewImport(STATE, incoming, "replace").after.runs, 0);
});

test("retired «lang» (global question language, removed in 0.7): old exports still import, the key is dropped", () => {
  const { notes, ...v2 } = STATE;
  const old = { format: FORMAT, schema: 2, app: "0.6", exportedAt: "x", data: { ...v2, lang: "ka" } };
  const p = parseBundle(JSON.stringify(old));
  assert.deepEqual(p.state, v2);
  assert.equal("lang" in p.state, false);
  assert.equal("lang" in mergeState(STATE, { lang: "en" }), false);
  assert.equal("lang" in summarize({ lang: "ka" }), false);
  assert.equal("lang" in makeBundle({ ...STATE, lang: "ka" }, 1, "t").data, false);
});

test("schema 3: per-attempt history and notes; schema-2 files are migrated (records keep their counters, no history)", () => {
  assert.equal(SCHEMA_VERSION, 3);
  const v2 = { format: FORMAT, schema: 2, app: "0.7", exportedAt: "x", data: { progress: { 5: { s: 4, c: 3, w: 1, l: 1, t: 9, k: 2 } } } };
  const p = parseBundle(JSON.stringify(v2));
  assert.equal(p.migratedFrom, 2);
  assert.deepEqual(p.state.progress[5], { s: 4, c: 3, w: 1, l: 1, t: 9, k: 2 });
  const bad = parseBundle(JSON.stringify({ format: FORMAT, schema: 3, data: { notes: { 5: { x: "", t: 1 }, 6: { x: "ok", t: 2 }, abc: { x: "y", t: 1 }, 7: "z" } } }));
  assert.deepEqual(bad.state.notes, { 6: { x: "ok", t: 2 } });
});
