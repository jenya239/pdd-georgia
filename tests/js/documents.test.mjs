import assert from "node:assert/strict";
import test from "node:test";
import { courseJson, courseNameOf } from "../../packages/course/documents.ts";

test("the pages fetch three course files", () => {
  assert.equal(courseNameOf("data/tickets.json"), "tickets");
  assert.equal(courseNameOf("data/items.json"), "items");
  assert.equal(courseNameOf("data/episodes.json"), "episodes");
  assert.equal(courseNameOf("index.html"), null);
  assert.equal(courseNameOf("data/tickets.json/../secret"), null);
});

test("a course file is the matching part of the release", () => {
  const course = { tickets: { n: 1 }, items: { a: 2 }, episodes: { e: 3 }, norms: { z: 4 } };
  assert.deepEqual(JSON.parse(courseJson(course, "data/tickets.json")), { n: 1 });
  assert.deepEqual(JSON.parse(courseJson(course, "data/items.json")), { a: 2 });
  assert.equal(courseJson(course, "index.html"), null);
});
