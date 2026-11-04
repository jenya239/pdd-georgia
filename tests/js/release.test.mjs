import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { releaseId } from "../../packages/course/release.ts";
import { loadRelease, openCourseDb, readJournal, saveAttempts, saveRelease } from "../../packages/course/store.ts";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));

test("a release id follows the course files and ignores key order", () => {
  const course = { tickets: { n: 1 }, items: { a: [2] }, episodes: {}, norms: { z: 1, a: 2 } };
  assert.equal(releaseId(course), releaseId({ norms: { a: 2, z: 1 }, episodes: {}, items: { a: [2] }, tickets: { n: 1 } }));
  assert.notEqual(releaseId(course), releaseId({ ...course, tickets: { n: 2 } }));
});

test("the published course round-trips through Postgres, and a journal event is stored once", async () => {
  const course = {
    tickets: read("site/data/tickets.json"),
    items: read("site/data/items.json"),
    episodes: read("site/data/episodes.json"),
    norms: read("content/ontology/generated/norms.json"),
  };
  const db = openCourseDb();
  const learnerId = "release-test";
  try {
    const id = await saveRelease(db, course);
    assert.equal(await saveRelease(db, course), id);
    assert.equal(await db.courseRelease.count({ where: { id } }), 1);
    const loaded = await loadRelease(db, id);
    assert.equal(releaseId(loaded), id);
    assert.equal(loaded.tickets.tickets.length, course.tickets.tickets.length);
    assert.equal(loaded.tickets.tickets.find((ticket) => ticket.id === 1).hash, course.tickets.tickets.find((ticket) => ticket.id === 1).hash);

    const event = { id: "10:0:1", t: 10, c: 0, ok: 1, w: "practice", hash: "abc" };
    await saveAttempts(db, learnerId, "1", [event]);
    await saveAttempts(db, learnerId, "1", [event, { id: "20::0", t: 20, c: null, ok: 0 }]);
    assert.deepEqual(await readJournal(db, learnerId), {
      "1": [event, { id: "20::0", t: 20, c: null, ok: 0 }],
    });
  } finally {
    await db.attempt.deleteMany({ where: { learnerId } });
    await db.$disconnect();
  }
});
