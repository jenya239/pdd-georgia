import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as Episode from "../../packages/domain/episode.ts";
const { episodeKind, splitLesson, lessonParts, readingHref, LESSON_MARKER } = Episode;

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

test("a lesson splits into complete fragments at headings", () => {
  const html = `<p>Вступление</p><figure class="fig"><svg></svg></figure>
<h2 id="a">Манёвр</h2><p>Продолжать движение.</p>
<h2>Преимущество</h2><p>Проехать первым.</p>${LESSON_MARKER}<p>Короткий итог.</p>`;
  const parts = lessonParts(html);
  assert.deepEqual(parts.map(part => part.heading), ["", "Манёвр", "Преимущество", ""]);
  assert.match(parts[0].html, /<svg>/);
  assert.match(parts[1].html, /Продолжать движение/);
  assert.match(parts[3].html, /Короткий итог/);
});

test("the flow reads the plain lesson, not the film", () => {
  assert.equal(readingHref({
    lesson: "lessons/ep04.html",
    editions: [
      { id: "plain", href: "lessons/ep04-plain.html" },
      { id: "film", href: "media/ep04.mp4" },
    ],
  }), "lessons/ep04-plain.html");
  assert.equal(readingHref({ lesson: "lessons/ep08.html" }), "lessons/ep08.html");
  assert.equal(readingHref({ editions: [{ id: "film", href: "media/ep01.mp4" }] }), null);
});

test("a published lesson is more than its lead", () => {
  const parts = lessonParts(readFileSync("site/lessons/ep08.html", "utf8"));
  assert.ok(parts.length >= 3);
  assert.match(parts[0].html, /<svg/);
  assert.equal(parts[1].heading, "Что считается манёвром");
  assert.match(parts.at(-1).html, /Уступить/);
});
