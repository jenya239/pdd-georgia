/**
 * Legal decision for one moment: which waiting vehicles may enter.
 * The result is a set, not a single sequence.
 * A yield duty blocks only when the paths actually interfere.
 * If the verified rules do not order a conflict, the solver reports that
 * instead of inventing a winner.
 */
import type { Dir, Scenario, Vehicle } from "./model.ts";
import { DIRS, OPPOSITE, RIGHT_OF } from "./model.ts";
import type { RoadPattern } from "./model.ts";
import { pathOf, pathsConflict } from "./geometry.ts";

export type RuleName = "main" | "left" | "right" | "fallback";

export interface Relation {
  from: string;
  to: string;
  effect: "yield" | "latent";
  rule: RuleName;
  norms: string[];
}

export interface Decision {
  status: "ready" | "indeterminate" | "unsupported";
  reason?: string;
  pattern?: RoadPattern;
  admissible: string[];
  relations: Relation[];
  conflicts: { a: string; b: string }[];
}

export interface SolveOptions {
  omit?: readonly RuleName[];
}

type Support =
  | { ok: true; pattern: RoadPattern }
  | { ok: false; reason: string };

export function support(scenario: Scenario): Support {
  if (scenario.control !== "unregulated") return { ok: false, reason: "regulated" };
  if (scenario.approaches.length !== 4) return { ok: false, reason: "approach-count" };
  const seen = new Set(scenario.approaches.map((arm) => arm.id));
  if (seen.size !== 4 || DIRS.some((dir) => !seen.has(dir))) return { ok: false, reason: "approach-count" };
  if (scenario.approaches.some((arm) => arm.sign === "stop")) return { ok: false, reason: "stop-sign" };
  if (scenario.approaches.some((arm) => arm.role !== "road")) return { ok: false, reason: "adjacent" };
  if (scenario.approaches.some((arm) => arm.surface !== "paved")) return { ok: false, reason: "surface" };
  const pattern = straightPattern(scenario);
  if (!pattern) return { ok: false, reason: "unverified-priority" };
  if (scenario.vehicles.length < 1 || scenario.vehicles.length > 4) return { ok: false, reason: "vehicle-count" };
  const ids = new Set(scenario.vehicles.map((vehicle) => vehicle.id));
  if (ids.size !== scenario.vehicles.length) return { ok: false, reason: "duplicate-id" };
  const origins = new Set(scenario.vehicles.map((vehicle) => vehicle.from));
  if (origins.size !== scenario.vehicles.length) return { ok: false, reason: "same-approach" };
  for (const vehicle of scenario.vehicles) {
    if (!seen.has(vehicle.from)) return { ok: false, reason: "missing-approach" };
    if (vehicle.maneuver !== "straight" && vehicle.maneuver !== "left" && vehicle.maneuver !== "right") {
      return { ok: false, reason: "maneuver" };
    }
  }
  return { ok: true, pattern };
}

function sign(scenario: Scenario, dir: Dir) {
  return scenario.approaches.find((arm) => arm.id === dir)?.sign;
}

function straightPattern(scenario: Scenario): RoadPattern | null {
  const none = DIRS.every((dir) => sign(scenario, dir) === "none");
  if (none) return "equal";
  const ns = sign(scenario, "N") === "main" && sign(scenario, "S") === "main"
    && sign(scenario, "E") === "yield" && sign(scenario, "W") === "yield";
  if (ns) return "main-ns";
  const ew = sign(scenario, "E") === "main" && sign(scenario, "W") === "main"
    && sign(scenario, "N") === "yield" && sign(scenario, "S") === "yield";
  if (ew) return "main-ew";
  return null;
}

function rankOf(pattern: RoadPattern, dir: Dir): "main" | "secondary" | "equal" {
  if (pattern === "equal") return "equal";
  if (pattern === "main-ns") return dir === "N" || dir === "S" ? "main" : "secondary";
  return dir === "E" || dir === "W" ? "main" : "secondary";
}

function relate(from: Vehicle, to: Vehicle, hit: boolean, rule: RuleName, norms: string[]): Relation {
  return { from: from.id, to: to.id, effect: hit ? "yield" : "latent", rule, norms };
}

