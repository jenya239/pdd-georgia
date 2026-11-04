import assert from "node:assert/strict";
import test from "node:test";
import { attemptCount } from "../../packages/course/attempt-summary.ts";

const journal = {
  "1": [
    { id: "10:0:0", t: 10, c: 0, ok: 0 },
    { id: "20:1:1", t: 20, c: 1, ok: 1 },
  ],
  "2": [{ id: "30:0:1", t: 30, c: 0, ok: 1 }],
};

test("attempt count is the number of journal events for one ticket", () => {
  assert.equal(attemptCount(journal, "1"), 2);
  assert.equal(attemptCount(journal, "2"), 1);
  assert.equal(attemptCount(journal, "9"), 0);
  assert.equal(attemptCount({}, "1"), 0);
});
