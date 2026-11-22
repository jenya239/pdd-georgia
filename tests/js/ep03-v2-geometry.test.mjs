import test from "node:test";
import assert from "node:assert/strict";
import {
  B1, HALF, PATCH_LEN, STOP_DIAGRAM, VIEW, changedFactors, expectation, kinematic,
  measureStartsAtEdge, signOnRight, spreadVerticalMaterial, surfaceAt, worldToScreen, worldsDoc,
} from "../../video/episodes/ep03/v2/engine/model.mjs";
import { buildFrame, roadMaterials } from "../../video/episodes/ep03/v2/engine/frame.mjs";
import { prototypeAState, prototypeCState, snowState } from "../../video/episodes/ep03/v2/engine/stories.mjs";

const red = kinematic("red");
const blue = kinematic("blue");

test("A2 keeps dirt beyond a short mouth patch; A3 paves the whole branch; cars stay", () => {
  assert.equal(PATCH_LEN, 12);
  assert.equal(HALF, 7);
  assert.equal(surfaceAt("A2", red.x, red.y), "dirt");
  assert.equal(surfaceAt("A2", 0, -10), "paved");
  assert.equal(surfaceAt("A2", 0, 40), "dirt");
  assert.equal(surfaceAt("A2", blue.x, blue.y), "paved");
  assert.equal(surfaceAt("A3", red.x, red.y), "paved");
  assert.equal(surfaceAt("A3", 0, 40), "paved");
  assert.equal(surfaceAt("A3", 0, -70), "paved");
  for (const id of ["A0", "A1", "A2", "A3", "A4", "A5"]) {
    assert.equal(worldsDoc.worlds[id].geometry, "cross");
  }
  assert.deepEqual(kinematic("blue"), kinematic("blue"));
  assert.equal(JSON.stringify(kinematic("blue")), JSON.stringify({ id: "blue", x: -38, y: 0, headingDeg: 0, maneuver: "straight_east" }));
  assert.equal(JSON.stringify(kinematic("red")), JSON.stringify({ id: "red", x: 0, y: -38, headingDeg: 90, maneuver: "straight_north" }));
});

test("A2→A3 spread changes only the vertical surface and matches the endpoints", () => {
  const delta = changedFactors("A2", "A3");
  assert.deepEqual(delta.changed, ["surface"]);
  assert.equal(delta.vehiclesSame, true);
  for (const y of [-70, -30, -10, 0, 40, 60]) {
    assert.equal(spreadVerticalMaterial(y, 0), surfaceAt("A2", 0, y) === "indeterminate" ? "dirt" : surfaceAt("A2", 0, y));
    assert.equal(spreadVerticalMaterial(y, 1), "paved");
  }
  assert.equal(spreadVerticalMaterial(-80, 0.5), "dirt");
  assert.equal(spreadVerticalMaterial(-10, 0.5), "paved");
  assert.equal(spreadVerticalMaterial(70, 0.5), "dirt");
});

test("yard and through-road keep the same cars and do not invent a north road for the yard", () => {
  assert.equal(surfaceAt("C1", 0, 40), null);
  assert.equal(surfaceAt("C1", 0, -30), "paved");
  assert.equal(surfaceAt("C2", 0, 40), "paved");
  assert.equal(surfaceAt("C1", blue.x, blue.y), "paved");
  assert.equal(surfaceAt("C2", red.x, red.y), "paved");
  const delta = changedFactors("C1", "C2");
  assert.deepEqual(delta.changed, ["geometry"]);
  assert.equal(delta.vehiclesSame, true);
  assert.equal(expectation("C1").yielder, "red");
  assert.equal(expectation("C2").yielder, "blue");
});

test("snow and the bending main have no winner, and the 5 m mark starts at the edge", () => {
  assert.equal(expectation("A5").winner, null);
  assert.equal(expectation("A5").kind, "underdetermined");
  assert.equal(surfaceAt("A5", 0, -40), "indeterminate");
  assert.equal(surfaceAt("A5", blue.x, blue.y), "indeterminate");
  assert.equal(expectation("B1").winner, null);
  assert.equal(B1.winner, null);
  assert.deepEqual(B1.mainArms, ["west", "north"]);
  assert.deepEqual(B1.plate[0][0] < 0 && B1.plate[2][1] > 0, true);
  assert.equal(measureStartsAtEdge(), true);
  assert.equal(STOP_DIAGRAM.measureStartX, STOP_DIAGRAM.crossingLeft);
  assert.notEqual(STOP_DIAGRAM.measureStartX, STOP_DIAGRAM.crossingCenterX);
  const snow = buildFrame(snowState());
  assert.ok(roadMaterials(snow).every((material) => material === "snow"));
  assert.throws(() => buildFrame({ ...snowState(), cars: { blueAlong: 1, redAlong: 0 } }));
  assert.throws(() => buildFrame({ scene: "bend", world: "B1", cars: { blueAlong: 1, redAlong: 0, grayAlong: 0 } }));
});

