import assert from "node:assert/strict";
import test from "node:test";
import {
  EXIT,
  LANE,
  LEFT_SOUTH,
  SAFETY,
  STOP,
  VEHICLE_LENGTH,
  VEHICLE_WIDTH,
  headingOf,
  maxHeadingStep,
  minCenterDistance,
  pathOf,
  pointOn,
  pathsConflict,
} from "../../packages/intersection/geometry.ts";

const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} !~ ${expected}`);

test("a southbound wait sits on the right-hand lane", () => {
  const south = pointOn("S", STOP);
  near(south.x, LANE);
  near(south.y, -STOP);
  const north = pointOn("N", STOP);
  near(north.x, -LANE);
  near(north.y, STOP);
  const west = pointOn("W", STOP);
  near(west.x, -STOP);
  near(west.y, -LANE);
  near(headingOf("S"), Math.PI / 2);
});

test("opposite straights pass on the right and do not meet", () => {
  const south = pathOf("S", "straight");
  const north = pathOf("N", "straight");
  const gap = minCenterDistance(south, north);
  near(gap, LANE * 2, 0.02);
  assert.equal(pathsConflict(south, north), false);
  assert.ok(gap > VEHICLE_WIDTH + SAFETY);
});

test("crossing straights meet inside the junction", () => {
  const south = pathOf("S", "straight");
  const east = pathOf("E", "straight");
  assert.ok(minCenterDistance(south, east) < 0.05);
  assert.equal(pathsConflict(south, east), true);
  assert.equal(pathsConflict(south, pathOf("W", "straight")), true);
});

test("a right turn from the south stays in the south-east and misses the north and east straights", () => {
  const right = pathOf("S", "right");
  const end = right[right.length - 1];
  near(end.x, EXIT, 1e-6);
  near(end.y, -LANE, 1e-6);
  near(end.heading, 0, 1e-6);
  assert.ok(right.every((sample) => sample.x > 0 && sample.y < -LANE + 0.02));
  assert.equal(pathsConflict(right, pathOf("N", "straight")), false);
  assert.equal(pathsConflict(right, pathOf("E", "straight")), false);
  assert.equal(pathsConflict(right, pathOf("W", "straight")), true);
});

test("the south left turn is tangent at both ends and crosses the oncoming lane", () => {
  const left = pathOf("S", "left");
  near(left[0].x, LANE);
  near(left[0].y, -STOP);
  const end = left[left.length - 1];
  near(end.x, -EXIT, 1e-6);
  near(end.y, LANE, 1e-6);
  assert.ok(Math.abs(Math.atan2(Math.sin(end.heading - Math.PI), Math.cos(end.heading - Math.PI))) < 1e-6);
  assert.ok(left.some((sample) => Math.abs(sample.x + LANE) < 0.03 && Math.abs(sample.y) < 0.5));
  assert.equal(pathsConflict(left, pathOf("N", "straight")), true);
  assert.equal(pathsConflict(left, pathOf("N", "right")), true);
});

test("two opposite left turns do not occupy the same swept body", () => {
  const south = pathOf("S", "left");
  const north = pathOf("N", "left");
  const gap = minCenterDistance(south, north);
  assert.ok(gap > VEHICLE_WIDTH + SAFETY, `center gap ${gap}`);
  assert.equal(pathsConflict(south, north), false);
  assert.equal(rasterOverlap(south, north), false);
});

test("headings change continuously on every maneuver", () => {
  for (const from of ["N", "E", "S", "W"]) {
    for (const maneuver of ["straight", "left", "right"]) {
      const step = maxHeadingStep(pathOf(from, maneuver));
      assert.ok(step < 0.45, `${from} ${maneuver} step ${step}`);
    }
  }
});

test("rotating both paths does not create or remove a conflict", () => {
  const pairs = [
    ["S", "straight", "N", "straight", false],
    ["S", "straight", "E", "straight", true],
    ["S", "right", "E", "straight", false],
    ["S", "left", "N", "straight", true],
    ["S", "left", "N", "left", false],
  ];
  for (const [aFrom, aMove, bFrom, bMove, conflict] of pairs) {
    assert.equal(pathsConflict(pathOf(aFrom, aMove), pathOf(bFrom, bMove)), conflict);
    assert.equal(
      pathsConflict(pathOf(rotate(aFrom), aMove), pathOf(rotate(bFrom), bMove)),
      conflict,
      `${aFrom} ${aMove} vs ${bFrom} ${bMove}`,
    );
  }
});

test("the published left-turn polygon matches an independent Bernstein sample", () => {
  const { p0, p1, p2, p3 } = LEFT_SOUTH;
  const mid = bernstein(0.5, p0, p1, p2, p3);
  const left = pathOf("S", "left");
  const closest = left.reduce((best, sample) => {
    const distance = Math.hypot(sample.x - mid.x, sample.y - mid.y);
    return distance < best ? distance : best;
  }, Infinity);
  assert.ok(closest < 0.03, `sampler missed the analytic midpoint by ${closest}`);
  assert.ok(mid.x < 0.05 && mid.y < 0.05, `midpoint should sit south-west of centre, got ${mid.x},${mid.y}`);
});

test("a body longer than the sample step still catches a perpendicular crossing", () => {
  assert.ok(VEHICLE_LENGTH > 0.08);
  assert.equal(pathsConflict(pathOf("S", "straight"), pathOf("E", "straight")), true);
});

function rotate(dir) {
  return { S: "W", W: "N", N: "E", E: "S" }[dir];
}

function bernstein(t, a, b, c, d) {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

/** Grid fill of oriented rectangles. Independent of the production SAT. */
function rasterOverlap(a, b) {
  const scale = 40;
  const fill = (samples) => {
    const cells = new Set();
    const halfL = VEHICLE_LENGTH / 2 + SAFETY / 2;
    const halfW = VEHICLE_WIDTH / 2 + SAFETY / 2;
    for (const sample of samples) {
      const ux = Math.cos(sample.heading);
      const uy = Math.sin(sample.heading);
      for (let i = -1; i <= 1; i += 0.25) {
        for (let j = -1; j <= 1; j += 0.25) {
          const x = sample.x + ux * halfL * i - uy * halfW * j;
          const y = sample.y + uy * halfL * i + ux * halfW * j;
          cells.add(`${Math.round(x * scale)},${Math.round(y * scale)}`);
        }
      }
    }
    return cells;
  };
  const left = fill(a);
  for (const cell of fill(b)) if (left.has(cell)) return true;
  return false;
}
