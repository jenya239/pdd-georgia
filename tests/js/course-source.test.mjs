import assert from "node:assert/strict";
import test from "node:test";
import { courseSource } from "../../packages/course/source.ts";
import { openCourseDb } from "../../packages/course/store.ts";

test("a path outside the course does not touch the database", async () => {
  let calls = 0;
  const db = { courseRelease: { findFirst() { calls += 1; return null; } } };
  assert.equal(await courseSource(db).body("index.html"), null);
  assert.equal(calls, 0);
});

test("the course source serves the newest release", async () => {
  const db = openCourseDb();
  const ids = ["fixture-old", "fixture-new"];
  try {
    await db.courseRelease.create({
      data: { id: ids[0], tickets: { v: 1 }, items: {}, episodes: {}, norms: {}, createdAt: new Date("2098-01-01T00:00:00Z") },
    });
    await db.courseRelease.create({
      data: { id: ids[1], tickets: { v: 2 }, items: { ok: true }, episodes: { n: 1 }, norms: {}, createdAt: new Date("2099-01-01T00:00:00Z") },
    });
    const source = courseSource(db);
    assert.deepEqual(JSON.parse(await source.body("data/tickets.json")), { v: 2 });
    assert.deepEqual(JSON.parse(await source.body("data/items.json")), { ok: true });
    await db.courseRelease.delete({ where: { id: ids[1] } });
    assert.deepEqual(JSON.parse(await source.body("data/tickets.json")), { v: 1 });
  } finally {
    await db.courseRelease.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
