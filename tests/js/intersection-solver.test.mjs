import assert from "node:assert/strict";
import test from "node:test";
import { EDGE_CASES, SOLVED_CASES } from "../../packages/intersection/cases.ts";
import { mirrorScenario, rotateScenario, scenario } from "../../packages/intersection/model.ts";
import { admissibleKey, blocking, decide } from "../../packages/intersection/solver.ts";
import { closingNote, explainWrong } from "../../packages/intersection/explain.ts";

test("every hand-marked case matches the statute, not a second call used as the oracle", () => {
  for (const item of [...SOLVED_CASES, ...EDGE_CASES]) {
    const decision = decide(item.scene);
    assert.equal(decision.status, item.status, item.id);
    assert.deepEqual(decision.admissible, item.admissible, item.id);
    for (const wait of item.waits) {
      const relation = blocking(decision, wait.id);
      assert.ok(relation, `${item.id}: ${wait.id} should wait`);
      assert.equal(relation.effect, "yield");
      assert.ok(relation.norms.includes(wait.norm), `${item.id} norms ${relation.norms.join(",")}`);
    }
    if (item.waits.length === 0) {
      assert.equal(decision.relations.some((relation) => relation.effect === "yield"), false, item.id);
    }
  }
});

test("a main-road crossing is not decided by who is on the right", () => {
  const item = SOLVED_CASES.find((entry) => entry.id === "main-cross");
  const decision = decide(item.scene);
  const waiting = blocking(decision, "2");
  assert.equal(waiting.rule, "main");
  assert.ok(!waiting.norms.includes("st36-p4-v"));
  const forgotten = decide(item.scene, { omit: ["main"] });
  assert.notDeepEqual(forgotten.admissible, item.admissible);
});

test("deleting the equal-road right-hand rule changes the cited norm", () => {
  const item = SOLVED_CASES.find((entry) => entry.id === "yield-right");
  const full = blocking(decide(item.scene), "1");
  const omitted = blocking(decide(item.scene, { omit: ["right"] }), "1");
  assert.equal(full.rule, "right");
  assert.notEqual(omitted.rule, "right");
  const both = decide(item.scene, { omit: ["right", "fallback"] });
  assert.deepEqual(both.admissible, []);
  assert.equal(both.status, "indeterminate");
});

test("deleting the left-turn exception lets the oncoming conflict go unordered", () => {
  const item = SOLVED_CASES.find((entry) => entry.id === "left-oncoming");
  const omitted = decide(item.scene, { omit: ["left"] });
  assert.notDeepEqual(omitted.admissible, item.admissible);
  assert.equal(omitted.status, "indeterminate");
});

test("either admissible vehicle is a correct choice", () => {
  const item = SOLVED_CASES.find((entry) => entry.id === "right-clear");
  const decision = decide(item.scene);
  assert.deepEqual(decision.admissible, ["1", "2"]);
  assert.equal(explainWrong(item.scene, decision, "1"), null);
  assert.equal(explainWrong(item.scene, decision, "2"), null);
  const note = closingNote(decision);
  assert.match(note, /не сходятся|не мешают/);
});

test("rotation keeps the same vehicles admissible", () => {
  for (const item of SOLVED_CASES) {
    for (let step = 1; step < 4; step++) {
      const turned = decide(rotateScenario(item.scene, step));
      assert.deepEqual(turned.admissible, item.admissible, `${item.id} rot ${step}`);
      assert.equal(turned.status, item.status);
    }
  }
});

test("renumbering renames the admissible set and does not change who waits", () => {
  const item = SOLVED_CASES.find((entry) => entry.id === "yield-right");
  const renamed = {
    ...item.scene,
    vehicles: item.scene.vehicles.map((vehicle) => ({ ...vehicle, id: vehicle.id === "1" ? "a" : "b" })),
  };
  const decision = decide(renamed);
  assert.deepEqual(decision.admissible, ["b"]);
  assert.equal(blocking(decision, "a").norms.includes("st36-p4-v"), true);
});

test("seed and an extra paint field do not change the decision", () => {
  const item = SOLVED_CASES.find((entry) => entry.id === "main-from-left");
  const painted = { ...item.scene, seed: 99, paint: "red" };
  assert.equal(admissibleKey(decide(painted)), admissibleKey(decide(item.scene)));
});

