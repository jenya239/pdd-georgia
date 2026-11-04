import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { isMastered, normalizeRecord } from "../../packages/domain/progress.ts";
import { openCourseDb } from "../../packages/course/store.ts";

const loader = new URL("../../apps/api/load-ts.mjs", import.meta.url);
await register(pathToFileURL(loader.pathname).href, { parentURL: import.meta.url });

const learnerId = "platform-step-3";
const event = { id: "10:1:1", t: 10, c: 1, ok: 1, w: "practice", hash: "26ab70a7e00969e1" };

test("one schema-4 event is stored once and the domain counts mastery", async () => {
  const { recordAttempt, readLearnerJournal } = await import("../../apps/api/src/journal.ts");
  const db = openCourseDb();
  try {
    await recordAttempt(learnerId, "1", event);
    await recordAttempt(learnerId, "1", event);
    const journal = await readLearnerJournal(learnerId);
    assert.deepEqual(journal, { "1": [event] });
    const view = normalizeRecord({ events: journal["1"] });
    assert.equal(view.k, 1);
    assert.equal(isMastered(view), false);
  } finally {
    await db.attempt.deleteMany({ where: { learnerId } });
    await db.$disconnect();
  }
});
