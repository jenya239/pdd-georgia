import assert from "node:assert/strict";
import test from "node:test";
import { parseTicketId, ticketFace } from "../../packages/course/ticket-face.ts";
import { readTicketFace } from "../../packages/course/read-ticket.ts";
import { openCourseDb } from "../../packages/course/store.ts";

const sample = {
  tickets: [{
    id: 4,
    hash: "ab",
    q: { ru: "Вопрос", ka: "კითხვა" },
    a: { ru: ["А", "Б"], ka: ["ა", "ბ"] },
    ex: "ორიგინალი",
    ex_ru: "Пояснение",
  }],
};

test("a ticket id is a positive integer", () => {
  assert.equal(parseTicketId("1"), 1);
  assert.equal(parseTicketId("921"), 921);
  assert.equal(parseTicketId("0"), null);
  assert.equal(parseTicketId("01"), null);
  assert.equal(parseTicketId("1x"), null);
  assert.equal(parseTicketId(""), null);
});

test("the face is the russian question, options, hash and both explanations", () => {
  assert.deepEqual(ticketFace(sample, 4), {
    id: 4,
    question: "Вопрос",
    options: ["А", "Б"],
    hash: "ab",
    original: "ორიგინალი",
    explanation: "Пояснение",
  });
  assert.equal(ticketFace(sample, 5), null);
  assert.equal(ticketFace({ tickets: [] }, 4), null);
});

test("ticket 1 from the current release keeps its published hash", async () => {
  const db = openCourseDb();
  try {
    const face = await readTicketFace(db, 1);
    assert.equal(face.hash, "26ab70a7e00969e1");
    assert.match(face.question, /уступить дорогу/);
    assert.equal(face.options.length, 2);
    assert.match(face.explanation, /ст\. 36/);
  } finally {
    await db.$disconnect();
  }
});
