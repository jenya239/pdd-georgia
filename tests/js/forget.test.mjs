import { test } from "node:test";
import assert from "node:assert/strict";
import { forgetLesson } from "../../packages/domain/forget.mjs";

const rec = t => ({ s: 1, c: 1, w: 0, l: 1, t, k: 1 });

test("forgetLesson drops this lesson's answers and its checks, and reopens those tickets in a later check", () => {
  const state = {
    progress: { 20: rec(1), 54: rec(2), "o-ep04-01": rec(3) },
    runs: [
      { id: "a", lesson: "ep04", date: 1 },
      { id: "b", lesson: "ep03", date: 2 },
    ],
    active: {
      ep04: { id: "r", lesson: "ep04", ids: [20], answers: { 20: { choice: 0, ok: true } } },
      ep05: { id: "r2", lesson: "ep05", ids: [20, 54], answers: { 20: { choice: 1, ok: false }, 54: { choice: 0, ok: true } } },
    },
  };
  const next = forgetLesson(state, "ep04", [20, "o-ep04-01"]);
  assert.deepEqual(next.progress, { 54: rec(2) });
  assert.deepEqual(next.runs, [{ id: "b", lesson: "ep03", date: 2 }]);
  assert.equal(next.active.ep04, undefined);
  assert.deepEqual(next.active.ep05.answers, { 54: { choice: 0, ok: true } });
  assert.equal(next.active.ep05.ids.length, 2);
  assert.deepEqual(state.progress[20], rec(1));
});
