import { decide } from "./solver.mjs";
import { explainWrong } from "./explain.mjs";
export function openSession(scenario) {
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
export function reduce(session, event) {
    if (event.type === "select")
        return select(session, event.id);
    return finishMotion(session);
}
function select(session, id) {
    if (session.phase !== "ready" && session.phase !== "error")
        return session;
    if (!session.remaining.includes(id))
        return session;
    if (!session.decision.admissible.includes(id)) {
        if (session.phase === "error")
            return session;
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
        explanation: null,
    };
}
function finishMotion(session) {
    if (session.phase !== "moving" || !session.actor || !session.outcome)
        return session;
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
        explanation: null,
    };
}
function emptyDecision(previous) {
    return { ...previous, admissible: [], relations: [], conflicts: [] };
}
