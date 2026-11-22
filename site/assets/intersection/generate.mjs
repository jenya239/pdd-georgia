import { rotateScenario, signature } from "./model.mjs";
import { SOLVED_CASES } from "./cases.mjs";
import { decide } from "./solver.mjs";
import { SOLVER_VERSION } from "./model.mjs";
export const GENERATOR_VERSION = "1";
export function generate(seed) {
    const index = Math.abs(Math.trunc(seed)) % SOLVED_CASES.length;
    const item = SOLVED_CASES[index];
    const turn = Math.floor(Math.abs(Math.trunc(seed)) / SOLVED_CASES.length) % 4;
    const scene = rotateScenario(item.scene, turn);
    const scenario = {
        ...scene,
        id: `ix-${item.id}-s${seed}-r${turn}`,
        seed,
    };
    const decision = decide(scenario);
    return {
        scenario,
        family: item.family,
        signature: signature(scenario),
        echo: { status: decision.status, admissible: decision.admissible },
    };
}
export function familiesCovered(seeds) {
    return [...new Set(seeds.map((seed) => generate(seed).family))].sort();
}
/** Greedy simplification of a scene that still fails `fails`. For a bug report, not for play. */
export function shrink(scene, fails) {
    if (!fails(scene))
        return scene;
    let current = scene;
    for (const vehicle of current.vehicles) {
        if (vehicle.maneuver === "straight")
            continue;
        const next = {
            ...current,
            vehicles: current.vehicles.map((item) => item.id === vehicle.id ? { ...item, maneuver: "straight" } : item),
        };
        if (fails(next))
            current = next;
    }
    const cleared = {
        ...current,
        approaches: current.approaches.map((arm) => ({ ...arm, sign: "none" })),
    };
    if (fails(cleared))
        current = cleared;
    return current;
}
/** Identity of a task. No learner history and no personal data. */
export function bugReport(scene) {
    return {
        solver: SOLVER_VERSION,
        generator: GENERATOR_VERSION,
        id: scene.id,
        seed: scene.seed,
        signature: signature(scene),
        scenario: scene,
    };
}
