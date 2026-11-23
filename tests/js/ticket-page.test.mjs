import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { slug } from "../../packages/lesson/slug.ts";
import {
  canonicalTicketId,
  excerptQuestion,
  filterTicketRows,
  retargetSingleTicketHref,
  singlePracticeTarget,
  ticketHref,
  ticketIndexHref,
  ticketListRows,
  ticketPageModel,
  ticketTitle,
} from "../../packages/domain/ticket-page.ts";

const tickets = [
  { id: 1, t: 20, lesson: "ep03", nm: { m: [["st36-p4-v", "ст. 36, п. 4 «в»"]], x: [["st36-p4-v", "повтор"], ["st5-p37", "ст. 5, п. 37"]] }, cn: ["right-hand-rule"], ep: ["E003"], question: "один", rule: { label: "ст. 36, п. 4 «в»" } },
  { id: 2, t: 20, lesson: "ep03", nm: { m: [["st36-p4-v", "ст. 36, п. 4 «в»"]] }, cn: ["right-hand-rule"], question: "два рядом" },
  { id: 3, t: 20, lesson: null, nm: { m: [["other", "другое"]] }, cn: [], question: "три, та же тема" },
  { id: 9, t: 5, lesson: "ep02", nm: { m: [] }, cn: ["lane"], question: "девять" },
  { id: 10, t: 5, lesson: null, cn: ["lane"], question: "десять" },
  { id: "o-ep03-01", own: true, lesson: "ep03", kind: "в формате билета", nm: { m: [["st36-p4-v", "ст. 36, п. 4 «в»"]] }, cn: [], question: "свой вопрос" },
];
const meta = {
  topics: { 20: "Перекрёстки", 5: "Полосы" },
  concepts: { "right-hand-rule": "Помеха справа", lane: "Полоса" },
  lessons: { ep03: "Выпуск 3. Перекрёсток", ep02: "Выпуск 2. Дорога" },
  series: { E003: "Перекрёстки" },
};

test("a ticket page collects the norm, the lesson, neighbours and the closest similar tickets", () => {
  const page = ticketPageModel(1, tickets, meta);
  assert.equal(page.title, "Билет № 1");
  assert.equal(page.topicLabel, "Перекрёстки");
  assert.equal(page.lessonLabel, "Выпуск 3. Перекрёсток");
  assert.equal(page.ruleLabel, "ст. 36, п. 4 «в»");
  assert.deepEqual(page.series, [{ code: "E003", title: "Перекрёстки" }]);
  assert.deepEqual(page.norms.map(item => [item.slug, item.role]), [["st36-p4-v", "main"], ["st5-p37", "context"]]);
  assert.deepEqual(page.concepts, [{ id: "right-hand-rule", label: "Помеха справа" }]);
  assert.equal(page.prev, null);
  assert.equal(page.next.id, 2);
  assert.deepEqual(page.similar.map(item => [item.id, item.why]), [[2, "та же норма"], ["o-ep03-01", "та же норма"], [3, "та же тема"]]);
  assert.equal(ticketPageModel(9, tickets, meta).similar[0].why, "та же тема");
  assert.equal(ticketPageModel(9, tickets, meta).prev.id, 3);
  assert.equal(ticketPageModel(9, tickets, meta).next.id, 10);
  const own = ticketPageModel("o-ep03-01", tickets, meta);
  assert.equal(own.own, true);
  assert.equal(own.title, ticketTitle("o-ep03-01"));
  assert.equal(own.kind, "в формате билета");
  assert.equal(own.prev, null);
  assert.equal(own.next, null);
  assert.equal(own.similar[0].why, "та же норма");
  assert.equal(ticketPageModel(99, tickets, meta), null);
});

test("the catalog filters by number, words, topic and lesson without mixing training sets", () => {
  const rows = ticketListRows(tickets, meta);
  assert.deepEqual(filterTicketRows(rows, { q: "2" }).map(row => row.id), [2]);
  assert.deepEqual(filterTicketRows(rows, { q: "тема" }).map(row => row.id), [3]);
  assert.deepEqual(filterTicketRows(rows, { topic: "20" }).map(row => row.id), [1, 2, 3]);
  assert.deepEqual(filterTicketRows(rows, { topic: "own" }).map(row => row.id), ["o-ep03-01"]);
  assert.deepEqual(filterTicketRows(rows, { lesson: "ep03" }).map(row => row.id), [1, 2, "o-ep03-01"]);
  assert.deepEqual(filterTicketRows(rows, { lesson: "none" }).map(row => row.id), [3, 10]);
  assert.equal(excerptQuestion("а".repeat(180)), "а".repeat(180));
  assert.equal(excerptQuestion("а".repeat(181)).endsWith("…"), true);
  assert.equal(excerptQuestion("а".repeat(181)).length, 180);
});