test("priority signs stand on the driver's right, before the crossing", () => {
  const signs = worldsDoc.worlds.A4.signs;
  const redSign = signs.find((sign) => sign.driver === "red");
  const blueSign = signs.find((sign) => sign.driver === "blue");
  assert.equal(signOnRight(90, redSign.approxWorldPosition[0], redSign.approxWorldPosition[1]), true);
  assert.equal(signOnRight(0, blueSign.approxWorldPosition[0], blueSign.approxWorldPosition[1]), true);
  assert.equal(redSign.code, "2.1");
  assert.equal(blueSign.code, "2.3");
  for (const sign of B1.signs) {
    const heading = sign.driver === "blue" ? 0 : sign.driver === "red" ? 270 : sign.driver === "gray" ? 180 : 90;
    assert.equal(signOnRight(heading, sign.x, sign.y), true, sign.driver);
  }
});

test("prototype A holds identical cars while only the branch paving changes, then swaps who proceeds", () => {
  const before = prototypeAState(1);
  const mid = prototypeAState(8.5);
  const afterHold = prototypeAState(11);
  const outcome = prototypeAState(18.5);
  const yielding = prototypeAState(3.6);
  assert.equal(yielding.cars.redBrake, true);
  assert.equal(yielding.cars.blueAlong > 0.2, true);
  assert.equal(before.world, "A2");
  assert.equal(before.cars.blueAlong, 0);
  assert.equal(before.cars.redAlong, 0);
  assert.equal(before.pave.type, "patch");
  assert.ok(mid.pave.u > 0.2 && mid.pave.u < 0.8);
  assert.equal(mid.cars.blueAlong, 0);
  assert.equal(afterHold.pave.u, 1);
  assert.equal(afterHold.cars.redAlong, 0);
  assert.equal(outcome.world, "A3");
  assert.equal(outcome.cars.blueAlong, 0);
  assert.equal(outcome.cars.redAlong, 1);
  assert.equal(outcome.cars.blueBrake, true);
  assert.equal(spreadVerticalMaterial(-70, mid.pave.u), "dirt");
  assert.equal(spreadVerticalMaterial(70, mid.pave.u), "dirt");
  for (const y of [-70, 70]) {
    const screenY = worldToScreen(0, y)[1];
    assert.ok(screenY > 8 && screenY < VIEW.height - 8, `dirt tail y=${y} left the frame`);
  }
  const carsBefore = buildFrame({ ...before, layers: "cars" });
  const carsAfter = buildFrame({ ...afterHold, layers: "cars" });
  assert.deepEqual(
    carsBefore.shapes.filter((shape) => shape.role === "car"),
    carsAfter.shapes.filter((shape) => shape.role === "car"),
  );
  const early = buildFrame(before);
  const late = buildFrame(afterHold);
  assert.ok(roadMaterials(early).includes("dirt"));
  assert.ok(roadMaterials(early).includes("paved"));
  assert.ok(roadMaterials(late).every((material) => material === "paved"));
  assert.ok(roadMaterials(buildFrame(prototypeAState(10.4))).includes("dirt"));
  assert.equal(early.shapes.some((shape) => shape.role === "sign"), false);
  assert.equal(late.shapes.some((shape) => shape.role === "sign"), false);
  assert.ok(buildFrame(yielding).shapes.some((shape) => shape.fill === "#ff2a2a"));
  let grew = null;
  let covered = null;
  for (let i = 0; i <= 220; i++) {
    const state = prototypeAState(i / 10);
    if (grew === null && state.pave.type === "spread" && state.pave.u > 0.02) grew = i / 10;
    if (covered === null && state.pave.u >= 0.999) covered = i / 10;
  }
  assert.ok(covered - grew >= 3, `pave grew too fast: ${grew} → ${covered}`);
});

test("prototype C keeps the cars and pedestrian while the yard context gives way to a through road", () => {
  const yard = prototypeCState(1.2);
  const mid = prototypeCState(7.8);
  const throughHold = prototypeCState(9.5);
  const outcome = prototypeCState(18);
  assert.equal(yard.world, "C1");
  assert.equal(yard.yardU, 0);
  assert.equal(throughHold.world, "C2");
  assert.equal(throughHold.yardU, 1);
  assert.ok(mid.yardU > 0.2 && mid.yardU < 0.8);
  assert.equal(yard.cars.blueAlong, 0);
  assert.equal(throughHold.cars.redAlong, 0);
  assert.equal(outcome.cars.blueBrake, true);
  assert.equal(outcome.cars.redAlong, 1);
  const a = buildFrame({ ...yard, layers: "cars" });
  const b = buildFrame({ ...throughHold, layers: "cars" });
  assert.deepEqual(
    a.shapes.filter((shape) => shape.role === "car"),
    b.shapes.filter((shape) => shape.role === "car"),
  );
  const yardFrame = buildFrame(yard);
  const throughFrame = buildFrame(throughHold);
  assert.equal(yardFrame.shapes.some((shape) => shape.kind === "yard" && shape.opacity === 1), true);
  assert.equal(throughFrame.shapes.some((shape) => shape.kind === "far-cross"), true);
  assert.equal(yardFrame.shapes.some((shape) => shape.kind === "far-cross"), false);
  assert.ok(yardFrame.shapes.some((shape) => shape.role === "pedestrian"));
  assert.ok(throughFrame.shapes.some((shape) => shape.role === "pedestrian"));
});
