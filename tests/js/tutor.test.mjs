import { test } from "node:test";
import assert from "node:assert/strict";
import { flowKey, nextFlowItem } from "../../packages/domain/flow.ts";
import { REVIEW_GAP_MS } from "../../packages/domain/review.ts";
import { skillState } from "../../packages/domain/evidence.ts";
import { PILOT_SKILLS } from "../../packages/domain/skills.ts";

const ep03 = {
  id: "ep03", num: 3, title: "Перекрёсток", lead: "Выезд со двора.",
  own_items: ["o-ep03-01", "o-ep03-02", "o-ep03-07", "o-ep03-08"],
};
const ep07 = {
  id: "ep07", num: 7, title: "Остановка", lead: "Имя перерыва.",
  own_items: ["o-ep07-01", "o-ep07-02", "o-ep07-03", "o-ep07-04", "o-ep07-06"],
};
const yard = PILOT_SKILLS.find(skill => skill.id === "yard-exit");

const ask = (progress, opts) => nextFlowItem([ep03], progress, { mode: "mix", own: true, ...opts });

function walk(tutor, answers) {
  let progress = {};
  let last;
  let anchor;
  let just;
  let fromProbe = false;
  const seen = [];
  for (let n = 0; n < 8; n++) {
    const step = nextFlowItem([ep03], progress, { mode: "mix", own: true, last, anchor, just, fromProbe, tutor, now: 1_000 + n });
    seen.push({ kind: step.kind, id: step.ticketId ?? null, reason: step.reason ?? null });
    if (step.kind === "theory") {
      last = "theory";
      anchor = step.lessonId;
      just = flowKey(step);
      fromProbe = false;
      continue;
    }
    const mark = answers[String(step.ticketId)] ?? 0;
    progress = { ...progress, [step.ticketId]: mark === 0 ? { l: 0, t: 1_000 + n, lc: 2 } : { l: mark, t: 1_000 + n } };
    last = "question";
    anchor = step.lessonId;
    just = String(step.ticketId);
    fromProbe = step.reason === "misconception-check";
  }
  return { seen, progress };
}

test("a new learner gets the lesson text and no diagnostic", () => {
  const step = ask({}, {});
  assert.equal(step.kind, "theory");
  assert.equal(step.reason, undefined);
  assert.equal(ask({}, { mode: "explain" }).kind, "theory");
});

test("after a mapped miss the new flow asks one probe and the old flow returns to the text", () => {
  const wrong = { "o-ep03-01": { l: 0, t: 1, lc: 2 } };
  const opts = { last: "question", anchor: "ep03", just: "o-ep03-01" };
  const probe = ask(wrong, opts);
  const text = ask(wrong, { ...opts, tutor: false });
  assert.equal(probe.ticketId, "o-ep03-07");
  assert.equal(probe.reason, "misconception-check");
  assert.equal(text.kind, "theory");
  assert.equal(ask({ ...wrong, "o-ep03-07": { l: 0, t: 2 } }, { ...opts, just: "o-ep03-07" }).kind, "theory");
  assert.equal(ask({ ...wrong, "o-ep03-07": { l: 1, t: 2 } }, { ...opts, just: "o-ep03-07" }).kind, "theory");
  assert.equal(ask(wrong, { ...opts, avoid: ["o-ep03-07"] }).focus, "yard");
  assert.equal(ask({ "o-ep03-01": { l: 0, t: 1, lc: 0 } }, opts).ticketId, "o-ep03-07");
  assert.equal(ask({ "o-ep03-01": { l: 0, t: 1 } }, opts).kind, "theory");
  assert.equal(ask({ "o-ep03-08": { l: 0, t: 1 } }, { ...opts, just: "o-ep03-08" }).kind, "theory");
  assert.equal(ask({ 1: { l: 0 }, "o-ep03-01": { l: 0 } }, { ...opts, own: false, just: "1" }).kind, "theory");
  assert.deepEqual(ask(wrong, opts), ask(wrong, opts));
});

test("the same wrong answers reach the probe once, then the text", () => {
  const novice = walk(true, {});
  const previous = walk(false, {});
  assert.deepEqual(novice.seen.slice(0, 4), [
    { kind: "theory", id: null, reason: null },
    { kind: "question", id: "o-ep03-01", reason: null },
    { kind: "question", id: "o-ep03-07", reason: "misconception-check" },
    { kind: "theory", id: null, reason: null },
  ]);
  assert.equal(previous.seen.filter(step => step.reason === "misconception-check").length, 0);
  assert.equal(previous.seen[2].kind, "theory");
  assert.equal(novice.seen.filter(step => step.reason === "misconception-check").length, 1);
  assert.deepEqual(walk(true, {}), walk(true, {}));
});