test("a mirror is a different legal situation", () => {
  const item = SOLVED_CASES.find((entry) => entry.id === "yield-right");
  const mirrored = decide(mirrorScenario(item.scene));
  assert.notDeepEqual(mirrored.admissible, item.admissible);
});

test("removing the north car from the four-way cycle frees only the east car", () => {
  const cycle = EDGE_CASES[0].scene;
  const kept = cycle.vehicles.filter((vehicle) => vehicle.from !== "N");
  const decision = decide({ ...cycle, vehicles: kept });
  assert.equal(decision.status, "ready");
  assert.deepEqual(decision.admissible, ["4"]);
});

test("three cars are not forced into one total order", () => {
  const scene = scenario({
    id: "three",
    pattern: "equal",
    vehicles: [
      { id: "1", from: "S", maneuver: "straight" },
      { id: "2", from: "E", maneuver: "straight" },
      { id: "3", from: "W", maneuver: "straight" },
    ],
  });
  const decision = decide(scene);
  assert.equal(decision.status, "ready");
  assert.deepEqual(decision.admissible, ["2"]);
});

test("unverified patterns are refused instead of answered", () => {
  const base = SOLVED_CASES[0].scene;
  const dirt = decide({
    ...base,
    approaches: base.approaches.map((arm) => arm.id === "E" ? { ...arm, surface: "dirt" } : arm),
  });
  assert.equal(dirt.status, "unsupported");
  assert.equal(dirt.reason, "surface");
  const bent = decide({
    ...base,
    approaches: base.approaches.map((arm) => {
      if (arm.id === "S" || arm.id === "E") return { ...arm, sign: "main" };
      return { ...arm, sign: "yield" };
    }),
  });
  assert.equal(bent.status, "unsupported");
  assert.equal(bent.reason, "unverified-priority");
  const yard = decide({
    ...base,
    approaches: base.approaches.map((arm) => arm.id === "S" ? { ...arm, role: "adjacent" } : arm),
  });
  assert.equal(yard.reason, "adjacent");
  const stopped = decide({
    ...base,
    approaches: base.approaches.map((arm) => arm.id === "E" ? { ...arm, sign: "stop" } : arm),
  });
  assert.equal(stopped.reason, "stop-sign");
  const signal = decide({ ...base, control: "signal" });
  assert.equal(signal.reason, "regulated");
});

test("a wrong equal-road choice names the right-hand rule and both cars", () => {
  const item = SOLVED_CASES.find((entry) => entry.id === "yield-right");
  const decision = decide(item.scene);
  const explanation = explainWrong(item.scene, decision, "1");
  assert.match(explanation.text, /Автомобиль 1/);
  assert.match(explanation.text, /Автомобиль 2/);
  assert.match(explanation.text, /справа/);
  assert.equal(explanation.norms.some((norm) => norm.id === "st36-p4-v"), true);
  assert.deepEqual(explanation.highlight.yieldTo, ["2"]);
  assert.deepEqual(explanation.highlight.paths, ["1", "2"]);
  assert.equal(explanation.highlight.signs.length, 0);
});

test("a wrong main-road choice points at the signs, not at the right-hand side", () => {
  const item = SOLVED_CASES.find((entry) => entry.id === "main-cross");
  const explanation = explainWrong(item.scene, decide(item.scene), "2");
  assert.match(explanation.text, /главн/);
  assert.match(explanation.assumption, /справа/);
  assert.equal(explanation.decisive, "знак главной дороги");
  assert.ok(explanation.highlight.signs.includes("S"));
  assert.ok(explanation.highlight.signs.includes("E"));
  assert.notEqual(explanation.text, explainWrong(SOLVED_CASES.find((entry) => entry.id === "yield-right").scene, decide(SOLVED_CASES.find((entry) => entry.id === "yield-right").scene), "1").text);
});

test("the four-way cycle explanation refuses to crown a number", () => {
  const item = EDGE_CASES[0];
  const explanation = explainWrong(item.scene, decide(item.scene), "1");
  assert.match(explanation.text, /не устанавливают|не называют/);
});
