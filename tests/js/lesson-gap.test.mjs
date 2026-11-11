import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { missingIds, nextLesson, queueReport, readDone } from "../../tools/lesson-gap.mjs";

const root = new URL("../../", import.meta.url);

test("the queue walks published lessons, then the next number", () => {
  assert.equal(nextLesson(["ep01", "ep02", "ep07"], []), "ep01");
  assert.equal(nextLesson(["ep01", "ep02", "ep07"], ["ep01"]), "ep02");
  assert.equal(nextLesson(["ep01", "ep07"], ["ep01", "ep07"]), "ep08");
});

test("a breakdown hole is the assigned ticket with no file", () => {
  const pairs = [[886, "ep07"], [894, "ep07"], [2, "ep02"]];
  assert.deepEqual(missingIds(pairs, "ep07", new Set(["886"])), ["894"]);
  assert.deepEqual(missingIds(pairs, "ep01", new Set()), []);
});

test("done is a comma list and the live queue starts after the published lessons", () => {
  assert.deepEqual(readDone("status: ready\ndone: ep01, ep02\n"), ["ep01", "ep02"]);
  assert.deepEqual(readDone("done:\n"), []);
  const state = readFileSync(new URL("docs/agent/PDD_LESSON_STATE.md", root), "utf8");
  const report = queueReport(new URL("../../", import.meta.url).pathname, state);
  assert.equal(report.next, "ep09");
  assert.deepEqual(report.missing, []);
});
