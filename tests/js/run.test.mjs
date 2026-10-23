import { test } from "node:test";
import assert from "node:assert/strict";
import { startRun, answerRun, nextTicket, isFinished, runResult, lessonTrend } from "../../assets/lib/run.mjs";

const base = () => startRun({ id: "r1", lesson: "ep04", ids: [5, 6, 7], order: "new-first", now: 100 });

test("a run starts at the first ticket with no answers", () => {
  const r = base();
  assert.equal(nextTicket(r), 5);
  assert.equal(isFinished(r), false);
  assert.deepEqual(r.answers, {});
});

test("answers advance the run and are resumable from plain JSON", () => {
  let r = answerRun(base(), 5, { choice: 1, ok: true });
  r = JSON.parse(JSON.stringify(r));
  assert.equal(nextTicket(r), 6);
  r = answerRun(r, 6, { choice: 0, ok: false });
  assert.equal(nextTicket(r), 7);
});

test("answering a ticket outside the run or twice is rejected", () => {
  assert.throws(() => answerRun(base(), 99, { choice: 0, ok: true }));
  const r = answerRun(base(), 5, { choice: 0, ok: true });
  assert.throws(() => answerRun(r, 5, { choice: 0, ok: true }));
});

test("the run must be solved in full before it has a result", () => {
  let r = answerRun(base(), 5, { choice: 1, ok: true });
  assert.throws(() => runResult(r, 200));
  r = answerRun(answerRun(r, 6, { choice: 2, ok: false }), 7, { choice: 0, ok: true });
  assert.equal(isFinished(r), true);
  assert.equal(nextTicket(r), null);
  assert.deepEqual(runResult(r, 200), { id: "r1", lesson: "ep04", date: 200, startedAt: 100, total: 3, correct: 2, score: 67, wrong: [6] });
});

test("trend lists finished runs of one lesson, oldest first", () => {
  const runs = [
    { id: "a", lesson: "ep04", date: 30, score: 90 },
    { id: "b", lesson: "ep03", date: 20, score: 50 },
    { id: "c", lesson: "ep04", date: 10, score: 70 },
  ];
  assert.deepEqual(lessonTrend(runs, "ep04").map(r => r.id), ["c", "a"]);
});
