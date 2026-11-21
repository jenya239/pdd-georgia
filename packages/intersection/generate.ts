/**
 * Reproducible tasks. The generator only rotates hand-marked families.
 * It does not store an answer of its own: the player stream filters through the solver.
 * Agreement between the two is a consistency check, not a proof.
 */
import type { Scenario } from "./model.ts";
import { rotateScenario, signature } from "./model.ts";
import { SOLVED_CASES } from "./cases.ts";
import type { Decision } from "./solver.ts";
import { decide } from "./solver.ts";
import { SOLVER_VERSION } from "./model.ts";

export const GENERATOR_VERSION = "1";

export interface Generated {
  scenario: Scenario;
  family: string;
  signature: string;
  /** Solver echo kept so a failing seed can be replayed. Not a legal oracle. */
  echo: { status: Decision["status"]; admissible: string[] };
}

export function generate(seed: number): Generated {
  const index = Math.abs(Math.trunc(seed)) % SOLVED_CASES.length;
  const item = SOLVED_CASES[index];
  const turn = Math.floor(Math.abs(Math.trunc(seed)) / SOLVED_CASES.length) % 4;
  const scene = rotateScenario(item.scene, turn);
  const scenario: Scenario = {
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

export function familiesCovered(seeds: number[]): string[] {
  return [...new Set(seeds.map((seed) => generate(seed).family))].sort();
}

/** Greedy simplification of a scene that still fails `fails`. For a bug report, not for play. */
export function shrink(scene: Scenario, fails: (scene: Scenario) => boolean): Scenario {
  if (!fails(scene)) return scene;
  let current = scene;
  for (const vehicle of current.vehicles) {
    if (vehicle.maneuver === "straight") continue;
    const next: Scenario = {
      ...current,
      vehicles: current.vehicles.map((item) =>
        item.id === vehicle.id ? { ...item, maneuver: "straight" } : item),
    };
    if (fails(next)) current = next;
  }
  const cleared: Scenario = {
    ...current,
    approaches: current.approaches.map((arm) => ({ ...arm, sign: "none" })),
  };
  if (fails(cleared)) current = cleared;
  return current;
}

export interface BugReport {
  solver: string;
  generator: string;
  id: string;
  seed: number | null;
  signature: string;
  scenario: Scenario;
}

/** Identity of a task. No learner history and no personal data. */
export function bugReport(scene: Scenario): BugReport {
  return {
    solver: SOLVER_VERSION,
    generator: GENERATOR_VERSION,
    id: scene.id,
    seed: scene.seed,
    signature: signature(scene),
    scenario: scene,
  };
}
