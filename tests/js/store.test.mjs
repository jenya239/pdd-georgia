import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, memoryBackend, KEYS } from "../../packages/domain/store.ts";

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
  assert.deepEqual(JSON.parse(be.getItem(KEYS.progress))[9], { s: 1, c: 0, w: 1, l: 0, t: 5, k: 0, lw: 5, lc: 2, p: { 2: 1 },
    h: [{ t: 5, c: 2, ok: 0 }], events: [{ id: "5:2:0", t: 5, c: 2, ok: 0 }] });
});

test("a paused study stays next to the cumulative run and does not replace it", () => {
  const st = createStore(memoryBackend());
  st.saveActiveRun({ id: "r", lesson: "ep07", ids: [886], answers: {} });
  st.saveStudy({ id: "s", lesson: "ep07", steps: [{ kind: "theory", ref: "ostanovka" }], cursor: 1 });
  assert.equal(st.activeRun("ep07").id, "r");
  assert.equal(st.study().cursor, 1);
  st.clearStudy();
  assert.equal(st.study(), null);
  assert.equal(st.activeRun("ep07").id, "r");
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
    h: [{ t: 1, c: 0, ok: 1 }, { t: 2, c: 1, ok: 0 }],
    events: [{ id: "1:0:1", t: 1, c: 0, ok: 1 }, { id: "2:1:0", t: 2, c: 1, ok: 0 }] });
});

test("importing the same file twice does not double the attempts", () => {
  const phone = createStore(memoryBackend());
  phone.recordAnswer(1, { ok: true, choice: 0, now: 1 });
  phone.recordAnswer(1, { ok: false, choice: 1, now: 2 });
  const text = phone.exportText(10);
  const pc = createStore(memoryBackend());
  pc.importText(text, "replace");
  pc.importText(text, "merge");
  assert.equal(pc.progress()[1].s, 2);
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

test("resetLesson forgets one lesson and leaves notes and other answers", () => {
  const st = createStore(memoryBackend());
  st.recordAnswer(20, { ok: true, choice: 0, now: 1, where: "lesson" });
  st.recordAnswer(54, { ok: false, choice: 1, now: 2, where: "practice" });
  st.saveNote(20, "зебра", 3);
  st.addExam({ d: 4, ok: 25, pass: true, s: 100 });
  st.finishRun("ep03", { id: "old", lesson: "ep03", date: 1, total: 1, correct: 1, score: 100, wrong: [] });
  st.finishRun("ep04", { id: "done", lesson: "ep04", date: 2, total: 1, correct: 0, score: 0, wrong: [20] });
  st.saveActiveRun({ id: "r", lesson: "ep04", ids: [20], answers: { 20: { choice: 0, ok: true } } });
  st.saveActiveRun({ id: "later", lesson: "ep05", ids: [20, 54], answers: { 20: { choice: 0, ok: true }, 54: { choice: 1, ok: false } } });
  st.resetLesson("ep04", [20]);
  assert.equal(st.progress()[20], undefined);
  assert.equal(st.progress()[54].l, 0);
  assert.equal(st.notes()[20].x, "зебра");
  assert.equal(st.exams().length, 1);
  assert.equal(st.activeRun("ep04"), null);
  assert.deepEqual(st.activeRun("ep05").answers, { 54: { choice: 1, ok: false } });
  assert.deepEqual(st.runs().map(r => r.lesson), ["ep03"]);
});

test("undoAnswer drops the latest attempt and a matching paused check", () => {
  const st = createStore(memoryBackend());
  st.recordAnswer(20, { ok: false, choice: 1, now: 1, where: "check" });
  st.recordAnswer(20, { ok: true, choice: 0, now: 2, where: "practice" });
  st.saveActiveRun({ id: "r", lesson: "ep04", ids: [20], answers: { 20: { choice: 1, ok: false } } });
  st.undoAnswer(20);
  assert.equal(st.progress()[20].s, 1);
  assert.deepEqual(st.activeRun("ep04").answers, { 20: { choice: 1, ok: false } });
  st.undoAnswer(20);
  assert.equal(st.progress()[20], undefined);
  assert.deepEqual(st.activeRun("ep04").answers, {});
  assert.equal(st.undoAnswer(20), null);
});

test("answers remember where they were given", () => {
  const st = createStore(memoryBackend());
  st.recordAnswer(3, { ok: true, choice: 1, now: 1, where: "check" });
  assert.deepEqual(st.progress()[3].h, [{ t: 1, c: 1, ok: 1, w: "check" }]);
});