function specific(
  from: Vehicle,
  to: Vehicle,
  hit: boolean,
  pattern: RoadPattern,
  omit: ReadonlySet<RuleName>,
): Relation | null {
  const fromRank = rankOf(pattern, from.from);
  const toRank = rankOf(pattern, to.from);
  if (fromRank === "secondary" && toRank === "main" && !omit.has("main")) {
    return relate(from, to, hit, "main", ["st36-p4-a", "sign-2.1", "sign-2.3"]);
  }
  if (fromRank === toRank) {
    const oncomingLeft = from.maneuver === "left"
      && OPPOSITE[from.from] === to.from
      && (to.maneuver === "straight" || to.maneuver === "right");
    if (oncomingLeft && !omit.has("left")) return relate(from, to, hit, "left", ["st36-p4-g"]);
    if (pattern === "equal" && RIGHT_OF[from.from] === to.from && !omit.has("right")) {
      return relate(from, to, hit, "right", ["st36-p4-v"]);
    }
  }
  return null;
}

export function decide(scenario: Scenario, options: SolveOptions = {}): Decision {
  const checked = support(scenario);
  if (!checked.ok) {
    return { status: "unsupported", reason: checked.reason, admissible: [], relations: [], conflicts: [] };
  }
  const omit = new Set(options.omit ?? []);
  const vehicles = scenario.vehicles;
  const paths = new Map(vehicles.map((vehicle) => [vehicle.id, pathOf(vehicle.from, vehicle.maneuver)]));
  const relations: Relation[] = [];
  const conflicts: { a: string; b: string }[] = [];
  const undefinedIds = new Set<string>();

  for (let i = 0; i < vehicles.length; i++) {
    for (let j = i + 1; j < vehicles.length; j++) {
      const left = vehicles[i];
      const right = vehicles[j];
      const hit = pathsConflict(paths.get(left.id) ?? [], paths.get(right.id) ?? []);
      if (hit) conflicts.push({ a: left.id, b: right.id });
      const leftToRight = specific(left, right, hit, checked.pattern, omit);
      const rightToLeft = specific(right, left, hit, checked.pattern, omit);
      if (leftToRight) relations.push(leftToRight);
      if (rightToLeft) relations.push(rightToLeft);
      if (hit && !leftToRight && !rightToLeft) {
        const fallback = fallbackYield(left, right, omit);
        if (fallback) relations.push(fallback);
        else {
          undefinedIds.add(left.id);
          undefinedIds.add(right.id);
        }
      }
    }
  }

  const admissible = vehicles
    .filter((vehicle) => !undefinedIds.has(vehicle.id))
    .filter((vehicle) => !relations.some((item) => item.from === vehicle.id && item.effect === "yield"))
    .map((vehicle) => vehicle.id);

  const status = admissible.length === 0 && vehicles.length > 0 ? "indeterminate" : "ready";
  return { status, pattern: checked.pattern, admissible, relations, conflicts };
}

function fallbackYield(left: Vehicle, right: Vehicle, omit: ReadonlySet<RuleName>): Relation | null {
  if (omit.has("fallback")) return null;
  if (RIGHT_OF[left.from] === right.from) return relate(left, right, true, "fallback", ["st32-p12"]);
  if (RIGHT_OF[right.from] === left.from) return relate(right, left, true, "fallback", ["st32-p12"]);
  return null;
}

export function blocking(decision: Decision, id: string): Relation | null {
  return decision.relations.find((item) => item.from === id && item.effect === "yield") ?? null;
}

export function primaryConcept(decision: Decision): string {
  const yieldRelation = decision.relations.find((item) => item.effect === "yield");
  if (yieldRelation) return yieldRelation.rule;
  const latent = decision.relations.find((item) => item.effect === "latent");
  return latent ? `clear-${latent.rule}` : "clear";
}

export function admissibleKey(decision: Decision): string {
  return [...decision.admissible].sort().join(",");
}

export function withVehicles(scenario: Scenario, vehicles: Vehicle[]): Scenario {
  return { ...scenario, vehicles };
}
