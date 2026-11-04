import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { openCourseDb } from "../../packages/course/store.ts";

const loader = new URL("../../apps/api/load-ts.mjs", import.meta.url);
await register(pathToFileURL(loader.pathname).href, { parentURL: import.meta.url });

const learnerId = "platform-step-4";
const bundle = readFileSync(new URL("./fixtures/schema4-import.json", import.meta.url), "utf8");
const events = [
  { id: "10:0:0", t: 10, c: 0, ok: 0, w: "practice" },
  { id: "20:1:1", t: 20, c: 1, ok: 1, w: "practice", hash: "26ab70a7e00969e1" },
];

test("importing a schema-4 journal twice does not double the attempts", async () => {
  const { importProgress, readLearnerJournal } = await import("../../apps/api/src/journal.ts");
  const db = openCourseDb();
  try {
    await importProgress(learnerId, bundle);
    await importProgress(learnerId, bundle);
    assert.deepEqual(await readLearnerJournal(learnerId), { "1": events });
  } finally {
    await db.attempt.deleteMany({ where: { learnerId } });
    await db.$disconnect();
  }
});
