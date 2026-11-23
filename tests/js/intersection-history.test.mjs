import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { cleanState } from "../../packages/domain/bundle.ts";
import { SCHEMA_VERSION } from "../../packages/domain/registry.ts";
import { SOLVED_CASES } from "../../packages/intersection/cases.ts";
import { explainRight } from "../../packages/intersection/explain.ts";
import { advancePause, historyCursor } from "../../packages/intersection/playback.ts";
import {
  freshProgress, HISTORY_LIMIT, parseProgress, recordProgress, rememberSituation, situationSummary,
} from "../../packages/intersection/progress.ts";
import { openSession, reduce } from "../../packages/intersection/session.ts";
import { decide } from "../../packages/intersection/solver.ts";

const read = (path) => readFileSync(path, "utf8");
const byId = (id) => SOLVED_CASES.find((item) => item.id === id);
const step = {
  vehicleId: "2",
  correct: true,
  text: "Автомобиль 2 приближается справа, поэтому ехать может он.",
  norms: [{ id: "st36-p4-v", label: "ст. 36, п. 4 «в»" }],
  highlight: { selected: "2", yieldTo: ["1"], paths: ["1", "2"], signs: [] },
};

test("a correct equal-road choice explains who is on the right and cites the norm", () => {
  const item = byId("yield-right");
  const decision = decide(item.scene);
  assert.equal(explainRight(item.scene, decision, "1"), null);
  const explanation = explainRight(item.scene, decision, "2");
  assert.equal(explanation.tone, "ok");
  assert.match(explanation.text, /справа/);
  assert.match(explanation.text, /2/);
  assert.equal(explanation.norms.some((norm) => norm.id === "st36-p4-v"), true);
  assert.deepEqual(explanation.highlight.yieldTo, ["1"]);
});

test("a correct main-road choice points at the signs and the car that waits", () => {
  const item = byId("main-cross");
  const explanation = explainRight(item.scene, decide(item.scene), "1");
  assert.match(explanation.text, /главн/);
  assert.equal(explanation.norms.some((norm) => norm.id === "st36-p4-a"), true);
  assert.ok(explanation.highlight.signs.includes("S"));
  assert.ok(explanation.highlight.signs.includes("E"));
});

test("a correct left-turn choice names the turn and the oncoming car", () => {
  const item = byId("left-oncoming");
  const explanation = explainRight(item.scene, decide(item.scene), "2");
  assert.match(explanation.text, /налево/);
  assert.match(explanation.text, /2/);
  assert.equal(explanation.norms.some((norm) => norm.id === "st36-p4-g"), true);
});

test("a correct choice whose paths miss does not invent a yield", () => {
  const item = byId("opposite-straight");
  const explanation = explainRight(item.scene, decide(item.scene), "1");
  assert.equal(explanation.tone, "ok");
  assert.match(explanation.text, /не меша/);
  assert.equal(explanation.norms.length, 0);
  assert.doesNotMatch(explanation.text, /должен уступить/);
});

test("a clear main-road pair cites the priority norm without making anyone wait", () => {
  const item = byId("main-clear");
  const explanation = explainRight(item.scene, decide(item.scene), "2");
  assert.match(explanation.text, /не пересек|не меша/);
  assert.equal(explanation.norms.some((norm) => norm.id === "st36-p4-a"), true);
  assert.deepEqual(explanation.highlight.yieldTo, []);
});

test("every admissible choice gets a short explanation from the decision, not a compass", () => {
  for (const item of SOLVED_CASES) {
    const decision = decide(item.scene);
    for (const id of decision.admissible) {
      const explanation = explainRight(item.scene, decision, id);
      assert.ok(explanation, `${item.id} ${id}`);
      assert.equal(explanation.tone, "ok");
      assert.ok(explanation.text.includes(id), item.id);
      assert.ok(explanation.text.length < 240, `${item.id}: ${explanation.text}`);
      assert.doesNotMatch(explanation.text, /север|восток|запад|юг|решатель|проверенный срез/, item.id);
      if (item.waits.length) assert.ok(explanation.norms.length > 0, item.id);
    }
  }
});

test("a correct step keeps its explanation through the drive and after the car has passed", () => {
  const moving = reduce(openSession(byId("yield-right").scene), { type: "select", id: "2" });
  assert.equal(moving.outcome, "go");
  assert.equal(moving.phase, "moving");
  assert.equal(moving.explanation.tone, "ok");
  assert.match(moving.explanation.text, /справа/);
  const after = reduce(moving, { type: "anim-done" });
  assert.equal(after.phase, "ready");
  assert.match(after.explanation.text, /справа/);
  const last = reduce(after, { type: "select", id: "1" });
  assert.match(last.explanation.text, /не осталось/);
  assert.doesNotMatch(last.explanation.text, /автомобилю 2/);
  const finished = reduce(last, { type: "anim-done" });
  assert.equal(finished.phase, "done");
  assert.equal(finished.explanation.tone, "ok");
  const wrong = reduce(openSession(byId("yield-right").scene), { type: "select", id: "1" });
  assert.equal(wrong.explanation.tone, "bad");
});

test("back and forward walk saved situations and stop at the ends", () => {
  assert.equal(historyCursor(0, 0, -1), 0);
  assert.equal(historyCursor(0, 0, 1), 0);
  assert.equal(historyCursor(3, 3, -1), 2);
  assert.equal(historyCursor(2, 3, -1), 1);
  assert.equal(historyCursor(0, 3, -1), 0);
  assert.equal(historyCursor(2, 3, 1), 3);
  assert.equal(historyCursor(3, 3, 1), 3);
});

