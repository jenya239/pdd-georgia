import { test } from "node:test";
import assert from "node:assert/strict";
import { isOwnId, parseId, itemAsTicket, misconceptionFor, TYPE_LABEL, idLabel, compareIds, questionText } from "../../packages/domain/items.mjs";

const ITEM = { id: "o-ep04-01", lesson: "ep04", type: "diagram", type_label: "схема", q: "Где стоять?",
  options: ["А", "Б"], answer: 1, explain: "Потому что.", rule: { key: "37.6", label: "ст. 37, п. 6 «а.а»" },
  quote: { ref: "ст. 37, п. 6 «а.а»", text: "ближе 5 метров" }, distractors: { "0": "mc-stop-near-crossing" },
  fig: { kind: "approach", object: "zebra", marks: [] } };

test("own ids are recognised, bank ids stay numbers", () => {
  assert.equal(isOwnId("o-ep01-02"), true);
  assert.equal(isOwnId("12"), false);
  assert.equal(isOwnId(12), false);
  assert.equal(parseId("12"), 12);
  assert.equal(parseId("o-ep01-02"), "o-ep01-02");
});

test("an own item looks like a ticket to the renderers", () => {
  const t = itemAsTicket(ITEM);
  assert.equal(t.id, "o-ep04-01");
  assert.equal(t.own, true);
  assert.equal(t.c, 1);
  assert.deepEqual(t.q, { ru: "Где стоять?" });
  assert.deepEqual(t.a, { ru: ["А", "Б"] });
  assert.equal(t.t, "own");
  assert.equal(t.lesson, "ep04");
  assert.deepEqual(t.rule, ITEM.rule);
  assert.deepEqual(t.nu, []);
  assert.equal(t.fig.kind, "approach");
  assert.equal(t.img, null);
  assert.deepEqual(itemAsTicket({ ...ITEM, _r: { explain: [[0, 4, "st5"]] } })._r, { explain: [[0, 4, "st5"]] });  // norm links survive
});

test("misconception for a wrong pick: own items and annotated bank tickets", () => {
  const mc = { "mc-stop-near-crossing": { belief: "B", truth: "T" }, "mc-x": { belief: "X", truth: "Y" } };
  const own = itemAsTicket(ITEM);
  assert.deepEqual(misconceptionFor(own, 0, mc, {}), { id: "mc-stop-near-crossing", belief: "B", truth: "T" });
  assert.equal(misconceptionFor(own, 1, mc, {}), null);
  assert.deepEqual(misconceptionFor({ id: 611 }, 2, mc, { "611": { "2": "mc-x" } }).truth, "Y");
  assert.equal(misconceptionFor({ id: 611 }, 1, mc, { "611": { "1": null } }), null);
  assert.equal(misconceptionFor({ id: 5 }, 1, mc, undefined), null);
});

test("every item type has a label", () => {
  for (const k of ["ticket", "diagram", "priority", "max-error", "flashcard", "cloze"]) assert.ok(TYPE_LABEL[k]);
});

test("ids are labelled for lists: bank number or own item", () => {
  assert.equal(idLabel(12), "№ 12");
  assert.equal(idLabel("o-ep04-03"), "наш вопрос ep04-03");
});

test("compareIds puts bank tickets first", () => {
  assert.deepEqual([ "o-ep02-01", 30, "o-ep01-02", 4].sort(compareIds), [4, 30, "o-ep01-02", "o-ep02-01"]);
});

test("questionText: Russian with the Georgian original on demand; untranslated tickets in Georgian; own items RU only; no EN", () => {
  const T = { id: 1, q: { ru: "Вопрос?", ka: "კითხვა?", en: "Question?" }, a: { ru: ["Да", "Нет"], ka: ["კი", "არა"], en: ["Yes", "No"] }, nu: [] };
  assert.deepEqual(questionText(T), { q: "Вопрос?", a: ["Да", "Нет"], lang: "ru", untranslated: false, ka: { q: "კითხვა?", a: ["კი", "არა"] } });
  const eco = { ...T, q: { ru: "ეკო?", ka: "ეკო?", en: "ეკო?" }, a: { ru: ["ა"], ka: ["ა"], en: ["ა"] }, nu: ["ru", "en"] };
  assert.deepEqual(questionText(eco), { q: "ეკო?", a: ["ა"], lang: "ka", untranslated: true, ka: null });
  assert.deepEqual(questionText(itemAsTicket(ITEM)), { q: "Где стоять?", a: ["А", "Б"], lang: "ru", untranslated: false, ka: null });
  assert.equal(questionText({ ...T, q: { ru: "В?" }, a: { ru: ["Да"] } }).ka, null, "no Georgian text → no original");
});
