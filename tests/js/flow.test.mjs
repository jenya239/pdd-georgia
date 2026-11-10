import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFlowRun, flowKey, knowledgeLine, lessonStatus, nextFlowItem } from "../../packages/domain/flow.ts";

const L = [
  { id: "ep01", num: 1, title: "Дорога", lead: "Что считается дорогой.", tickets_lesson: [1, 2], own_items: ["o1"] },
  { id: "ep02", num: 2, title: "Знаки", lead: "Знак начинает действовать.", tickets_lesson: [3], own_items: [] },
];

test("a new learner opens on the first lesson text", () => {
  const step = nextFlowItem(L, {});
  assert.equal(step.kind, "theory");
  assert.equal(step.lessonId, "ep01");
  assert.equal(step.lead, "Что считается дорогой.");
  assert.equal(step.pause, false);
  assert.equal(step.done, false);
  assert.equal(flowKey(step), "theory:ep01");
});

test("mix skips a blocked text and offers the first question", () => {
  const step = nextFlowItem(L, {}, { avoid: ["theory:ep01"] });
  assert.equal(step.kind, "question");
  assert.equal(step.ticketId, 1);
});

test("own questions stay out until asked for", () => {
  const hidden = nextFlowItem(L, { 1: { l: 1 }, 2: { l: 1 }, 3: { l: 1 } });
  assert.equal(hidden.done, true);
  const shown = nextFlowItem(L, { 1: { l: 1 }, 2: { l: 1 }, 3: { l: 1 } }, { own: true });
  assert.equal(shown.kind, "question");
  assert.equal(shown.ticketId, "o1");
  assert.equal(shown.done, false);
});

test("mix returns to a wrong answer before a new question", () => {
  const step = nextFlowItem(L, { 1: { l: 0 } });
  assert.equal(step.kind, "review");
  assert.equal(step.ticketId, 1);
});

test("the material control changes the opening step", () => {
  const progress = { 1: { l: 0 } };
  assert.equal(nextFlowItem(L, progress, { mode: "situations" }).ticketId, 2);
  assert.equal(nextFlowItem(L, progress, { mode: "explain" }).kind, "theory");
  assert.equal(nextFlowItem(L, progress, { mode: "review" }).kind, "review");
  assert.equal(nextFlowItem(L, {}, { mode: "nowhere" }).kind, "theory");
});

test("after a miss, mix offers the lesson text, then a different question", () => {
  const progress = { 1: { l: 0 } };
  const text = nextFlowItem(L, progress, { last: "question", anchor: "ep01" });
  assert.equal(text.kind, "theory");
  assert.equal(text.lessonId, "ep01");
  const next = nextFlowItem(L, progress, { last: "theory", anchor: "ep01" });
  assert.equal(next.kind, "question");
  assert.equal(next.ticketId, 2);
});

test("a correct answer continues with the next unanswered question", () => {
  const step = nextFlowItem(L, { 1: { l: 1 } }, { last: "question", anchor: "ep01" });
  assert.equal(step.kind, "question");
  assert.equal(step.ticketId, 2);
});

test("a finished lesson opens the next lesson's text, not its first question", () => {
  const progress = { 1: { l: 1 }, 2: { l: 1 }, o1: { l: 1 } };
  const step = nextFlowItem(L, progress, { own: true });
  assert.equal(step.kind, "theory");
  assert.equal(step.lessonId, "ep02");
  assert.equal(step.pause, false);
});

test("finishing a lesson pauses before the next one", () => {
  const progress = { 1: { l: 1 }, 2: { l: 1 }, o1: { l: 1 } };
  const step = nextFlowItem(L, progress, { own: true, last: "question", anchor: "ep01" });
  assert.equal(step.kind, "theory");
  assert.equal(step.lessonId, "ep02");
  assert.equal(step.pause, true);
  assert.equal(step.done, false);
});

test("a finished course stops on the last lesson text, without a pause on a fresh visit", () => {
  const progress = { 1: { l: 1 }, 2: { l: 1 }, o1: { l: 1 }, 3: { l: 1 } };
  const fresh = nextFlowItem(L, progress, { own: true });
  assert.equal(fresh.done, true);
  assert.equal(fresh.pause, false);
  assert.equal(fresh.lessonId, "ep02");
  const crossed = nextFlowItem(L, progress, { own: true, last: "question", anchor: "ep01" });
  assert.equal(crossed.done, true);
  assert.equal(crossed.pause, true);
});

