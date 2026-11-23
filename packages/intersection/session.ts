/**
 * One scene, one vehicle at a time.
 * ready → moving → ready, or ready → moving → error → ready.
 * Input during motion is ignored. A second animation-end does not move twice.
 */
import type { Scenario } from "./model.ts";
import type { Decision } from "./solver.ts";
import { decide } from "./solver.ts";
import type { Explanation } from "./explain.ts";
import { explainRight, explainWrong } from "./explain.ts";

export type { Explanation };

export interface Session {
  phase: "ready" | "moving" | "error" | "done" | "blocked";
  scenario: Scenario;
  remaining: string[];
  decision: Decision;
  opening: Decision;
  actor: string | null;
  outcome: "go" | "stop" | null;
  explanation: Explanation | null;
  firstTryWrong: boolean;
}

export type SessionEvent =
  | { type: "select"; id: string }
  | { type: "anim-done" };

export function openSession(scenario: Scenario): Session {
  const decision = decide(scenario);
  const playable = decision.status === "ready";
  return {
    phase: playable ? "ready" : "blocked",
    scenario,
    remaining: scenario.vehicles.map((vehicle) => vehicle.id),
    decision,
    opening: decision,
    actor: null,
    outcome: null,
    explanation: null,
    firstTryWrong: false,
  };
}

export function reduce(session: Session, event: SessionEvent): Session {
  if (event.type === "select") return select(session, event.id);
  return finishMotion(session);
}

function select(session: Session, id: string): Session {
  if (session.phase !== "ready" && session.phase !== "error") return session;
  if (!session.remaining.includes(id)) return session;
  if (!session.decision.admissible.includes(id)) {
    if (session.phase === "error") return session;
    return {
      ...session,
      phase: "moving",
      actor: id,
      outcome: "stop",
      explanation: explainWrong(session.scenario, session.decision, id),
      firstTryWrong: true,
    };
  }
  return {
    ...session,
    phase: "moving",
    actor: id,
    outcome: "go",
    explanation: explainRight(session.scenario, session.decision, id),
  };
}

function finishMotion(session: Session): Session {
  if (session.phase !== "moving" || !session.actor || !session.outcome) return session;
  if (session.outcome === "stop") {
    return { ...session, phase: "error", actor: null, outcome: null };
  }
  const remaining = session.remaining.filter((id) => id !== session.actor);
  if (remaining.length === 0) {
    return { ...session, phase: "done", remaining, actor: null, outcome: null, decision: emptyDecision(session.decision) };
  }
  const nextScene = {
    ...session.scenario,
    vehicles: session.scenario.vehicles.filter((vehicle) => remaining.includes(vehicle.id)),
  };
  const decision = decide(nextScene);
  return {
    ...session,
    phase: decision.status === "ready" ? "ready" : "blocked",
    remaining,
    decision,
    actor: null,
    outcome: null,
  };
}

function emptyDecision(previous: Decision): Decision {
  return { ...previous, admissible: [], relations: [], conflicts: [] };
}
