import assert from "node:assert/strict";
import test from "node:test";
import { readOracle } from "./helpers/golden.mjs";
import { parsePlan, withCounts } from "../../packages/build/plan.ts";
import {
  coreTicketIds,
  episodeKind,
  lessonTicketIds,
  linkedTicketIds,
} from "../../packages/build/episodes.ts";
import { episodesJson } from "../../tools/build-episodes.mjs";

const Q = [
  { id: 1, law_refs: [{ article: "5", paragraph: 86 }], episodes: ["E005"] },
  { id: 2, law_refs: [{ article: "25", paragraph: 2 }], episodes: ["E005", "E030"] },
  { id: 3, law_refs: [], episodes: ["E005"] },
  { id: 4, law_refs: [{ article: "5", paragraph: 86 }], episodes: ["E040"] },
];

test("core tickets follow source order of law refs", () => {
  assert.deepEqual(coreTicketIds({ ticket_refs: [["5", "86"]] }, Q), [1, 4]);
});

test("explicit ticket ids keep the given order", () => {
  assert.deepEqual(coreTicketIds({ ticket_ids: [3, 1], ticket_refs: [["25", "2"]] }, Q), [3, 1]);
});

test("unknown explicit ticket id fails", () => {
  assert.throws(
    () => coreTicketIds({ ticket_ids: [77] }, Q),
    /None: unknown ticket ids \[77\]/,
  );
});

test("linked tickets exclude the core", () => {
  assert.deepEqual(linkedTicketIds({ plan: ["E005"] }, Q, [1]), [2, 3]);
});

test("linked tickets can come from the lesson assignment", () => {
  const ep = { plan: ["E005"], linked: "lesson" };
  assert.deepEqual(linkedTicketIds(ep, Q, [1], [4, 1, 2]), [4, 2]);
});

test("episode kind defaults to video", () => {
  assert.equal(episodeKind({ id: "ep01" }), "video");
});

test("text episode needs a lesson file", () => {
  assert.equal(episodeKind({ id: "ep04", format: "text", lesson: "lessons/ep04.html" }), "text");
  assert.throws(
    () => episodeKind({ id: "ep04", format: "text" }),
    /ep04: text episode needs a 'lesson' file/,
  );
});

test("unknown episode format fails", () => {
  assert.throws(
    () => episodeKind({ id: "ep09", format: "podcast" }),
    /ep09: unknown format 'podcast'/,
  );
});

test("lesson ticket ids are sorted", () => {
  assert.deepEqual(lessonTicketIds("ep04", { 9: "ep04", 2: "ep03", 5: "ep04" }), [5, 9]);
});

test("course plan has 107 numbered series", () => {
  const plan = parsePlan(readOracle("content/plan/structure.md"));
  assert.equal(plan.length, 107);
  assert.deepEqual(plan.slice(0, 3).map((row) => row.e), ["E001", "E002", "E003"]);
  assert.ok(plan.every((row) => row.title));
});

test("plan counts tickets per series", () => {
  const rows = withCounts(
    [{ e: "E005", block: 1, title: "Словарь", src: "ст.5" }],
    [["E005"], ["E005", "E030"], []],
  );
  assert.deepEqual(rows, [{ e: "E005", block: 1, title: "Словарь", src: "ст.5", n: 2 }]);
});

test("episodes.json bytes match the published file", () => {
  assert.equal(episodesJson(), readOracle("site/data/episodes.json"));
});
