import assert from "node:assert/strict";
import test from "node:test";
import { readOracle } from "./helpers/golden.mjs";

const files = [
  ["site/data/tickets.json", undefined],
  ["site/data/items.json", undefined],
  ["site/data/episodes.json", 1],
];

test("Node reserializes each published JSON file", async () => {
  const { dumps, parse } = await import("../../packages/build/pyjson.ts");
  for (const [path, indent] of files) {
    const raw = readOracle(path);
    assert.equal(dumps(parse(raw), { indent }), raw, path);
  }
});

test("keys sort by code point, not by UTF-16 code unit", async () => {
  const { dumps } = await import("../../packages/build/pyjson.ts");
  const value = new Map([
    ["😀", 1],
    ["\uffff", 2],
    ["a", 3],
  ]);
  const jsOrder = ["😀", "\uffff"].sort()[0];
  assert.equal(jsOrder, "😀");
  assert.equal(dumps(value, { sortKeys: true }), `{"a":3,${JSON.stringify("\uffff")}:2,${JSON.stringify("😀")}:1}`);
});

test("a trailing newline is opt-in", async () => {
  const { dumps } = await import("../../packages/build/pyjson.ts");
  assert.equal(dumps(1), "1");
  assert.equal(dumps(1, { newline: true }), "1\n");
});

test("ensure_ascii escapes non-ASCII the way Python does", async () => {
  const { dumps } = await import("../../packages/build/pyjson.ts");
  const value = new Map([
    ["ё", "ა"],
    ["😀", 1],
  ]);
  assert.equal(dumps(value, { ascii: true }), '{"\\u0451":"\\u10d0","\\ud83d\\ude00":1}');
});
