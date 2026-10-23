import { test } from "node:test";
import assert from "node:assert/strict";
import { releasedLessons, currentLesson, cumulativeScope, cumulativeOrder, scopeStatus } from "../../packages/domain/scope.mjs";

const RELEASED = [
  { id: "ep03", num: 3, tickets_lesson: [30, 31] },
  { id: "ep01", num: 1, tickets_lesson: [] },
  { id: "ep02", num: 2, tickets_lesson: [20, 21, 22] },
];

test("lessons are ordered by number", () => {
  assert.deepEqual(releasedLessons(RELEASED).map(l => l.id), ["ep01", "ep02", "ep03"]);
});

test("current lesson is the latest released one", () => {
  assert.equal(currentLesson(RELEASED).id, "ep03");
  assert.equal(currentLesson([]), null);
});

test("cumulative scope = this lesson + all previous lessons", () => {
  assert.deepEqual(cumulativeScope(RELEASED, "ep03"), { current: [30, 31], previous: [20, 21, 22] });
  assert.deepEqual(cumulativeScope(RELEASED, "ep02"), { current: [20, 21, 22], previous: [] });
  assert.throws(() => cumulativeScope(RELEASED, "ep09"));
});

test("new-first order keeps the new lesson first and shuffles only the previous ones", () => {
  const rng = () => 0; // deterministic Fisher–Yates
  const ids = cumulativeOrder({ current: [30, 31], previous: [20, 21, 22] }, { order: "new-first", rng });
  assert.deepEqual(ids.slice(0, 2), [30, 31]);
  assert.deepEqual([...ids.slice(2)].sort(), [20, 21, 22]);
  assert.deepEqual(ids.slice(2), [21, 22, 20]);
});

test("mixed order shuffles everything but keeps the full set", () => {
  const ids = cumulativeOrder({ current: [30, 31], previous: [20, 21] }, { order: "mixed", rng: () => 0.99 });
  assert.deepEqual([...ids].sort(), [20, 21, 30, 31]);
  assert.equal(ids.length, 4);
});

test("scope status: tickets in scope, solved, error rate", () => {
  const progress = { 20: { s: 2, c: 1, w: 1, l: 1, t: 1, k: 1 }, 30: { s: 2, c: 0, w: 2, l: 0, t: 1, k: 0 } };
  assert.deepEqual(scopeStatus([20, 21, 30, 31], progress),
    { inScope: 4, solved: 2, correctNow: 1, attempts: 4, wrong: 3, errorRate: 0.75 });
  assert.equal(scopeStatus([1], {}).errorRate, null);
});
