import { test } from "node:test";
import assert from "node:assert/strict";
import { ticketHash } from "../../packages/domain/ticket-hash.ts";

test("the ticket hash follows the question, the options and the correct index", () => {
  const t = { q: { ru: "Кто проедет первым?" }, a: { ru: ["а", "б"] }, c: 1, img: "x.png" };
  assert.equal(ticketHash(t).length, 16);
  assert.equal(ticketHash(t), ticketHash({ ...t, img: "y.png", br: { steps: [] } }));
  assert.notEqual(ticketHash(t), ticketHash({ ...t, c: 0 }));
  assert.notEqual(ticketHash(t), ticketHash({ ...t, q: { ru: "Кто уступает?" } }));
});