test("the next situation waits through a visible pause, longer when motion is reduced", () => {
  assert.ok(advancePause(false) >= 1000);
  assert.ok(advancePause(true) > advancePause(false));
});

test("history survives a reload, a concept tally does not erase it, and the cap keeps the newest", () => {
  const scene = byId("yield-right").scene;
  let log = rememberSituation(freshProgress(), { scenario: scene, steps: [step] });
  log = recordProgress(log, "right", true);
  assert.equal(log.answered, 1);
  assert.equal(log.history.length, 1);
  const restored = parseProgress(JSON.parse(JSON.stringify(log)));
  assert.equal(restored.history[0].steps[0].vehicleId, "2");
  assert.equal(restored.history[0].scenario.vehicles.length, 2);
  assert.equal(situationSummary(restored.history[0]).text, step.text);
  const summary = situationSummary({
    scenario: scene,
    steps: [step, { ...step, vehicleId: "1", text: "остался один", norms: [] }],
  });
  assert.equal(summary.text, step.text);
  let capped = freshProgress();
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
    capped = rememberSituation(capped, {
      scenario: { ...scene, id: `s${i}` },
      steps: [{ ...step, text: `t${i}` }],
    });
  }
  assert.equal(capped.history.length, HISTORY_LIMIT);
  assert.equal(capped.history[0].steps[0].text, "t5");
  assert.equal(capped.history.at(-1).steps[0].text, `t${HISTORY_LIMIT + 4}`);
});

test("an old counter file still loads, and a broken history does not throw or wipe the counts", () => {
  const old = parseProgress({ version: 1, answered: 3, firstTry: 1, concepts: {} });
  assert.equal(old.answered, 3);
  assert.deepEqual(old.history, []);
  assert.equal(parseProgress("nope").history.length, 0);
  assert.equal(parseProgress(null).answered, 0);
  assert.doesNotThrow(() => parseProgress(undefined));
  const kept = parseProgress({
    version: 1,
    answered: 5,
    firstTry: 2,
    concepts: { right: { seen: 1, firstTry: 0, missed: 1 } },
    history: "broken",
  });
  assert.equal(kept.answered, 5);
  assert.equal(kept.firstTry, 2);
  assert.deepEqual(kept.history, []);
  const scene = byId("yield-right").scene;
  const mixed = parseProgress({
    version: 1,
    answered: 5,
    firstTry: 2,
    concepts: {},
    history: [
      { scenario: { vehicles: [] }, steps: [step] },
      { scenario: scene, steps: [step] },
      null,
      { scenario: scene, steps: "nope" },
    ],
  });
  assert.equal(mixed.answered, 5);
  assert.equal(mixed.history.length, 1);
  assert.equal(mixed.history[0].steps[0].norms[0].id, "st36-p4-v");
  assert.equal(parseProgress({ version: 9, answered: 4, firstTry: 4, concepts: {}, history: [1] }).answered, 0);
});

test("the ticket journal stays schema 5 while a valid trainer history survives export", () => {
  assert.equal(SCHEMA_VERSION, 5);
  const scene = byId("yield-right").scene;
  const cleaned = cleanState({
    intersection: {
      version: 1,
      answered: 1,
      firstTry: 0,
      concepts: {},
      history: [{ scenario: scene, steps: [step] }],
    },
  });
  assert.equal(cleaned.intersection.history.length, 1);
  assert.equal(cleaned.intersection.history[0].steps[0].vehicleId, "2");
  assert.equal(cleaned.intersection.history[0].steps[0].highlight.yieldTo[0], "1");
  const dropped = cleanState({
    intersection: { version: 1, answered: 4, firstTry: 1, concepts: {}, history: "broken" },
  });
  assert.equal(dropped.intersection.answered, 4);
  assert.equal(dropped.intersection.history, undefined);
  assert.equal(cleanState({ intersection: { version: 9, answered: 4 } }).intersection, undefined);
  const sample = cleanState({
    intersection: { version: 1, answered: 2, firstTry: 1, concepts: { right: { seen: 1, firstTry: 0, missed: 1 } } },
  });
  assert.deepEqual(sample.intersection, {
    version: 1, answered: 2, firstTry: 1, concepts: { right: { seen: 1, firstTry: 0, missed: 1 } },
  });
});

test("the page offers back and forward, auto-advances after the pause, and keeps the previous review", () => {
  const page = read("web/assets/pages/intersection.mjs");
  assert.ok(page.includes('id="hist-back"'));
  assert.ok(page.includes(">Назад<"));
  assert.ok(page.includes('id="hist-forward"'));
  assert.ok(page.includes(">Вперёд<"));
  assert.ok(page.includes('event.key === "ArrowLeft"'));
  assert.ok(page.includes('event.key === "ArrowRight"'));
  assert.ok(page.includes("По прошлой задаче"));
  assert.ok(page.includes("advancePause(motionQuery.matches)"));
  assert.ok(page.includes("historyCursor"));
  assert.ok(page.includes("rememberSituation"));
  assert.ok(page.includes("situationSummary"));
  assert.ok(page.includes('armAuto("Следующая ситуация"'));
  assert.ok(page.includes('armAuto("Сравнить ситуацию"'));
  assert.ok(page.includes("неверно"));
  assert.ok(page.includes("верно"));
  const css = read("web/assets/intersection.css");
  assert.ok(css.includes(".ix-history"));
  assert.ok(css.includes(".ix-past"));
  assert.match(css, /\.ix-history button\{[^}]*min-height:48px/);
});
