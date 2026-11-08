import { test } from "node:test";
import assert from "node:assert/strict";
import { completeStep, currentStep, studyFor, studyLeft } from "../../packages/domain/session.ts";

test("a study alternates kinds and keeps a wrong ticket out of practice", () => {
  const study = studyFor({
    id: "s",
    lesson: "ep07",
    theory: ["ostanovka", "stoyanka"],
    breakdown: ["stoyanka"],
    variation: ["o-ep07-01"],
    tickets: [
      { id: "886", mastered: false, lastWrong: false },
      { id: "894", mastered: false, lastWrong: true },
      { id: "357", mastered: true, lastWrong: false },
    ],
  });
  assert.deepEqual(study.steps.map((step) => step.kind), ["theory", "practice", "review", "breakdown", "variation", "theory"]);
  assert.deepEqual(study.steps.filter((step) => step.kind === "practice").map((step) => step.ref), ["886"]);
  assert.equal(currentStep(study).ref, "ostanovka");
  const next = completeStep(study);
  assert.equal(next.cursor, 1);
  assert.equal(study.cursor, 0);
  assert.equal(studyLeft(next), 5);
  assert.equal(currentStep(completeStep({ ...study, cursor: study.steps.length })), null);
});
