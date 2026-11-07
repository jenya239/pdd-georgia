import assert from "node:assert/strict";
import test from "node:test";
import { readOracle } from "./helpers/golden.mjs";
import { dumps, parse } from "../../packages/build/pyjson.ts";
import { applyTranslations, sourceHash } from "../../packages/build/mt-apply.ts";
import { buildTicketsTranslatedJson } from "../../tools/build-tickets.mjs";

const FIELDS = ["id", "t", "q", "a", "c", "img", "ex", "law", "ep", "src", "nu", "lesson", "rule", "why", "ex_ru", "mt", "hash"];

test("translated tickets match the published tickets", () => {
  const got = buildTicketsTranslatedJson();
  const oracle = dumps(projectTickets(parse(readOracle("site/data/tickets.json")).get("tickets")));
  assert.equal(got === oracle, true, mismatch(got, oracle));
  for (const ticket of parse(got)) {
    assert.equal(ticket.has("ex_ru_nl"), false);
    assert.equal(ticket.has("hash"), true);
  }
});

test("a missing cache entry is reported like mt.py", () => {
  const question = questionOf("საგზაო");
  assert.throws(
    () => applyTranslations([ticketOf(9)], [question], {}),
    (error) => error.message === "1 machine translations are missing or stale:\n9:ex: no machine translation (run tools/translate_ka.py)",
  );
});

test("a stale cache entry is reported like mt.py", () => {
  const question = questionOf("საგზაო");
  assert.throws(
    () => applyTranslations([ticketOf(9)], [question], { "9:ex": { h: "000000000000", ru: "текст" } }),
    /9:ex: machine translation is stale/,
  );
});

test("an empty translation or a leftover placeholder is reported like mt.py", () => {
  const question = questionOf("საგზაო");
  const h = sourceHash(question.explanation_ka);
  assert.throws(
    () => applyTranslations([ticketOf(9)], [question], { "9:ex": { h, ru: "  " } }),
    /9:ex: empty translation or an unrestored placeholder/,
  );
  assert.throws(
    () => applyTranslations([ticketOf(9)], [question], { "9:ex": { h, ru: "см. §1§" } }),
    /9:ex: empty translation or an unrestored placeholder/,
  );
});

test("masked false still fills ex_ru and does not keep ex_ru_nl", () => {
  const question = questionOf("საგზაო");
  const [ticket] = applyTranslations([ticketOf(9)], [question], {
    "9:ex": { h: sourceHash(question.explanation_ka), ru: "текст", masked: false },
  });
  assert.equal(ticket.get("ex_ru"), "текст");
  assert.equal(ticket.has("ex_ru_nl"), false);
});

test("an untranslated ticket receives the question and the answers in order", () => {
  const question = {
    id: 4,
    explanation_ka: "",
    flags: ["ru_text_is_georgian_untranslated"],
    ka: { question: "კითხვა", answers: [{ text: "პირველი" }, { text: "მეორე" }] },
  };
  const cache = {
    "4:q": { h: sourceHash("კითხვა"), ru: "вопрос" },
    "4:a0": { h: sourceHash("პირველი"), ru: "первый" },
    "4:a1": { h: sourceHash("მეორე"), ru: "второй" },
  };
  const [ticket] = applyTranslations([ticketOf(4)], [question], cache);
  assert.deepEqual([...ticket.get("mt").keys()], ["q", "a"]);
  assert.equal(ticket.get("mt").get("q"), "вопрос");
  assert.deepEqual(ticket.get("mt").get("a"), ["первый", "второй"]);
});

function questionOf(explanation) {
  return { id: 9, explanation_ka: explanation, flags: [], ka: { question: "", answers: [] } };
}

function ticketOf(id) {
  return new Map([["id", id]]);
}

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
