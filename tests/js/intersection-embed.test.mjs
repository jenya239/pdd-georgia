import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(rel, "utf8");

test("episode 3 keeps the trainer after the explained article and out of the published prose", () => {
  const episode = read("web/assets/pages/episode.mjs");
  const markup = episode.slice(episode.indexOf("const visualMarkup"));
  const articleAt = markup.indexOf("${lesson.before}${lesson.after}");
  const trainerAt = markup.indexOf("${trainer}");
  const appendixAt = markup.indexOf('class="lesson-appendix"');
  assert.ok(articleAt >= 0 && trainerAt > articleAt && appendixAt > trainerAt);
  assert.ok(episode.includes('id="trainer"'));
  assert.ok(episode.includes("trainerShell({ embed: true })"));
  assert.ok(episode.includes("mountIntersection(trainerHost, { embed: true })"));
  assert.ok(episode.includes('location.hash === "#trainer"'));
  assert.ok(!episode.includes("не часть текста выпуска"));
  assert.ok(episode.includes('href="episode.html?id=ep03#trainer"'));
  const lesson = read("content/lessons/ep03/plain.mjs");
  assert.ok(!lesson.includes("ix-scene") && !lesson.includes('id="trainer"'));
  const published = read("site/lessons/ep03-plain.html");
  assert.equal((published.match(/<figure\b/g) || []).length, 10);
  assert.ok(!published.includes("ix-scene") && !published.includes('id="trainer"'));
});

test("the course points into episode 3 and keeps a direct page", () => {
  const course = read("web/course.html");
  assert.match(course, /href="episode\.html\?id=ep03#trainer"/);
  assert.match(course, /href="intersection\.html"/);
  assert.ok(!course.includes("не урок"));
  const shell = read("web/assets/pages/intersection.mjs");
  for (const id of ["ix-scene", "board", "hits", "explain", "bug", "next"]) {
    assert.ok(shell.includes(`id="${id}"`), id);
  }
  assert.ok(shell.includes("export function mountIntersection"));
  assert.ok(read("web/intersection.html").includes('id="ix-app"'));
  assert.ok(read("web/episode.html").includes("assets/intersection.css"));
});
