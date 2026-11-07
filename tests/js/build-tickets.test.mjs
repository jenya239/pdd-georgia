import assert from "node:assert/strict";
import test from "node:test";
import { readOracle } from "./helpers/golden.mjs";
import { dumps, parse } from "../../packages/build/pyjson.ts";
import { buildTicketsJson } from "../../tools/build-tickets.mjs";

const FIELDS = ["id", "t", "q", "a", "c", "img", "ex", "law", "ep", "src", "nu", "lesson", "rule", "why", "hash"];

test("ticket records match the published tickets apart from the translation", () => {
  const got = buildTicketsJson();
  const oracle = dumps(projectTickets(parse(readOracle("site/data/tickets.json")).get("tickets")));
  assert.equal(got === oracle, true, mismatch(got, oracle));
  for (const ticket of parse(got)) {
    assert.equal(ticket.has("mt"), false);
    assert.equal(ticket.has("ex_ru"), false);
    assert.equal(typeof ticket.get("hash"), "string");
  }
});

function projectTickets(tickets) {
  return tickets.map((ticket) => {
    const projected = new Map();
    for (const field of FIELDS) {
      if (ticket.has(field)) projected.set(field, ticket.get(field));
    }
    return projected;
  });
}

function mismatch(left, right) {
  const n = Math.min(left.length, right.length);
  let i = 0;
  while (i < n && left[i] === right[i]) i += 1;
  return `${left.length}/${right.length} at ${i}: ${JSON.stringify(left.slice(i, i + 180))} <> ${JSON.stringify(right.slice(i, i + 180))}`;
}