test("a partial miss on the stop is one contrast, then the text", () => {
  const lesson = [ep07];
  const progress = { "o-ep07-03": { l: 0, t: 1, lc: 1 } };
  const opts = { mode: "mix", own: true, last: "question", anchor: "ep07", just: "o-ep07-03" };
  const probe = nextFlowItem(lesson, progress, opts);
  assert.equal(probe.ticketId, "o-ep07-04");
  assert.equal(probe.reason, "misconception-check");
  const forced = { "o-ep07-03": { l: 0, t: 1, lc: 2 } };
  assert.equal(nextFlowItem(lesson, forced, opts).ticketId, "o-ep07-02");
  const seen = { ...forced, "o-ep07-02": { l: 1, t: 2 } };
  const fragment = nextFlowItem(lesson, seen, opts);
  assert.equal(fragment.kind, "theory");
  assert.equal(fragment.focus, "vynuzhdennaya");
  assert.equal(nextFlowItem(lesson, forced, { ...opts, avoid: ["o-ep07-02"] }).focus, "vynuzhdennaya");
  const again = nextFlowItem(lesson, { ...progress, "o-ep07-04": { l: 0, t: 2, lc: 0 } }, { ...opts, just: "o-ep07-04" });
  assert.equal(again.kind, "theory");
  assert.equal(again.focus, "ostanovka");
  const later = {
    "o-ep07-03": { l: 0, t: 1, lc: 1 },
    "o-ep07-02": { l: 0, t: 2, lc: 0 },
  };
  const ownMiss = { mode: "mix", own: true, last: "question", anchor: "ep07", just: "o-ep07-02" };
  assert.equal(nextFlowItem(lesson, later, ownMiss).ticketId, "o-ep07-06");
  assert.equal(nextFlowItem(lesson, later, { ...ownMiss, fromProbe: true }).kind, "theory");
  const fact = nextFlowItem(lesson, { "o-ep07-01": { l: 0, t: 1 } }, { ...opts, just: "o-ep07-01" });
  assert.equal(fact.kind, "theory");
  assert.equal(nextFlowItem(lesson, progress, { ...opts, mode: "explain" }).kind, "theory");
});

test("spacing moves an old item ahead only after a day, and does not replace a new question", () => {
  const course = [
    { id: "ep01", num: 1, title: "Дорога", lead: "", tickets_lesson: [1, 2] },
  ];
  const now = REVIEW_GAP_MS * 5;
  const progress = { 1: { l: 1, t: now }, 2: { l: 1, t: 0 } };
  const aged = nextFlowItem(course, progress, { repeat: true, now });
  const fresh = nextFlowItem(course, progress, { repeat: true });
  const recent = nextFlowItem(course, { 1: { l: 1, t: now }, 2: { l: 1, t: now } }, { repeat: true, now });
  assert.equal(aged.ticketId, 2);
  assert.equal(aged.reason, "spaced-review");
  assert.equal(fresh.ticketId, 1);
  assert.equal(fresh.reason, undefined);
  assert.equal(recent.ticketId, 1);
  assert.equal(recent.reason, undefined);
  const open = nextFlowItem(
    [{ ...ep03, tickets_lesson: [9] }],
    { "o-ep03-01": { l: 1, t: 0 }, "o-ep03-02": { l: 1, t: 0 }, "o-ep03-07": { l: 1, t: 0 }, "o-ep03-08": { l: 1, t: 0 } },
    { own: true, now: REVIEW_GAP_MS * 5 },
  );
  assert.equal(open.ticketId, 9);
  assert.equal(open.again, undefined);
});

test("an experienced miss on a transfer stays a gap and returns to the text", () => {
  const main = PILOT_SKILLS.find(skill => skill.id === "main-road");
  const progress = {
    "o-ep03-02": { l: 1, t: 1 }, "o-ep03-03": { l: 1, t: 2 }, "o-ep03-04": { l: 1, t: 3 }, "o-ep03-05": { l: 0, t: 4 },
  };
  assert.equal(skillState(main, progress).status, "gap");
  const lesson = [{ ...ep03, own_items: ["o-ep03-02", "o-ep03-03", "o-ep03-04", "o-ep03-05"] }];
  const step = nextFlowItem(lesson, progress, { mode: "mix", own: true, last: "question", anchor: "ep03", just: "o-ep03-05" });
  assert.equal(step.kind, "theory");
  assert.equal(step.reason, undefined);
});

test("a finished pilot stays available to repeat", () => {
  const progress = { "o-ep03-01": { l: 1, t: 1 }, "o-ep03-02": { l: 1, t: 2 }, "o-ep03-07": { l: 1, t: 3 }, "o-ep03-08": { l: 1, t: 4 } };
  const done = ask(progress, {});
  assert.equal(done.done, true);
  assert.equal(done.kind, "theory");
  const again = ask(progress, { repeat: true });
  assert.equal(again.again, true);
  assert.equal(again.done, false);
  assert.equal(skillState(yard, progress).status, "confirmed");
});
