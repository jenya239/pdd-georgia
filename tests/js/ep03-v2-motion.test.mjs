import assert from "node:assert/strict";
import test from "node:test";
import { buildFrame } from "../../video/episodes/ep03/v2/engine/frame.mjs";
import { directedState } from "../../video/episodes/ep03/v2/engine/stories.mjs";
import { spreadVerticalMaterial } from "../../video/episodes/ep03/v2/engine/model.mjs";

function roads(frame) {
  return frame.shapes.filter((shape) => shape.role === "road");
}

test("the prologue opens on a road and only later becomes the intersection", () => {
  const opening = buildFrame(directedState(0, { id: "S00.1", u: 0, ordinal: 0, count: 3, inLead: true }));
  assert.equal(opening.meta.scene, "prologue");
  assert.equal(opening.shapes.some((shape) => shape.role === "car"), false);
  assert.equal(roads(opening).length, 0);
  assert.equal(opening.shapes.some((shape) => shape.kind === "surface"), true);
  const named = buildFrame(directedState(0, { id: "S00.1", u: 0.7, ordinal: 0, count: 3, inLead: false }));
  assert.equal(named.shapes.some((shape) => shape.role === "prologue-focus" && shape.kind === "sign"), true);
  assert.equal(roads(named).length, 0);
  const compare = buildFrame(directedState(0, { id: "S00.2", u: 0.2, ordinal: 1, count: 3, inLead: false }));
  assert.equal(compare.shapes.some((shape) => shape.role === "car"), false);
  assert.equal(roads(compare).length, 0);
  const arrived = buildFrame(directedState(0, { id: "S00.3", u: 0.95, ordinal: 2, count: 3, inLead: false }));
  assert.ok(roads(arrived).length >= 2);
  assert.equal(arrived.shapes.some((shape) => shape.role === "car"), true);
  assert.equal(arrived.shapes.some((shape) => shape.role === "sign"), false);
  assert.equal(arrived.meta.centers.blue.x < 0, true);
  assert.equal(arrived.meta.centers.red.y < 0, true);
});

test("the patch stays local and the full pave is the only change that swaps the passage", () => {
  const early = directedState(2, { id: "S02.1", u: 0.1, ordinal: 0, count: 2, inLead: false });
  const seen = directedState(2, { id: "S02.1", u: 0.9, ordinal: 0, count: 2, inLead: false });
  assert.ok(early.pave.length < seen.pave.length);
  assert.equal(seen.pave.length, 12);
  assert.equal(seen.cars.blueAlong, 0);
  assert.equal(seen.cars.redAlong, 0);
  assert.ok(seen.view.scale < early.view.scale);
  const going = directedState(2, { id: "S02.2", u: 0.8, ordinal: 1, count: 2, inLead: false });
  assert.ok(going.cars.blueAlong > 0.4);
  assert.equal(going.cars.redAlong, 0);
  const mid = directedState(3, { id: "S03.1", u: 0.5, ordinal: 0, count: 2, inLead: false });
  assert.equal(mid.cars.blueAlong, 0);
  assert.equal(mid.cars.redAlong, 0);
  assert.ok(mid.pave.u > 0.2 && mid.pave.u < 0.95);
  assert.equal(spreadVerticalMaterial(70, mid.pave.u), "dirt");
  const after = directedState(3, { id: "S03.2", u: 0.8, ordinal: 1, count: 2, inLead: false });
  assert.equal(after.world, "A3");
  assert.equal(after.cars.blueAlong, 0);
  assert.ok(after.cars.redAlong > 0.4);
  assert.equal(buildFrame(after).shapes.some((shape) => shape.role === "sign"), false);
});

test("snow and the bending main still do not award a passage", () => {
  const snow = directedState(5, { id: "S05.3", u: 0.5, ordinal: 2, count: 3, inLead: false });
  assert.equal(snow.world, "A5");
  assert.equal(snow.cars.blueAlong, 0);
  assert.equal(snow.snow, 1);
  const bend = directedState(6, { id: "S06.2", u: 0.7, ordinal: 1, count: 3, inLead: false });
  assert.equal(bend.scene, "bend");
  assert.equal(bend.cars.blueAlong, 0);
  assert.equal(bend.cars.redAlong, 0);
  assert.doesNotThrow(() => buildFrame({ ...bend, overlays: ["Не определено"] }));
});
