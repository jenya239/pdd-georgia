import assert from "node:assert/strict";
import test from "node:test";
import { SOLVED_CASES } from "../../packages/intersection/cases.ts";
import {
  PALETTES,
  carColor,
  creep,
  ease,
  frame,
  hotspots,
  labelPx,
  motionMs,
  onAsphalt,
  signAnchor,
  signAnchors,
  toCanvas,
  treeSpots,
  waitingSample,
} from "../../packages/intersection/picture.ts";
import { STOP, pointOn } from "../../packages/intersection/geometry.ts";

const scene = SOLVED_CASES.find((item) => item.id === "main-cross").scene;

test("waiting cars sit on the stop line of their approach", () => {
  const south = scene.vehicles[0];
  const pose = waitingSample(south);
  const stop = pointOn("S", STOP);
  assert.ok(Math.abs(pose.x - stop.x) < 1e-6);
  assert.ok(Math.abs(pose.y - stop.y) < 1e-6);
});

test("priority signs sit off the asphalt and clear of the stop line", () => {
  for (const dir of ["N", "E", "S", "W"]) {
    const anchor = signAnchor(dir);
    assert.equal(onAsphalt(anchor), false, dir);
  }
  const southCar = waitingSample(scene.vehicles[0]);
  for (const anchor of signAnchors(scene)) {
    const distance = Math.hypot(anchor.x - southCar.x, anchor.y - southCar.y);
    assert.ok(distance > 0.3, `${anchor.dir} ${distance}`);
  }
  assert.equal(signAnchors(scene).length, 4);
});

test("trees stay in the corners, off the carriageway", () => {
  for (const tree of treeSpots()) assert.equal(onAsphalt(tree), false);
});

test("both styles share the geometry and differ in the road color", () => {
  assert.notEqual(PALETTES.ink.asphalt, PALETTES.soft.asphalt);
  assert.equal(carColor(0, "ink") !== carColor(0, "soft") || PALETTES.ink.grass !== PALETTES.soft.grass, true);
  assert.deepEqual(signAnchors(scene).map((item) => [item.x, item.y]), signAnchors(scene).map((item) => [item.x, item.y]));
});

test("the south car is below the north car, and the touch target stays at least 48px", () => {
  const view = frame(390, 390);
  const south = toCanvas(waitingSample(scene.vehicles[0]), view);
  const north = toCanvas(pointOn("N", STOP), view);
  assert.ok(south.y > north.y);
  const hits = hotspots(scene, 320, 320, ["1", "2"]);
  assert.equal(hits.length, 2);
  assert.ok(hits.every((hit) => hit.size >= 48));
  assert.ok(labelPx(frame(390, 390).scale) >= 16);
});

test("reduced motion skips the tween and a creep returns to the stop line", () => {
  assert.equal(motionMs("go", true), 0);
  assert.equal(motionMs("stop", true), 0);
  assert.ok(motionMs("go", false) > motionMs("stop", false));
  assert.equal(creep(0), 0);
  assert.ok(Math.abs(creep(1)) < 1e-9);
  assert.ok(creep(0.5) > 0.1);
  assert.ok(ease(0.5) > 0.4 && ease(0.5) < 0.6);
});
