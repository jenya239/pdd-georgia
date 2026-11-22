/**
 * Print one generated task. The admissible set is computed, not stored in the generator.
 * Usage: node tools/intersection-demo.mjs [seed]
 */
import { generate } from "../packages/intersection/generate.ts";
import { decide } from "../packages/intersection/solver.ts";

const seed = Number(process.argv[2] ?? 1);
const task = generate(seed);
const decision = decide(task.scenario);
console.log(`${task.scenario.id} seed=${seed} status=${decision.status} admissible=${decision.admissible.join(",") || "—"}`);
