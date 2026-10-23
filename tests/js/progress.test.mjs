import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAnswer, normalizeRecord, migrateProgress, mergeProgress, isMastered, MASTERY_STREAK, HISTORY_CAP, WHERE } from "../../packages/domain/progress.mjs";

test("first correct answer creates a record with streak 1", () => {
  assert.deepEqual(applyAnswer(undefined, { ok: true, choice: 2, now: 1000 }),
    { s: 1, c: 1, w: 0, l: 1, t: 1000, k: 1, h: [{ t: 1000, c: 2, ok: 1 }] });
});

test("wrong answer counts the picked option, last wrong date and resets streak", () => {
  let r = applyAnswer(undefined, { ok: true, choice: 0, now: 1 });
  r = applyAnswer(r, { ok: false, choice: 3, now: 2 });
  r = applyAnswer(r, { ok: false, choice: 3, now: 5 });
  assert.deepEqual(r, { s: 3, c: 1, w: 2, l: 0, t: 5, k: 0, lw: 5, lc: 3, p: { 3: 2 },
    h: [{ t: 1, c: 0, ok: 1 }, { t: 2, c: 3, ok: 0 }, { t: 5, c: 3, ok: 0 }] });
});

test("applyAnswer does not mutate its input", () => {
  const r = Object.freeze({ s: 1, c: 0, w: 1, l: 0, t: 1, k: 0, lw: 1, lc: 1, p: Object.freeze({ 1: 1 }) });
  const n = applyAnswer(r, { ok: false, choice: 1, now: 2 });
  assert.equal(n.p[1], 2);
  assert.equal(r.p[1], 1);
});

test("mastery needs two correct answers in a row after the last mistake", () => {
  assert.equal(MASTERY_STREAK, 2);
  let r = applyAnswer(undefined, { ok: false, choice: 1, now: 1 });
  r = applyAnswer(r, { ok: true, choice: 0, now: 2 });
  assert.equal(isMastered(r), false);
  r = applyAnswer(r, { ok: true, choice: 0, now: 3 });
  assert.equal(isMastered(r), true);
  r = applyAnswer(r, { ok: false, choice: 2, now: 4 });
  assert.equal(isMastered(r), false);
  assert.equal(isMastered(undefined), false);
});

test("v1 records (no streak, no picks) are normalised conservatively", () => {
  assert.deepEqual(normalizeRecord({ s: 4, c: 3, w: 1, l: 1, t: 9 }), { s: 4, c: 3, w: 1, l: 1, t: 9, k: 1 });
  assert.deepEqual(normalizeRecord({ s: 2, c: 0, w: 2, l: 0, t: 9 }), { s: 2, c: 0, w: 2, l: 0, t: 9, k: 0 });
});

test("invalid records are rejected", () => {
  assert.equal(normalizeRecord(null), null);
  assert.equal(normalizeRecord({ s: "x" }), null);
  assert.equal(normalizeRecord({ s: 1, c: 1, w: 1, l: 1, t: 1 }), null, "c + w must equal s");
});

test("migrateProgress keeps valid numeric ids and drops junk", () => {
  const out = migrateProgress({ 12: { s: 1, c: 1, w: 0, l: 1, t: 5 }, abc: { s: 1, c: 1, w: 0, l: 1, t: 5 }, 13: "bad" });
  assert.deepEqual(out, { 12: { s: 1, c: 1, w: 0, l: 1, t: 5, k: 1 } });
  assert.deepEqual(migrateProgress(null), {});
});

test("mergeProgress sums counters and keeps the latest state", () => {
  const phone = { 5: { s: 2, c: 1, w: 1, l: 1, t: 20, k: 1, lw: 10, lc: 2, p: { 2: 1 } } };
  const pc = { 5: { s: 3, c: 1, w: 2, l: 0, t: 30, k: 0, lw: 30, lc: 1, p: { 1: 1, 2: 1 } }, 6: { s: 1, c: 1, w: 0, l: 1, t: 3, k: 1 } };
  assert.deepEqual(mergeProgress(phone, pc), {
    5: { s: 5, c: 2, w: 3, l: 0, t: 30, k: 0, lw: 30, lc: 1, p: { 1: 1, 2: 2 } },
    6: { s: 1, c: 1, w: 0, l: 1, t: 3, k: 1 },
  });
});

test("progress keeps records of own items", () => {
  const rec = { s: 1, c: 1, w: 0, l: 1, t: 5 };
  const out = migrateProgress({ "o-ep03-02": rec, "o-x": rec, "7": rec });
  assert.deepEqual(Object.keys(out).sort(), ["7", "o-ep03-02"]);
});

test("every answer is kept in the per-ticket history with the place it was given; the history is capped", () => {
  let r = applyAnswer(undefined, { ok: true, choice: 1, now: 1, where: "lesson" });
  r = applyAnswer(r, { ok: false, choice: 0, now: 2, where: "exam" });
  assert.deepEqual(r.h, [{ t: 1, c: 1, ok: 1, w: "lesson" }, { t: 2, c: 0, ok: 0, w: "exam" }]);
  assert.equal(applyAnswer(r, { ok: true, choice: 1, now: 3, where: "nowhere" }).h[2].w, undefined, "unknown places are not stored");
  for (let i = 0; i < HISTORY_CAP + 5; i++) r = applyAnswer(r, { ok: true, choice: 1, now: 10 + i, where: "practice" });
  assert.equal(HISTORY_CAP, 50);
  assert.equal(r.h.length, HISTORY_CAP);
  assert.equal(r.h[HISTORY_CAP - 1].t, 10 + HISTORY_CAP + 4);
  assert.equal(r.s, HISTORY_CAP + 7, "counters still count every answer");
  assert.ok(Object.keys(WHERE).includes("drill") && WHERE.check);
});

test("schema-2 records (aggregate counters only) migrate without history; bad history entries are dropped", () => {
  assert.deepEqual(normalizeRecord({ s: 2, c: 1, w: 1, l: 1, t: 9, k: 1 }), { s: 2, c: 1, w: 1, l: 1, t: 9, k: 1 });
  const r = normalizeRecord({ s: 2, c: 1, w: 1, l: 1, t: 9, k: 1, h: [{ t: 3, c: 0, ok: 0, w: "check" }, { t: "x" }, { t: 9, c: 1, ok: 1, w: "??" }, 5] });
  assert.deepEqual(r.h, [{ t: 3, c: 0, ok: 0, w: "check" }, { t: 9, c: 1, ok: 1 }]);
  assert.equal(normalizeRecord({ s: 1, c: 1, w: 0, l: 1, t: 1, h: "no" }).h, undefined);
});

test("merge unites the histories of two devices in time order, without duplicates, capped", () => {
  const a = { s: 1, c: 1, w: 0, l: 1, t: 5, k: 1, h: [{ t: 5, c: 1, ok: 1, w: "practice" }] };
  const b = { s: 2, c: 1, w: 1, l: 0, t: 7, k: 0, lw: 7, lc: 0, p: { 0: 1 }, h: [{ t: 5, c: 1, ok: 1, w: "practice" }, { t: 7, c: 0, ok: 0, w: "exam" }] };
  assert.deepEqual(mergeProgress({ 1: a }, { 1: b })[1].h, [{ t: 5, c: 1, ok: 1, w: "practice" }, { t: 7, c: 0, ok: 0, w: "exam" }]);
});
