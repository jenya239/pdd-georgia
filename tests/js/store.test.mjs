import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, memoryBackend, KEYS } from "../../packages/domain/store.mjs";

test("store reads the legacy v1 progress key and migrates records", () => {
  const be = memoryBackend({ [KEYS.progress]: JSON.stringify({ 3: { s: 1, c: 1, w: 0, l: 1, t: 1 } }) });
  assert.deepEqual(createStore(be).progress(), { 3: { s: 1, c: 1, w: 0, l: 1, t: 1, k: 1 } });
});

test("broken JSON in storage yields empty state instead of crashing", () => {
  const be = memoryBackend({ [KEYS.progress]: "{", [KEYS.runs]: "x", [KEYS.active]: "[" });
  const st = createStore(be);
  assert.deepEqual(st.progress(), {});
  assert.deepEqual(st.runs(), []);
  assert.equal(st.activeRun("ep04"), null);
});

test("recordAnswer persists through the backend", () => {
  const be = memoryBackend();
  const st = createStore(be);
  st.recordAnswer(9, { ok: false, choice: 2, now: 5 });
  assert.deepEqual(JSON.parse(be.getItem(KEYS.progress))[9], { s: 1, c: 0, w: 1, l: 0, t: 5, k: 0, lw: 5, lc: 2, p: { 2: 1 }, h: [{ t: 5, c: 2, ok: 0 }] });
});

test("active runs are stored per lesson and finished runs are appended", () => {
  const st = createStore(memoryBackend());
  st.saveActiveRun({ id: "r", lesson: "ep04", ids: [1], answers: {} });
  assert.equal(st.activeRun("ep04").id, "r");
  st.finishRun("ep04", { id: "r", lesson: "ep04", date: 1, total: 1, correct: 1, score: 100, wrong: [] });
  assert.equal(st.activeRun("ep04"), null);
  assert.equal(st.runs().length, 1);
});

test("settings default to new-first order", () => {
  const st = createStore(memoryBackend());
  assert.deepEqual(st.settings(), { order: "new-first", own: true });
  st.saveSettings({ order: "mixed" });
  assert.equal(st.settings().order, "mixed");
});

test("export → import into another device merges state", () => {
  const phone = createStore(memoryBackend());
  phone.recordAnswer(1, { ok: true, choice: 0, now: 1 });
  const text = phone.exportText(10);
  const pc = createStore(memoryBackend());
  pc.recordAnswer(1, { ok: false, choice: 1, now: 2 });
  pc.importText(text);
  assert.deepEqual(pc.progress()[1], { s: 2, c: 1, w: 1, l: 0, t: 2, k: 0, lw: 2, lc: 1, p: { 1: 1 },
    h: [{ t: 1, c: 0, ok: 1 }, { t: 2, c: 1, ok: 0 }] });
});

test("own questions are included by default and the choice is saved", () => {
  const s = createStore(memoryBackend());
  assert.equal(s.settings().own, true);
  s.saveSettings({ own: false });
  assert.equal(s.settings().own, false);
});

test("notes: one free-text note per ticket, empty text deletes it, they travel with the progress file", () => {
  const phone = createStore(memoryBackend());
  phone.saveNote(54, "  помеха справа только на равнозначных  ", 10);
  phone.saveNote("o-ep01-01", "x", 11);
  assert.deepEqual(phone.notes(), { 54: { x: "помеха справа только на равнозначных", t: 10 }, "o-ep01-01": { x: "x", t: 11 } });
  phone.saveNote("o-ep01-01", "   ", 12);
  assert.deepEqual(Object.keys(phone.notes()), ["54"]);
  const pc = createStore(memoryBackend());
  pc.saveNote(54, "старая", 5);
  pc.importText(phone.exportText(20), "merge");
  assert.equal(pc.notes()[54].x, "помеха справа только на равнозначных", "the newer note wins on merge");
  assert.equal(phone.previewText(phone.exportText(21)).file.notes, 1);
});

test("answers remember where they were given", () => {
  const st = createStore(memoryBackend());
  st.recordAnswer(3, { ok: true, choice: 1, now: 1, where: "check" });
  assert.deepEqual(st.progress()[3].h, [{ t: 1, c: 1, ok: 1, w: "check" }]);
});
