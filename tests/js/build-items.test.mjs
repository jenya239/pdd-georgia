import assert from "node:assert/strict";
import test from "node:test";
import { readOracle } from "./helpers/golden.mjs";
import { dumps, parse } from "../../packages/build/pyjson.ts";
import { normText, ruleFor, validateItems } from "../../packages/build/items.ts";
import { buildItemsJson, itemErrors } from "../../tools/build-items.mjs";

test("items.json matches the published export", () => {
  const got = buildItemsJson();
  const oracle = dumps(strip(parse(readOracle("site/data/items.json"))));
  assert.equal(got === oracle, true, mismatch(got, oracle));
});

test("published items have no validation errors", () => {
  assert.deepEqual(itemErrors(), []);
});

test("an untaught norm and a future concept are named", () => {
  const errors = itemErrors((items) => [{
    ...items[0],
    id: "o-ep01-99",
    norms: ["36.4.в"],
    concepts: ["intersection"],
  }]);
  assert.deepEqual(errors, [
    "o-ep01-99: quote norm 1.2 is not among the item norms",
    "o-ep01-99: norm 36.4.в is not taught by ep01 or earlier",
    "o-ep01-99: concept intersection is not introduced by ep01",
  ]);
});

test("comparison text unifies dashes and whitespace", () => {
  assert.equal(normText("150–300  метров\n"), normText("150-300 метров"));
});

test("a norm rule uses the ticket key and label", () => {
  assert.deepEqual(plain(ruleFor("37.6.а.а")), { key: "37.6", label: "ст. 37, п. 6 «а.а»" });
  assert.deepEqual(plain(ruleFor("A1:2.1")), { key: "A1:2.1", label: "прил. 1, знак 2.1" });
  assert.equal(ruleFor("A1:1.прим.а").get("key"), "A1:1.прим.а");
  assert.equal(ruleFor("A1:1.прим.а").get("label"), "прил. 1, примечание к разделу 1 «а»");
});

test("validation errors use the Python wording", () => {
  const law = world();
  assert.deepEqual(validateItems([item({ lesson: "ep99" })], law), [
    "o-ep01-01: id must be o-ep99-NN",
    "o-ep01-01: unknown lesson ep99",
  ]);
  assert.deepEqual(validateItems([item(), item()], law), [
    "o-ep01-01: duplicate id",
  ]);
  assert.deepEqual(validateItems([item({ type: "podcast" })], law), [
    "o-ep01-01: unknown type 'podcast'",
  ]);
  assert.deepEqual(validateItems([item({ answer: "x" })], law), [
    "o-ep01-01: answer 'x' out of range",
    "o-ep01-01: distractors must map exactly the wrong options ['0', '1']",
  ]);
  assert.deepEqual(validateItems([item({ quote: { norm: "9.9", text: "it's" } })], law), [
    "o-ep01-01: quote norm '9.9' does not exist",
    "o-ep01-01: quote norm 9.9 is not among the item norms",
  ]);
  assert.deepEqual(validateItems([item({ quote: { norm: "1.2", text: "it's" } })], law), [
    "o-ep01-01: quote is not verbatim in 1.2: \"it's\"",
  ]);
  assert.deepEqual(validateItems([item({ options: ["только"] })], law), [
    "o-ep01-01: needs 2–4 options",
    "o-ep01-01: answer 1 out of range",
  ]);
  assert.deepEqual(validateItems([item({ distractors: { "1": "mc-missing" } })], law), [
    "o-ep01-01: distractors must map exactly the wrong options ['0']",
    "o-ep01-01: unknown misconception mc-missing",
  ]);
  assert.deepEqual(validateItems([item({ explain: "коротко" })], law), [
    "o-ep01-01: explanation too short",
  ]);
  assert.deepEqual(validateItems([{ id: "o-ep01-01" }], law), [
    "o-ep01-01: missing ['lesson', 'type', 'q', 'options', 'answer', 'norms', 'concepts', 'quote', 'explain', 'distractors']",
  ]);
});

test("flashcard, cloze and diagram errors name the failed check", () => {
  const law = world();
  assert.deepEqual(validateItems([item({
    type: "flashcard",
    options: ["50", "100"],
    answer: 0,
    quote: { norm: "1.2", text: "ближе чем за 100 метров" },
    distractors: { "1": null },
  })], law), [
    "o-ep01-01: flashcard answer '50' is not a number from the quote",
  ]);
  assert.deepEqual(validateItems([item({
    type: "cloze",
    q: "«…закрыт, закрывается или ___»",
    options: ["открыт", "поднимается"],
    answer: 0,
    quote: { norm: "1.2", text: "закрыт, закрывается или поднимается" },
    distractors: { "1": null },
  })], law), [
    "o-ep01-01: cloze answer 'открыт' is not in the quote",
  ]);
  assert.deepEqual(validateItems([item({ type: "diagram" })], law), [
    "o-ep01-01: diagram needs fig",
  ]);
  assert.deepEqual(validateItems([item({ type: "diagram", fig: { kind: "blob" } })], law), [
    "o-ep01-01: unknown fig kind 'blob'",
  ]);
});

function world() {
  return {
    normText: new Map([["1.2", "Действие настоящего Закона ближе чем за 100 метров закрыт, закрывается или поднимается"]]),
    lessonOrder: ["ep01"],
    concepts: { "law-scope": {} },
    misconceptions: { "mc-law-citizens-only": { belief: "a", truth: "b" } },
    quoted: () => ["1.2"],
    availableConcepts: () => new Set(["law-scope"]),
    doc: { tickets: {} },
  };
}

function item(extra = {}) {
  return {
    id: "o-ep01-01",
    lesson: "ep01",
    type: "ticket",
    q: "Вопрос достаточной длины для проверки?",
    options: ["нет", "да"],
    answer: 1,
    norms: ["1.2"],
    concepts: ["law-scope"],
    quote: { norm: "1.2", text: "Действие настоящего Закона" },
    explain: "Объяснение длиннее двадцати знаков.",
    distractors: { "0": "mc-law-citizens-only" },
    ...extra,
  };
}

function plain(map) {
  return Object.fromEntries(map);
}

function strip(doc) {
  for (const row of doc.get("items")) {
    row.delete("_r");
    row.delete("nm");
    row.delete("cn");
    row.get("quote").delete("n");
    row.get("quote").delete("_r");
  }
  for (const row of doc.get("misconceptions").values()) row.delete("_r");
  return doc;
}

function mismatch(left, right) {
  const n = Math.min(left.length, right.length);
  let i = 0;
  while (i < n && left[i] === right[i]) i += 1;
  return `${left.length}/${right.length} at ${i}: ${JSON.stringify(left.slice(i, i + 180))} <> ${JSON.stringify(right.slice(i, i + 180))}`;
}
