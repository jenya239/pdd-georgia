import { test } from "node:test";
import assert from "node:assert/strict";
import { ticketDetails, pickTab, detailsHtml, TAB_ORDER } from "../../packages/domain/details.mjs";
import { applyAnswer, MASTERY_STREAK } from "../../packages/domain/progress.mjs";
import { itemAsTicket } from "../../packages/domain/items.mjs";

const ONT = {
  mc: { "mc-x": { belief: "Справа — всегда помеха", truth: "Только на равнозначных" }, "mc-y": { belief: "Другое", truth: "Так" } },
  ticketDistractors: { 54: { 0: "mc-x", 2: "mc-y" } },
  laws: { "L36.4": { ref: "ст. 36, п. 4", title: "Перекресток", text: "На нерегулируемом перекрестке: …", n: "st36-p4" } },
  concepts: { "main-road": "Главная дорога" },
  lessons: { ep03: "Выпуск 3. Перекрёстки" },
};
const T = {
  id: 54, t: 20, c: 1, ex: "ქართ.", ex_ru: "Согласно ст. 36", law: ["L36.4"], lesson: "ep03", why: "Урок 3: помеха справа.",
  br: { steps: [{ t: "Шаг" }], quotes: [], why_not: [], lesson: { id: "ep03", num: 3, title: "П" }, concepts: [] },
  nm: { m: [["st36-p4-v", "ст. 36, п. 4 «в»"]], x: [["sign-2.1", "знак 2.1"]] }, cn: ["main-road", "unknown"],
};
const ids = vm => vm.tabs.map(t => t.id);

test("tabs come in one fixed order, empty ones are hidden, the note tab is always there", () => {
  assert.deepEqual(TAB_ORDER, ["ex", "br", "norms", "hist", "mc", "note"]);
  const rec = applyAnswer(undefined, { ok: false, choice: 0, now: 5, where: "practice" });
  assert.deepEqual(ids(ticketDetails(T, { choice: 0, record: rec, note: "" }, ONT)), TAB_ORDER);
  assert.deepEqual(ids(ticketDetails({ id: 7, c: 0 }, { choice: 0 }, ONT)), ["note"]);
  const vm = ticketDetails(T, { choice: 1 }, ONT);
  assert.deepEqual(vm.tabs.map(t => t.label), ["Пояснение", "Разбор", "Нормы", "Типичная ошибка", "Заметка"]);
});

test("Пояснение: machine translation (labelled) + Georgian original; Georgian only when there is no translation", () => {
  const ex = ticketDetails(T, {}, ONT).tabs[0];
  assert.deepEqual([ex.ru, ex.ka, ex.mt], ["Согласно ст. 36", "ქართ.", true]);
  assert.equal(ticketDetails({ ...T, ex_ru: undefined }, {}, ONT).tabs[0].ru, null);
});

test("Нормы: checked and context norms with permalinks, verbatim quotes, concepts and the lesson", () => {
  const n = ticketDetails(T, {}, ONT).tabs.find(t => t.id === "norms");
  assert.deepEqual(n.main, [{ slug: "st36-p4-v", label: "ст. 36, п. 4 «в»" }]);
  assert.deepEqual(n.context, [{ slug: "sign-2.1", label: "знак 2.1" }]);
  assert.equal(n.quotes[0].n, "st36-p4");
  assert.deepEqual(n.concepts, ["Главная дорога"], "unknown concept ids are skipped");
  assert.deepEqual(n.lesson, { id: "ep03", name: "Выпуск 3. Перекрёстки" });
});

