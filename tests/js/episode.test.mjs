import { test } from "node:test";
import assert from "node:assert/strict";
import { episodeKind, splitLesson, LESSON_MARKER, ownQuestionVerdict } from "../../packages/domain/episode.mjs";

test("episodes are video unless declared text", () => {
  assert.equal(episodeKind({ kind: "text" }), "text");
  assert.equal(episodeKind({ format: "text" }), "text");
  assert.equal(episodeKind({ video: "media/ep01.mp4" }), "video");
});

test("lesson body is split at the tickets marker", () => {
  assert.deepEqual(splitLesson(`<p>a</p>${LESSON_MARKER}<p>b</p>`), { before: "<p>a</p>", after: "<p>b</p>" });
  assert.deepEqual(splitLesson("<p>only</p>"), { before: "<p>only</p>", after: "" });
});

test("own question verdict compares with the 0-based correct index", () => {
  assert.deepEqual(ownQuestionVerdict(1, "1"), { ok: true, label: "Верно." });
  assert.deepEqual(ownQuestionVerdict(0, "1"), { ok: false, label: "Неверно." });
});
