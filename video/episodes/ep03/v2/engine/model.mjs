/**
 * Legal geometry for ep03/v2. Coordinates come from design/worlds.json.
 * This module does not decide a winner from pixels: expectations are data,
 * and underdetermined scenes refuse a moving "first" vehicle.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const worldsDoc = JSON.parse(readFileSync(join(here, "../design/worlds.json"), "utf8"));

export const SCALE = 7.2;
export const VIEW = { width: 1920, height: 1080, x0: -100, x1: 100, y0: -75, y1: 75 };

const cross = worldsDoc.geometry.cross;
export const HALF = cross.roads[0].halfWidth;
export const PATCH_LEN = worldsDoc.worlds.A2.surface.localPatch.lengthApprox;

export function worldToScreen(x, y) {
  return [240 + (x + 100) * SCALE, (75 - y) * SCALE];
}

function onRoad(road, x, y) {
  const [a, b] = road.extent;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const hw = road.halfWidth;
  if (road.axis === "x") return y >= -hw && y <= hw && x >= lo && x <= hi;
  return x >= -hw && x <= hw && y >= lo && y <= hi;
}

function geometryOf(worldId) {
  const id = worldsDoc.worlds[worldId]?.geometry;
  return worldsDoc.geometry[id] ?? null;
}

/** Material on the vertical arm, ignoring snow. Patch covers the mouth and PATCH_LEN before it. */
export function verticalMaterial(worldId, y) {
  if (worldId === "A2") {
    const south = -(HALF + PATCH_LEN);
    return y >= south && y <= HALF ? "paved" : "dirt";
  }
  if (worldId === "A3" || worldId === "C1" || worldId === "C2") return "paved";
  if (worldId === "A5") return "indeterminate";
  return "dirt";
}

/**
 * A2→A3 spread. u=0 is the short patch, u=1 paves the whole vertical branch.
 * Cars, signs and the horizontal road are not parameters of this function.
 */
export function spreadVerticalMaterial(y, u) {
  if (u >= 0.999) return "paved";
  const south0 = -(HALF + PATCH_LEN);
  const south = south0 - u * (south0 - VIEW.y0);
  const north = HALF + u * (VIEW.y1 - HALF);
  return y >= south && y <= north ? "paved" : "dirt";
}

export function surfaceAt(worldId, x, y) {
  const world = worldsDoc.worlds[worldId];
  if (!world) throw new Error(`unknown world ${worldId}`);
  const geom = geometryOf(worldId);
  if (!geom) return null;
  const roads = geom.roads;
  const vertical = roads.find((r) => r.id === "v");
  const horizontal = roads.find((r) => r.id === "h");
  const onV = vertical ? onRoad(vertical, x, y) : false;
  const onH = horizontal ? onRoad(horizontal, x, y) : false;
  if (!onV && !onH) return null;
  if (world.visibility === "snow-obscures-surface") return "indeterminate";
  if (onV) return verticalMaterial(worldId, y);
  if (world.surface.h === "unknown") return "indeterminate";
  return world.surface.h;
}

export function kinematic(carId = "blue") {
  const car = worldsDoc.vehicleTemplates[carId];
  return {
    id: car.id,
    x: car.start.x,
    y: car.start.y,
    headingDeg: car.start.headingDeg,
    maneuver: car.maneuver,
  };
}

export function sameKinematics(worldIds) {
  const blue = kinematic("blue");
  const red = kinematic("red");
  return worldIds.every((id) => {
    const expected = worldsDoc.geometry[worldsDoc.worlds[id].geometry]?.vehicles;
    return expected?.includes("blue") && expected?.includes("red")
      && JSON.stringify(blue) === JSON.stringify(kinematic("blue"))
      && JSON.stringify(red) === JSON.stringify(kinematic("red"));
  });
}

export function expectation(worldId) {
  return worldsDoc.worlds[worldId].expected;
}

export function refusesWinner(worldId) {
  const kind = expectation(worldId).kind;
  return kind === "underdetermined" || kind === "legal-review-required" || kind === "question"
    || kind === "documented_incident" || kind === "distinct_stopping_and_parking_restrictions"
    || kind === "synthesis_not_new_rule";
}

/** Right-hand side of an approach, in world axes. Heading 0 is east, 90 is north. */
export function signOnRight(headingDeg, x, y) {
  if (headingDeg === 0) return y < -HALF && x < -HALF;
  if (headingDeg === 90) return x > HALF && y < -HALF;
  if (headingDeg === 180) return y > HALF && x > HALF;
  if (headingDeg === 270) return x < -HALF && y > HALF;
  return false;
}

export function signsFor(worldId) {
  return worldsDoc.worlds[worldId].signs.map((sign) => ({ ...sign }));
}

/**
 * B1 is not a solved queue. Main road runs west → north, matching plate 8.13.
 * No vehicle is allowed to "win".
 */
export const B1 = {
  mainArms: ["west", "north"],
  secondaryArms: ["east", "south"],
  plate: [[-32, 0], [0, 0], [0, 32]],
  cars: [
    { id: "blue", x: -36, y: 0, headingDeg: 0, group: "main", mark: "circle" },
    { id: "red", x: 0, y: 36, headingDeg: 270, group: "main", mark: "square" },
    { id: "gray", x: 36, y: 0, headingDeg: 180, group: "secondary", mark: "triangle" },
  ],
  signs: [
    { code: "2.1", driver: "blue", x: -22, y: -11 },
    { code: "2.1", driver: "red", x: -11, y: 22 },
    { code: "2.3", driver: "gray", x: 22, y: 11 },
    { code: "2.3", driver: "south-approach", x: 11, y: -22 },
  ],
  winner: null,
};

/** Screen-space stopping diagram. The 5 m bracket starts at the carriageway edge. */
export const STOP_DIAGRAM = {
  crossingLeft: 250,
  crossingRight: 470,
  crossingTop: 430,
  crossingBottom: 650,
  get crossingCenterX() { return (this.crossingLeft + this.crossingRight) / 2; },
  measureStartX: 250,
  measureEndX: 130,
  meters: 5,
  exception: "Исключение: напротив бокового выезда трёхстороннего пересечения со сплошной линией или разделительной полосой.",
};

export function measureStartsAtEdge() {
  return STOP_DIAGRAM.measureStartX === STOP_DIAGRAM.crossingLeft
    && STOP_DIAGRAM.measureStartX !== STOP_DIAGRAM.crossingCenterX;
}

export function changedFactors(fromId, toId) {
  const from = worldsDoc.worlds[fromId];
  const to = worldsDoc.worlds[toId];
  const changed = [];
  if (JSON.stringify(from.surface) !== JSON.stringify(to.surface)) changed.push("surface");
  if (JSON.stringify(from.signs) !== JSON.stringify(to.signs)) changed.push("signs");
  if (from.geometry !== to.geometry) changed.push("geometry");
  if (from.visibility !== to.visibility) changed.push("visibility");
  const cars = ["A0", "A1", "A2", "A3", "A4", "A5", "C1", "C2"];
  const vehiclesSame = cars.includes(fromId) && cars.includes(toId);
  return { changed, vehiclesSame, cameraSame: true };
}
