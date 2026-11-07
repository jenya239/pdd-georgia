import assert from "node:assert/strict";
import test from "node:test";
import { readOracle } from "./helpers/golden.mjs";
import { dumps, parse } from "../../packages/build/pyjson.ts";
import { buildBreakdowns } from "../../tools/build-breakdowns.mjs";

test("br fields match the published tickets", () => {
  const got = new Map(buildBreakdowns());
  const oracle = new Map();
  for (const ticket of parse(readOracle("site/data/tickets.json")).get("tickets")) {
    if (ticket.has("br")) oracle.set(ticket.get("id"), ticket.get("br"));
  }
  assert.deepEqual([...got.keys()].sort((a, b) => a - b), [...oracle.keys()].sort((a, b) => a - b));
  for (const [id, br] of oracle) {
    const left = dumps(got.get(id));
    const right = dumps(br);
    assert.equal(left === right, true, `${id}: ${mismatch(left, right)}`);
  }
});

function mismatch(left, right) {
  const n = Math.min(left.length, right.length);
  let i = 0;
  while (i < n && left[i] === right[i]) i += 1;
  return `${left.length}/${right.length} at ${i}: ${JSON.stringify(left.slice(i, i + 180))} <> ${JSON.stringify(right.slice(i, i + 180))}`;
}
