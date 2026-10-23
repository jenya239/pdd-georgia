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
  lang: "en",
  theme: "dark",
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
    lang: "ka", theme: "light",
  };
  const m = mergeState(STATE, incoming);
  assert.deepEqual(m.progress[5], { s: 2, c: 1, w: 1, l: 0, t: 9, k: 0, lw: 9, lc: 2, p: { 2: 1 } });
  assert.deepEqual(m.runs.map(r => r.id), ["a", "b"]);
  assert.equal(m.active.ep04.id, "r2");
  assert.equal(m.active.ep03.id, "r3");
  assert.deepEqual(m.settings, { order: "mixed", own: false });
  assert.deepEqual(m.exams.map(e => e.d), [10, 50]);
  assert.equal(m.lang, "en");
  assert.equal(m.theme, "dark");
  assert.equal(mergeState({}, { lang: "ka" }).lang, "ka", "an unset local preference is taken from the file");
});

test("replace: the file's state wins entirely, sections absent from the file are cleared", () => {
  const r = applyImport(STATE, { progress: { 9: { s: 1, c: 1, w: 0, l: 1, t: 1, k: 1 } } }, "replace");
  assert.deepEqual(r, { progress: { 9: { s: 1, c: 1, w: 0, l: 1, t: 1, k: 1 } } });
  assert.throws(() => applyImport(STATE, {}, "wipe"), /режим/);
});

test("summary and preview count what the learner cares about", () => {
  assert.deepEqual(summarize(STATE), { tickets: 1, own: 0, wrong: 0, mastered: 0, runs: 1, active: 1, exams: 1, settings: true, lang: "en", theme: "dark" });
  assert.deepEqual(summarize({}), { tickets: 0, own: 0, wrong: 0, mastered: 0, runs: 0, active: 0, exams: 0, settings: false, lang: null, theme: null });
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
