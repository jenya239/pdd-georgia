import { test } from "node:test";
import assert from "node:assert/strict";
import * as Episode from "../../packages/domain/episode.mjs";
const { episodeKind, splitLesson, LESSON_MARKER } = Episode;

test("episodes are video unless declared text", () => {
  assert.equal(episodeKind({ kind: "text" }), "text");
  assert.equal(episodeKind({ format: "text" }), "text");
  assert.equal(episodeKind({ video: "media/ep01.mp4" }), "video");
});

test("lesson body is split at the tickets marker", () => {
  assert.deepEqual(splitLesson(`<p>a</p>${LESSON_MARKER}<p>b</p>`), { before: "<p>a</p>", after: "<p>b</p>" });
  assert.deepEqual(splitLesson("<p>only</p>"), { before: "<p>only</p>", after: "" });
});

test("lessons carry no ad-hoc question widget (own questions are recorded items)", () => {
  assert.equal(Episode.ownQuestionVerdict, undefined);
});
