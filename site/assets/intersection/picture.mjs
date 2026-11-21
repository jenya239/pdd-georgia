import { DIR_FROM, MANEUVER_WORD } from "./model.mjs";
import { ROAD_HALF, pathOf, pointOn, rightVec } from "./geometry.mjs";
export const VIEW = 1.35;
export const PALETTES = {
    ink: {
        grass: "#c9d2c6",
        tree: "#667864",
        sidewalk: "#d2cdc2",
        asphalt: "#2a333c",
        mark: "#f4f0e6",
        car: ["#1d4f7a", "#c4511f"],
        disc: "#f7f4ee",
        ink: "#1c242c",
        shadow: "rgba(22, 28, 34, 0.32)",
        yieldMark: "#8e3b32",
        goMark: "#2f6b45",
    },
    soft: {
        grass: "#e4f3d4",
        tree: "#93b986",
        sidewalk: "#f7ecda",
        asphalt: "#838c7c",
        mark: "#fffaf2",
        car: ["#5b93bf", "#e3a36f"],
        disc: "#fffaf3",
        ink: "#2a241e",
        shadow: "rgba(48, 42, 36, 0.2)",
        yieldMark: "#9a5348",
        goMark: "#3d7a52",
    },
};
export function styleName(value) {
    return value === "ink" ? "ink" : "soft";
}
export function waitingSample(vehicle) {
    return pathOf(vehicle.from, vehicle.maneuver)[0];
}
export function signAnchor(dir) {
    const beside = pointOn(dir, 0.56);
    const right = rightVec(dir);
    return { x: beside.x + right.x * 0.38, y: beside.y + right.y * 0.38 };
}
export function signAnchors(scenario) {
    return scenario.approaches
        .filter((arm) => arm.sign === "main" || arm.sign === "yield")
        .map((arm) => ({ dir: arm.id, sign: arm.sign, ...signAnchor(arm.id) }));
}
export function treeSpots() {
    return [
        { x: -1.05, y: -1.05 },
        { x: 1.05, y: -1.05 },
        { x: -1.05, y: 1.05 },
        { x: 1.05, y: 1.05 },
    ];
}
export function frame(width, height) {
    const scale = Math.min(width, height) / (VIEW * 2);
    return { scale, ox: width / 2, oy: height / 2 };
}
export function toCanvas(point, view) {
    return { x: view.ox + point.x * view.scale, y: view.oy - point.y * view.scale };
}
export function labelPx(scale) {
    return Math.max(16, scale * 0.11);
}
export function hotspots(scenario, width, height, ids) {
    const view = frame(width, height);
    return scenario.vehicles.filter((vehicle) => ids.includes(vehicle.id)).map((vehicle) => {
        const pose = waitingSample(vehicle);
        const at = toCanvas(pose, view);
        return {
            id: vehicle.id,
            label: `Автомобиль ${vehicle.id}, ${DIR_FROM[vehicle.from]}, ${MANEUVER_WORD[vehicle.maneuver]}`,
            x: at.x,
            y: at.y,
            size: Math.max(48, view.scale * 0.36),
        };
    });
}
export function carColor(index, style) {
    return PALETTES[style].car[index % PALETTES[style].car.length];
}
export function motionMs(outcome, reduced) {
    if (reduced)
        return 0;
    return outcome === "go" ? 1100 : 520;
}
/** Ease used by the player. Exported so a test can lock the shape. */
export function ease(t) {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
}
/** A short creep forward and back. At 0 and 1 the car is on the stop line. */
export function creep(t) {
    const x = Math.min(1, Math.max(0, t));
    return Math.sin(x * Math.PI) * 0.16;
}
export function onAsphalt(point) {
    const box = ROAD_HALF;
    if (Math.abs(point.x) <= box && Math.abs(point.y) <= box)
        return true;
    if (Math.abs(point.x) <= box && Math.abs(point.y) >= box)
        return true;
    if (Math.abs(point.y) <= box && Math.abs(point.x) >= box)
        return true;
    return false;
}