test("the step just shown is not repeated while another remains", () => {
  const step = nextFlowItem(L, {}, { just: "theory:ep01" });
  assert.equal(step.ticketId, 1);
});

test("a fully blocked course still returns a step", () => {
  const step = nextFlowItem(
    [{ id: "ep01", num: 1, title: "Дорога", lead: "", tickets_lesson: [1] }],
    {},
    { avoid: ["theory:ep01", "1"] },
  );
  assert.equal(step.kind, "theory");
});

test("no lessons means no step", () => {
  assert.equal(nextFlowItem([], {}), null);
});

test("knowledge is told by lesson, not by a solved count", () => {
  assert.match(knowledgeLine(L, {}), /Ответов пока нет/);
  assert.match(knowledgeLine(L, { 1: { l: 1 }, 2: { l: 1 }, o1: { l: 1 } }, { own: true }), /На все вопросы сейчас отвечено правильно: Дорога/);
  assert.match(knowledgeLine(L, { 1: { l: 1 }, 2: { l: 1 }, o1: { l: 1 } }, { own: true }), /Ещё не начаты: Знаки/);
  assert.match(knowledgeLine(L, { 1: { l: 0 } }, { own: true }), /Требуют внимания: Дорога/);
  assert.match(knowledgeLine(L, { 1: { l: 1 } }, { own: true }), /В работе: Дорога/);
  const many = [1, 2, 3, 4].map(n => ({ id: "e" + n, num: n, title: "Тема " + n, tickets_lesson: [n] }));
  const progress = { 1: { l: 1 }, 2: { l: 1 }, 3: { l: 1 }, 4: { l: 1 } };
  assert.match(knowledgeLine(many, progress), /Тема 1 и ещё 3/);
  assert.doesNotMatch(knowledgeLine(L, progress), /921|Решено/);
});

test("review stays with mistakes and answered questions", () => {
  const studied = { 1: { l: 1 }, 2: { l: 1 }, o1: { l: 1 } };
  const step = nextFlowItem(L, studied, { mode: "review", own: true });
  assert.equal(step.again, true);
  assert.equal(step.ticketId, 1);
  assert.equal(nextFlowItem(L, {}, { mode: "review" }).kind, "theory");
  assert.equal(nextFlowItem(L, {}, { mode: "review" }).lessonId, "ep01");
});

test("a finished course continues with repetition after the stop", () => {
  const progress = { 1: { l: 1 }, 2: { l: 1 }, o1: { l: 1 }, 3: { l: 1 } };
  const step = nextFlowItem(L, progress, { own: true, repeat: true });
  assert.equal(step.again, true);
  assert.equal(step.done, false);
  assert.equal(step.ticketId, 1);
  const next = nextFlowItem(L, progress, { own: true, repeat: true, just: flowKey(step) });
  assert.equal(next.ticketId, 2);
});

test("the flow place survives a reload", () => {
  const run = cleanFlowRun({ last: "theory", anchor: "ep01", avoid: ["theory:ep01:1", 4], part: 2, partLesson: "ep01", repeat: true, just: "1" });
  assert.deepEqual(run, { last: "theory", anchor: "ep01", avoid: ["theory:ep01:1"], part: 2, partLesson: "ep01", repeat: true });
  assert.deepEqual(cleanFlowRun(null), { avoid: [], part: 0, repeat: false });
});

test("lesson status follows answers, not publication", () => {
  assert.equal(lessonStatus(L[0], {}, { own: true }), "Не начат");
  assert.equal(lessonStatus(L[0], { 1: { l: 0 } }, { own: true }), "Есть ошибки");
  assert.equal(lessonStatus(L[0], { 1: { l: 1 }, 2: { l: 1 }, o1: { l: 1 } }, { own: true }), "Вопросы отвечены");
  assert.equal(lessonStatus({ id: "ep09", num: 9, title: "Пусто" }, {}), "Текст");
});
