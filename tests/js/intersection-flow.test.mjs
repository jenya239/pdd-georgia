import assert from "node:assert/strict";
import test from "node:test";
import { SOLVED_CASES } from "../../packages/intersection/cases.ts";
import { counterfactual, followUp, leadFor } from "../../packages/intersection/counterfactual.ts";
import { bugReport, familiesCovered, generate, shrink } from "../../packages/intersection/generate.ts";
import { signature } from "../../packages/intersection/model.ts";
import { freshProgress, parseProgress, recordProgress } from "../../packages/intersection/progress.ts";
import { openSession, reduce } from "../../packages/intersection/session.ts";
import { decide } from "../../packages/intersection/solver.ts";

const byId = (id) => SOLVED_CASES.find((item) => item.id === id);

test("the same seed rebuilds the same task and a walk covers every solved family", () => {
  const first = generate(4);
  assert.deepEqual(generate(4), first);
  assert.equal(first.echo.status, "ready");
  assert.ok(first.echo.admissible.length > 0);
  assert.deepEqual(first.echo, {
    status: decide(first.scenario).status,
    admissible: decide(first.scenario).admissible,
  });
  const seeds = SOLVED_CASES.map((_, index) => index);
  const families = new Set(SOLVED_CASES.map((item) => item.family));
  assert.deepEqual(familiesCovered(seeds), [...families].sort());
  const seen = new Set(seeds.map((seed) => generate(seed).signature));
  assert.deepEqual(seen, new Set(SOLVED_CASES.map((item) => signature(item.scene))));
});

test("a later rotation is the same legal situation, not a new one", () => {
  assert.equal(generate(0).signature, generate(SOLVED_CASES.length).signature);
  assert.notEqual(generate(0).scenario.id, generate(1).scenario.id);
});

test("every generated task can be cleared by always taking an admissible vehicle", () => {
  for (let seed = 0; seed < 40; seed++) {
    let session = openSession(generate(seed).scenario);
    assert.equal(session.phase, "ready", `seed ${seed}`);
    let guard = 0;
    while (session.phase !== "done" && guard < 8) {
      const choice = session.decision.admissible[0];
      session = reduce(session, { type: "select", id: choice });
      assert.equal(session.outcome, "go");
      session = reduce(session, { type: "anim-done" });
      guard += 1;
    }
    assert.equal(session.phase, "done", `seed ${seed}`);
    assert.equal(session.firstTryWrong, false);
  }
});

test("picking an admissible alternative is not a mistake, and a wrong pick does not remove the car", () => {
  const clear = openSession(byId("right-clear").scene);
  let moved = reduce(clear, { type: "select", id: "1" });
  assert.equal(moved.outcome, "go");
  moved = reduce(moved, { type: "select", id: "2" });
  assert.equal(moved.actor, "1");
  const yieldRight = openSession(byId("yield-right").scene);
  let wrong = reduce(yieldRight, { type: "select", id: "1" });
  assert.equal(wrong.outcome, "stop");
  wrong = reduce(wrong, { type: "anim-done" });
  assert.equal(wrong.phase, "error");
  assert.deepEqual(wrong.remaining, ["1", "2"]);
  assert.match(wrong.explanation.text, /справа/);
  wrong = reduce(wrong, { type: "anim-done" });
  assert.deepEqual(wrong.remaining, ["1", "2"]);
  const repaired = reduce(reduce(wrong, { type: "select", id: "2" }), { type: "anim-done" });
  assert.equal(repaired.phase, "ready");
  assert.deepEqual(repaired.decision.admissible, ["1"]);
});

test("a right-hand miss proposes a single maneuver change that really changes who may go", () => {
  const scene = byId("yield-right").scene;
  const pair = followUp(scene, "1");
  assert.deepEqual(pair.facts, ["maneuver:1"]);
  assert.equal(pair.admissibleChanged, true);
  assert.deepEqual(pair.beforeDecision.admissible, ["2"]);
  assert.deepEqual(pair.afterDecision.admissible, ["1", "2"]);
  assert.match(pair.why, /манёвр/);
  assert.doesNotMatch(leadFor(pair.delta), /сначала/);
});

test("removing the main-road signs is one fact and can keep or change the answer", () => {
  const changed = counterfactual(byId("main-cross").scene, { kind: "signs", to: "none" });
  assert.deepEqual(changed.facts, ["signs"]);
  assert.equal(changed.admissibleChanged, true);
  assert.deepEqual(changed.beforeDecision.admissible, ["1"]);
  assert.deepEqual(changed.afterDecision.admissible, ["2"]);
  assert.match(changed.why, /[Зз]нак/);
  assert.match(changed.why, /изменилось/);

  const same = counterfactual(byId("main-clear").scene, { kind: "signs", to: "none" });
  assert.deepEqual(same.facts, ["signs"]);
  assert.equal(same.admissibleChanged, false);
  assert.match(same.why, /осталось прежним|не изменил/);
});

test("an untaught surface change is not given an answer", () => {
  const pair = counterfactual(byId("yield-right").scene, { kind: "surface", approach: "E", to: "dirt" });
  assert.equal(pair.afterSupported, false);
  assert.equal(pair.afterDecision.status, "unsupported");
  assert.match(pair.why, /не будет угадан|не подставляет/);
});

test("shrink keeps a failing scene smaller, and the bug report has no learner fields", () => {
  const scene = byId("main-left").scene;
  const fails = (item) => item.vehicles.some((vehicle) => vehicle.maneuver !== "straight")
    || item.approaches.some((arm) => arm.sign !== "none");
  const shrunk = shrink(scene, fails);
  assert.ok(fails(shrunk));
  assert.ok(shrunk.vehicles.every((vehicle) => vehicle.maneuver === "straight"));
  assert.ok(shrunk.approaches.some((arm) => arm.sign !== "none"));
  const report = bugReport(scene);
  assert.deepEqual(Object.keys(report).sort(), ["generator", "id", "scenario", "seed", "signature", "solver"]);
  assert.equal(JSON.stringify(report).includes("progress"), false);
});

test("a corrupt progress file resets instead of throwing", () => {
  const fresh = freshProgress();
  const next = recordProgress(fresh, "right", false);
  assert.equal(next.answered, 1);
  assert.equal(next.firstTry, 0);
  assert.equal(next.concepts.right.missed, 1);
  assert.equal(parseProgress(JSON.parse(JSON.stringify(next))).concepts.right.seen, 1);
  assert.equal(parseProgress("nope").answered, 0);
  assert.equal(parseProgress({ version: 0, answered: 4, firstTry: 4, concepts: {} }).answered, 0);
});
