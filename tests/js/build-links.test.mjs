import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dumps, parse } from "../../packages/build/pyjson.ts";
import { buildLinks } from "../../tools/build-links.mjs";

const root = new URL("../../", import.meta.url);

test("links.json and ticket texts match the published build", () => {
  const built = buildLinks();
  const links = readFileSync(new URL("content/ontology/generated/links.json", root), "utf8");
  const gotLinks = dumps(built.report, { indent: 1, newline: true });
  assert.equal(gotLinks === links, true, mismatch(gotLinks, links));
  const oracle = parse(readFileSync(new URL("site/data/tickets.json", root), "utf8"));
  const tickets = oracle.get("tickets");
  assert.equal(built.tickets.length, tickets.length);
  tickets.forEach((ticket, index) => {
    const got = built.tickets[index];
    assert.equal(got.id, ticket.get("id"));
    const left = dumps(project(got));
    const right = dumps(project(ticket));
    assert.equal(left === right, true, `${got.id}: ${mismatch(left, right)}`);
  });
  const leftLaws = dumps(built.laws);
  const rightLaws = dumps(oracle.get("laws"));
  assert.equal(leftLaws === rightLaws, true, mismatch(leftLaws, rightLaws));
});

function project(ticket) {
  const out = new Map();
  for (const key of ["ex", "ex_ru", "why", "br", "_r"]) {
    const value = ticket instanceof Map ? (ticket.has(key) ? ticket.get(key) : undefined) : ticket[key];
    if (value !== undefined) out.set(key, asMap(value));
  }
  return out;
}

function asMap(value) {
  if (value instanceof Map) return value;
  if (Array.isArray(value)) return value.map(asMap);
  if (value && typeof value === "object") {
    const map = new Map();
    for (const [key, item] of Object.entries(value)) map.set(key, asMap(item));
    return map;
  }
  return value;
}

function mismatch(left, right) {
  const n = Math.min(left.length, right.length);
  let i = 0;
  while (i < n && left[i] === right[i]) i += 1;
  return `${left.length}/${right.length} at ${i}: ${JSON.stringify(left.slice(i, i + 180))} <> ${JSON.stringify(right.slice(i, i + 180))}`;
}
