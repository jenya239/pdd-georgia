import { test } from "node:test";
import assert from "node:assert/strict";
import { errorStats, groupStats, drillQueue } from "../../assets/lib/errors.mjs";

const TICKETS = [
  { id: 1, lesson: "ep04", t: 7, rule: { key: "34.11", label: "ст. 34, п. 11" } },
  { id: 2, lesson: "ep04", t: 7, rule: { key: "5.58", label: "ст. 5, п. 58" } },
  { id: 3, lesson: null, t: 9, rule: { key: "34.11", label: "ст. 34, п. 11" } },
  { id: 4, lesson: "ep03", t: 9 },
];
const P = {
  1: { s: 4, c: 2, w: 2, l: 1, t: 50, k: 1, lw: 40, lc: 0, p: { 0: 2 } },
  2: { s: 1, c: 0, w: 1, l: 0, t: 60, k: 0, lw: 60, lc: 2, p: { 2: 1 } },
  3: { s: 2, c: 1, w: 1, l: 1, t: 70, k: 2, lw: 20, lc: 1, p: { 1: 1 } },
  4: { s: 3, c: 3, w: 0, l: 1, t: 9, k: 3 },
};

test("only tickets with mistakes, ranked by error rate, then repeats, then recency", () => {
  const s = errorStats(P, TICKETS);
  assert.deepEqual(s.map(x => x.id), [2, 1, 3]);
  assert.deepEqual(s[0], { id: 2, attempts: 1, wrong: 1, rate: 1, lastWrong: 60, lastChoice: 2, picks: { 2: 1 }, mastered: false,
    lesson: "ep04", topic: 7, ruleKey: "5.58", ruleLabel: "ст. 5, п. 58" });
  assert.equal(s[2].mastered, true);
});

test("ties on rate are broken by the number of repeated mistakes", () => {
  const s = errorStats({ 1: { s: 2, c: 1, w: 1, l: 1, t: 1, k: 1, lw: 1 }, 2: { s: 4, c: 2, w: 2, l: 1, t: 1, k: 1, lw: 1 } }, TICKETS);
  assert.deepEqual(s.map(x => x.id), [2, 1]);
});

test("grouping by lesson / rule sums mistakes and puts unassigned last", () => {
  const s = errorStats(P, TICKETS);
  const byLesson = groupStats(s, x => x.lesson);
  assert.deepEqual(byLesson.map(g => [g.key, g.wrong, g.items.map(i => i.id)]), [["ep04", 3, [2, 1]], [null, 1, [3]]]);
  const byRule = groupStats(s, x => x.ruleKey);
  assert.deepEqual(byRule.map(g => [g.key, g.wrong]), [["34.11", 3], ["5.58", 1]]);
});

test("drill queue = tickets with mistakes that are not yet mastered (2 in a row)", () => {
  assert.deepEqual(drillQueue(P), [1, 2]);
  assert.deepEqual(drillQueue(P, [2, 3, 4]), [2]);
});
