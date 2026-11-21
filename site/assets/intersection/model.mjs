/**
 * Declarative intersection situations.
 * Invariants:
 * - the solver reads only these fields; paint, seed and ids do not create priority
 * - a sign, surface or role may be stored before a rule exists; unsupported combinations
 *   stay out of the player stream
 * - vehicle ids are labels for input, not an order of passage
 */
export const SOLVER_VERSION = "intersection-0.1.0";
export const MODEL_VERSION = 1;
export const DIRS = ["N", "E", "S", "W"];
/** Clockwise on the map: a car south of the junction, facing north, lands on the west arm facing east. */
export const CW = { S: "W", W: "N", N: "E", E: "S" };
export const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };
/** The arm a driver sees on their right as they face the junction. */
export const RIGHT_OF = { N: "W", W: "S", S: "E", E: "N" };
export const DIR_FROM = {
    N: "с севера",
    E: "с востока",
    S: "с юга",
    W: "с запада",
};
export const MANEUVER_WORD = {
    straight: "прямо",
    left: "налево",
    right: "направо",
};
export function rotateDir(dir, steps) {
    let current = dir;
    const n = ((steps % 4) + 4) % 4;
    for (let i = 0; i < n; i++)
        current = CW[current];
    return current;
}
export function rotateScenario(scenario, steps) {
    const n = ((steps % 4) + 4) % 4;
    if (n === 0)
        return scenario;
    return {
        ...scenario,
        approaches: scenario.approaches.map((arm) => ({ ...arm, id: rotateDir(arm.id, n) })),
        vehicles: scenario.vehicles.map((vehicle) => ({ ...vehicle, from: rotateDir(vehicle.from, n) })),
    };
}
function arm(id, sign, role = "road", surface = "paved") {
    return { id, role, surface, sign };
}
/** Four paved road arms. `equal` has no priority signs. `main-ns` / `main-ew` are a straight main road. */
export function approachesFor(pattern) {
    if (pattern === "equal")
        return DIRS.map((id) => arm(id, "none"));
    if (pattern === "main-ns") {
        return [arm("N", "main"), arm("E", "yield"), arm("S", "main"), arm("W", "yield")];
    }
    return [arm("E", "main"), arm("W", "main"), arm("N", "yield"), arm("S", "yield")];
}
export function scenario(parts) {
    return {
        model: MODEL_VERSION,
        id: parts.id,
        seed: parts.seed ?? null,
        control: parts.control ?? "unregulated",
        approaches: parts.approaches ?? approachesFor(parts.pattern ?? "equal"),
        vehicles: parts.vehicles,
    };
}
/** Legally relevant shape. Rotation and renumbering collapse; a mirror does not. */
export function signature(scenario) {
    let best = "";
    for (let step = 0; step < 4; step++) {
        const turned = rotateScenario(scenario, step);
        const arms = [...turned.approaches].sort((a, b) => (a.id < b.id ? -1 : 1));
        const vehicles = [...turned.vehicles]
            .map((vehicle) => `${vehicle.from}:${vehicle.maneuver}`)
            .sort();
        const text = JSON.stringify({
            control: turned.control,
            arms: arms.map((item) => [item.id, item.role, item.surface, item.sign]),
            vehicles,
        });
        if (best === "" || text < best)
            best = text;
    }
    return best;
}
export function mirrorDir(dir) {
    if (dir === "E")
        return "W";
    if (dir === "W")
        return "E";
    return dir;
}
/** Reflection across the north-south axis. Left and right swap; this is not a cosmetic change. */
export function mirrorScenario(scenario) {
    const flip = (maneuver) => maneuver === "left" ? "right" : maneuver === "right" ? "left" : maneuver;
    return {
        ...scenario,
        approaches: scenario.approaches.map((item) => ({ ...item, id: mirrorDir(item.id) })),
        vehicles: scenario.vehicles.map((vehicle) => ({
            ...vehicle,
            from: mirrorDir(vehicle.from),
            maneuver: flip(vehicle.maneuver),
        })),
    };
}