test("only a practice URL of one ticket is retargeted; a set, a topic and an exam stay", () => {
  assert.equal(canonicalTicketId(" 54 "), 54);
  assert.equal(canonicalTicketId("o-ep03-01"), "o-ep03-01");
  assert.equal(canonicalTicketId(""), null);
  assert.equal(canonicalTicketId("нет"), null);
  assert.equal(ticketHref(54), "ticket.html?id=54");
  assert.equal(ticketHref("o-ep03-01", "../"), "../ticket.html?id=o-ep03-01");
  assert.equal(ticketIndexHref({ topic: "20" }), "tickets.html?topic=20");
  assert.equal(singlePracticeTarget("../practice.html?ids=941"), "941");
  assert.equal(singlePracticeTarget("practice.html?ids=o-ep02-08"), "o-ep02-08");
  assert.equal(singlePracticeTarget("practice.html?ids=1,2"), null);
  assert.equal(singlePracticeTarget("practice.html?ids=1&len=all"), null);
  assert.equal(singlePracticeTarget("practice.html?topic=20"), null);
  assert.equal(singlePracticeTarget("practice.html?ep=ep03"), null);
  assert.equal(retargetSingleTicketHref("../practice.html?ids=941"), "../ticket.html?id=941");
  assert.equal(retargetSingleTicketHref("practice.html?ids=292,478"), "practice.html?ids=292,478");
});

test("a norm page links each ticket to its page and keeps the set as practice", async () => {
  const { normFiles } = await import("../../packages/norm/pages.ts");
  const html = normFiles({
    "5.87": {
      lessons: [],
      concepts: [],
      misconceptions: [],
      tickets: [265],
      items: [{ id: "o-ep02-01", q: "Первый" }, { id: "o-ep02-02", q: "Второй" }],
      cited: [],
    },
  })[`norm/${slug("5.87")}.html`];
  assert.match(html, /<a href="\.\.\/ticket\.html\?id=265">№ 265<\/a>/);
  assert.match(html, /<a class="btn ghost" href="\.\.\/practice\.html\?ids=265">Решить эти билеты<\/a>/);
  assert.match(html, /<a href="\.\.\/ticket\.html\?id=o-ep02-01">Первый<\/a>/);
  assert.match(html, /<a class="btn ghost" href="\.\.\/practice\.html\?ids=o-ep02-01,o-ep02-02">Решить все<\/a>/);
  assert.doesNotMatch(html, /<a href="\.\.\/practice\.html\?ids=265">№ 265<\/a>/);
});

test("published lessons point each named ticket at its page", async () => {
  const { lessonFiles } = await import("../../packages/lesson/files.ts");
  const files = lessonFiles();
  const joined = Object.values(files).join("\n");
  for (const id of [265, 81, 2, 54, 503, 20, 288, 422, 418, 515, 941, 942, 811, 921, 922, 47, 53, 75, 357, 886, 356, 879, 889, 390, 391]) {
    assert.ok(joined.includes(`ticket.html?id=${id}`), String(id));
  }
  assert.match(files["lessons/ep08.html"], /href="practice\.html\?ep=ep08">проверить отдельно/);
  for (const [name, html] of Object.entries(files)) {
    for (const match of html.matchAll(/<a href="(practice\.html\?[^"]+)">([\s\S]*?)<\/a>/g)) {
      const numbers = [...match[2].matchAll(/№\s*(\d+)/g)].map(item => item[1]);
      assert.notEqual(numbers.length, 1, `${name} still wraps one ticket: ${match[0]}`);
    }
  }
});

test("the shells and the question chrome agree on the ticket page", () => {
  assert.match(readFileSync("web/ticket.html", "utf8"), /assets\/pages\/ticket\.mjs/);
  assert.match(readFileSync("web/tickets.html", "utf8"), /assets\/pages\/tickets\.mjs/);
  const question = readFileSync("web/assets/app/question.mjs", "utf8");
  assert.match(question, /ticketHref/);
  assert.match(question, /mode === "exam" \|\| opts\.standalone/);
  assert.match(question, /Правильный ответ/);
  assert.match(readFileSync("web/assets/pages/errors.mjs", "utf8"), /ticketHref/);
  assert.match(readFileSync("web/assets/pages/check.mjs", "utf8"), /ticketHref/);
  assert.match(readFileSync("packages/domain/progress.ts", "utf8"), /ticket: "страница билета"/);
  assert.equal(readFileSync("packages/domain/registry.ts", "utf8").includes("SCHEMA_VERSION = 5"), true);
});