test("Моя история: attempts newest first with place, streak, mastery and error rate; aggregate-only past is summarised", () => {
  let r = { s: 3, c: 2, w: 1, l: 1, t: 3, k: 1 };                 // schema-2 record: no per-attempt history
  r = applyAnswer(r, { ok: false, choice: 2, now: 10, where: "check" });
  r = applyAnswer(r, { ok: true, choice: 1, now: 20, where: "exam" });
  const h = ticketDetails(T, { choice: 1, record: r }, ONT).tabs.find(t => t.id === "hist");
  assert.deepEqual(h.attempts.map(a => [a.t, a.c, a.ok, a.where]), [[20, 1, true, "экзамен"], [10, 2, false, "накопительная проверка"]]);
  assert.deepEqual(h.earlier, { s: 3, w: 1 });
  assert.deepEqual([h.s, h.w, h.rate, h.k, h.mastered, h.need], [5, 2, 0.4, 1, false, MASTERY_STREAK]);
});

test("Типичная ошибка: the chosen wrong option first, then others the learner picked before, plus the lesson note", () => {
  const r = applyAnswer(applyAnswer(undefined, { ok: false, choice: 2, now: 1 }), { ok: false, choice: 0, now: 2 });
  const m = ticketDetails(T, { choice: 0, record: r }, ONT).tabs.find(t => t.id === "mc");
  assert.deepEqual(m.items.map(x => [x.belief, x.current]), [["Справа — всегда помеха", true], ["Другое", false]]);
  assert.equal(m.why, "Урок 3: помеха справа.");
  const ok = ticketDetails({ ...T, why: null }, { choice: 1 }, ONT);
  assert.ok(!ids(ok).includes("mc"), "a correct answer with no past mistakes has no misconception tab");
});

test("own items: their explanation, the verbatim quote and norms; no breakdown", () => {
  const it = itemAsTicket({ id: "o-ep01-01", lesson: "ep01", type: "ticket", q: "Q", options: ["a", "b"], answer: 1,
    explain: "Ст. 1, п. 2 прямо называет", distractors: { 0: "mc-x" }, quote: { ref: "ст. 1, п. 2", text: "Действие…", n: "st1-p2" },
    nm: { m: [["st1-p2", "ст. 1, п. 2"]] }, cn: ["main-road"] });
  const vm = ticketDetails(it, { choice: 0 }, ONT);
  assert.deepEqual(ids(vm), ["ex", "norms", "mc", "note"]);
  assert.equal(vm.tabs[0].own, "Ст. 1, п. 2 прямо называет");
  assert.equal(vm.tabs[1].ownQuote.text, "Действие…");
  assert.deepEqual(vm.tabs[1].main, [{ slug: "st1-p2", label: "ст. 1, п. 2" }]);
});

test("pickTab: the remembered tab if this ticket has it, else the first", () => {
  const vm = ticketDetails(T, { choice: 1 }, ONT);
  assert.equal(pickTab(vm, "norms"), "norms");
  assert.equal(pickTab(vm, "hist"), "ex");
  assert.equal(pickTab(vm, undefined), "ex");
});

test("detailsHtml: an accessible tab strip, one panel per tab, only the active one visible", () => {
  const vm = ticketDetails(T, { choice: 1, note: "моя <заметка>" }, ONT);
  const h = detailsHtml(vm, "norms", "q54");
  assert.match(h, /<div class="tdet" data-id="54">/);
  assert.match(h, /role="tablist"/);
  assert.equal((h.match(/role="tab"/g) || []).length, vm.tabs.length);
  assert.equal((h.match(/role="tabpanel"/g) || []).length, vm.tabs.length);
  assert.match(h, /id="q54-tab-norms" aria-selected="true" aria-controls="q54-p-norms" tabindex="0"/);
  assert.match(h, /id="q54-tab-ex" aria-selected="false" aria-controls="q54-p-ex" tabindex="-1"/);
  assert.match(h, /id="q54-p-ex" aria-labelledby="q54-tab-ex" hidden/);
  assert.match(h, /data-norm="st36-p4-v"/);
  assert.match(h, /<textarea[^>]*>моя &lt;заметка&gt;<\/textarea>/);
  assert.match(h, /data-tab="note"[^>]*>Заметка •</, "a saved note is marked on its tab");
});
