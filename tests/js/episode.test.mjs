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

test("a lesson lists only editions that can be opened", () => {
  assert.deepEqual(Episode.lessonEditions({}), []);
  assert.deepEqual(Episode.lessonEditions({
    editions: [{ id: "dialogue", href: "lessons/ep04.html" }, { id: "", href: "x" }, { label: "нет" }, null],
  }), [{ id: "dialogue", href: "lessons/ep04.html" }]);
});

test("the saved edition is used when the lesson has it, otherwise the first", () => {
  const editions = [
    { id: "dialogue", href: "lessons/ep04.html", label: "С диалогом" },
    { id: "plain", href: "lessons/ep04-plain.html", label: "Без персонажей" },
  ];
  assert.equal(Episode.pickEdition(editions, "plain").id, "plain");
  assert.equal(Episode.pickEdition(editions, "missing").id, "dialogue");
  assert.equal(Episode.pickEdition(editions, undefined).id, "dialogue");
  assert.equal(Episode.pickEdition([], "plain"), null);
});
