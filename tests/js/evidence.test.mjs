import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DUE_MS, PROMPT_MS, skillState } from "../../packages/domain/evidence.ts";
import { applyAnswer, isMastered, undoLast } from "../../packages/domain/progress.ts";
import { FOLLOW_UPS, PILOT_SKILLS } from "../../packages/domain/skills.ts";

const yard = PILOT_SKILLS.find(skill => skill.id === "yard-exit");
const main = PILOT_SKILLS.find(skill => skill.id === "main-road");
const stop = PILOT_SKILLS.find(skill => skill.id === "stop-name");

const load = (name) => JSON.parse(readFileSync(new URL(`../../content/${name}`, import.meta.url), "utf8"));

test("pilot items are checked questions, and a follow-up is not the same question", () => {
  const items = [...load("checkitems/ep03.json"), ...load("checkitems/ep07.json")];
  const byId = new Map(items.map(item => [item.id, item]));
  const misconceptions = new Set(load("ontology/misconceptions.json").map(item => item.id));
  assert.equal(new Set(PILOT_SKILLS.map(skill => skill.id)).size, PILOT_SKILLS.length);
  for (const skill of PILOT_SKILLS) {
    assert.equal(new Set(skill.items.map(item => item.id)).size, skill.items.length);
    for (const item of skill.items) {
      const source = byId.get(item.id);
      assert.ok(source, item.id);
      assert.equal(Number.isInteger(source.answer), true);
      assert.ok(source.norms.length > 0);
      assert.ok(source.quote?.text);
    }
  }
  for (const row of FOLLOW_UPS) {
    assert.notEqual(row.after, row.probe);
    assert.ok(byId.get(row.after));
    assert.ok(byId.get(row.probe));
    assert.ok(row.hypothesis.length > 0);
    for (const id of row.hypothesis) assert.ok(misconceptions.has(id), id);
    const skill = PILOT_SKILLS.find(item => item.lessonId === row.lessonId);
    assert.ok(skill.items.some(item => item.id === row.probe));
  }
  assert.match(byId.get("o-ep03-07").q, /перекрёсток/);
  assert.equal(byId.get("o-ep03-07").answer, 1);
  assert.equal(FOLLOW_UPS.some(row => row.after === "o-ep03-08" || row.probe === "o-ep03-08"), false);
  assert.equal(FOLLOW_UPS.some(row => row.after === "o-ep03-09" || row.probe === "o-ep03-09"), false);
  assert.equal(FOLLOW_UPS.some(row => row.after === "o-ep07-01"), false);
});

test("a repeated ticket is not a confirmed skill, and a contrast is", () => {
  let ticket = applyAnswer(null, { ok: true, choice: 1, now: 10_000, hash: "h" });
  ticket = applyAnswer(ticket, { ok: true, choice: 1, now: 11_000, hash: "h" });
  assert.equal(isMastered(ticket), true);
  const memorizer = skillState(yard, { "o-ep03-01": ticket, "o-ep03-02": { l: 0, t: 20_000 } });
  const learner = skillState(yard, { "o-ep03-01": ticket, "o-ep03-02": { l: 1, t: 20_000 } });
  assert.equal(memorizer.status, "gap");
  assert.equal(memorizer.label, "требуется практика");
  assert.equal(learner.status, "confirmed");
  assert.equal(learner.label, "подтверждено на разных задачах");
  assert.equal(isMastered(ticket), true);
  assert.equal(skillState(yard, {}).label, "ещё не проверяли");
  assert.equal(JSON.stringify(Object.values({ a: memorizer.label, b: learner.label })).includes("%"), false);
});

test("one shared situation does not confirm both skills", () => {
  const only = { "o-ep03-02": { l: 1, t: 1 } };
  assert.equal(skillState(yard, only).status, "practiced");
  assert.equal(skillState(main, only).status, "practiced");
  const transferred = { ...only, "o-ep03-03": { l: 1, t: 2 } };
  assert.equal(skillState(yard, transferred).status, "practiced");
  assert.equal(skillState(main, transferred).status, "confirmed");
});

test("a correct answer immediately after a miss is not an independent check", () => {
  const told = { l: 1, t: 70_000, lw: 70_000 - PROMPT_MS + 1 };
  const later = { l: 1, t: 70_000 + PROMPT_MS, lw: 70_000 };
  assert.equal(skillState(yard, { "o-ep03-01": told, "o-ep03-02": { l: 1, t: 80_000 } }).status, "practiced");
  assert.equal(skillState(yard, { "o-ep03-01": later, "o-ep03-02": { l: 1, t: 80_000 } }).status, "confirmed");
});

test("undoing the confirming answer drops the skill", () => {
  let ticket = applyAnswer(null, { ok: false, choice: 0, now: 1, hash: "h" });
  ticket = applyAnswer(ticket, { ok: true, choice: 1, now: PROMPT_MS + 5, hash: "h" });
  const progress = { "o-ep03-01": ticket, "o-ep03-02": { l: 1, t: PROMPT_MS + 6 } };
  assert.equal(skillState(yard, progress).status, "confirmed");
  const undone = undoLast(ticket);
  assert.equal(skillState(yard, { "o-ep03-01": undone.record, "o-ep03-02": progress["o-ep03-02"] }).status, "gap");
});

test("a changed question text does not keep the old confirmation", () => {
  const progress = {
    "o-ep03-01": { l: 1, t: 1, events: [{ t: 1, ok: 1, hash: "old" }] },
    "o-ep03-02": { l: 1, t: 2, events: [{ t: 2, ok: 1, hash: "new" }] },
  };
  const stale = skillState(yard, progress, { hashes: { "o-ep03-01": "new", "o-ep03-02": "new" } });
  assert.equal(stale.status, "practiced");
  assert.deepEqual(stale.independent, ["o-ep03-02"]);
});

test("a gap stays a gap after time, and a clean skill becomes due", () => {
  const old = { "o-ep07-03": { l: 1, t: 0 }, "o-ep07-04": { l: 1, t: 0 } };
  assert.equal(skillState(stop, old, { now: DUE_MS }).status, "due");
  assert.equal(skillState(stop, old, { now: DUE_MS }).label, "пора повторить");
  assert.equal(skillState(stop, { ...old, "o-ep07-05": { l: 0, t: 1 } }, { now: DUE_MS }).status, "gap");
});
