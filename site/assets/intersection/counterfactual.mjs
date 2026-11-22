import { signature } from "./model.mjs";
import { admissibleKey, blocking, decide, support } from "./solver.mjs";
export function applyDelta(scenario, delta) {
    if (delta.kind === "maneuver") {
        return {
            ...scenario,
            vehicles: scenario.vehicles.map((vehicle) => vehicle.id === delta.vehicle ? { ...vehicle, maneuver: delta.to } : vehicle),
        };
    }
    if (delta.kind === "from") {
        return {
            ...scenario,
            vehicles: scenario.vehicles.map((vehicle) => vehicle.id === delta.vehicle ? { ...vehicle, from: delta.to } : vehicle),
        };
    }
    if (delta.kind === "signs") {
        return {
            ...scenario,
            approaches: scenario.approaches.map((arm) => ({ ...arm, sign: "none" })),
        };
    }
    if (delta.kind === "surface") {
        return {
            ...scenario,
            approaches: scenario.approaches.map((arm) => arm.id === delta.approach ? { ...arm, surface: delta.to } : arm),
        };
    }
    return {
        ...scenario,
        approaches: scenario.approaches.map((arm) => arm.id === delta.approach ? { ...arm, role: delta.to } : arm),
    };
}
/** Names of legal facts that differ. Several sign plates are one fact, "signs". */
export function changedFacts(before, after) {
    const facts = [];
    for (const vehicle of before.vehicles) {
        const next = after.vehicles.find((item) => item.id === vehicle.id);
        if (!next) {
            facts.push("vehicles");
            continue;
        }
        if (next.maneuver !== vehicle.maneuver)
            facts.push(`maneuver:${vehicle.id}`);
        if (next.from !== vehicle.from)
            facts.push(`from:${vehicle.id}`);
    }
    if (before.vehicles.length !== after.vehicles.length)
        facts.push("vehicles");
    const arm = (scenario, id) => scenario.approaches.find((item) => item.id === id);
    if (before.approaches.some((item) => arm(after, item.id)?.sign !== item.sign))
        facts.push("signs");
    if (before.approaches.some((item) => arm(after, item.id)?.surface !== item.surface))
        facts.push("surface");
    if (before.approaches.some((item) => arm(after, item.id)?.role !== item.role))
        facts.push("role");
    if (before.control !== after.control)
        facts.push("control");
    return facts;
}
function reasonKey(decision) {
    return decision.relations
        .map((item) => `${item.from}>${item.to}:${item.effect}:${item.rule}`)
        .sort()
        .join("|");
}
export function counterfactual(before, delta) {
    const after = applyDelta(before, delta);
    const beforeDecision = decide(before);
    const afterSupported = support(after).ok;
    const afterDecision = decide(after);
    const facts = changedFacts(before, after);
    const admissibleChanged = admissibleKey(beforeDecision) !== admissibleKey(afterDecision)
        || beforeDecision.status !== afterDecision.status;
    const reasonChanged = reasonKey(beforeDecision) !== reasonKey(afterDecision);
    return {
        before,
        after,
        delta,
        facts,
        beforeDecision,
        afterDecision,
        afterSupported,
        admissibleChanged,
        reasonChanged,
        why: explainChange(delta, afterSupported, admissibleChanged),
    };
}
function explainChange(delta, supported, admissibleChanged) {
    if (!supported) {
        return "Такую ситуацию тренажёр пока не умеет проверять. Ответ не будет угадан.";
    }
    if (delta.kind === "signs" && admissibleChanged) {
        return "Без знаков главная дорога больше не определяет очередность. Теперь решение изменилось — проверь, кому нужно уступить.";
    }
    if (delta.kind === "signs") {
        return "Знаки убрали, но решение осталось прежним. В этой ситуации оно не зависело только от знаков.";
    }
    if (delta.kind === "maneuver" && admissibleChanged) {
        return `Автомобиль ${delta.vehicle} теперь выполняет другой манёвр. Из-за этого изменилось, кому нужно уступить.`;
    }
    if (delta.kind === "maneuver") {
        return `Автомобиль ${delta.vehicle} изменил манёвр, но очередность осталась прежней.`;
    }
    if (delta.kind === "from" && admissibleChanged) {
        return `Автомобиль ${delta.vehicle} теперь подъезжает с другой стороны, и решение меняется.`;
    }
    if (delta.kind === "from") {
        return `Автомобиль ${delta.vehicle} теперь подъезжает с другой стороны, но решение осталось прежним.`;
    }
    return admissibleChanged
        ? "Мы изменили одно условие — и теперь первым может проехать другой автомобиль."
        : "Условие изменилось, но решение осталось прежним.";
}
export function sameSignature(before, after) {
    return signature(before) === signature(after);
}
export function leadFor(delta) {
    if (delta.kind === "signs")
        return "Теперь знаков приоритета нет. Кто может проехать?";
    if (delta.kind === "maneuver")
        return `Автомобиль ${delta.vehicle} теперь поворачивает иначе. Что изменилось?`;
    if (delta.kind === "from")
        return `Автомобиль ${delta.vehicle} теперь подъезжает с другой стороны. Что изменилось?`;
    return "Посмотри, что изменилось в этой ситуации.";
}
/** Candidate single-fact changes after a wrong selection. Order is the teaching order. */
export function proposeDeltas(scene, wrongId) {
    const decision = decide(scene);
    const vehicle = scene.vehicles.find((item) => item.id === wrongId);
    const block = blocking(decision, wrongId);
    const deltas = [];
    if (vehicle && block?.rule === "right" && vehicle.maneuver === "straight") {
        deltas.push({ kind: "maneuver", vehicle: wrongId, to: "right" });
    }
    if (vehicle && block?.rule === "left" && vehicle.maneuver === "left") {
        deltas.push({ kind: "maneuver", vehicle: wrongId, to: "straight" });
    }
    if (block?.rule === "main")
        deltas.push({ kind: "signs", to: "none" });
    const other = scene.vehicles.find((item) => item.id !== wrongId);
    if (other && other.maneuver === "straight")
        deltas.push({ kind: "maneuver", vehicle: other.id, to: "right" });
    return deltas;
}
export function followUp(scene, wrongId) {
    for (const delta of proposeDeltas(scene, wrongId)) {
        const pair = counterfactual(scene, delta);
        if (!pair.afterSupported || pair.afterDecision.status !== "ready")
            continue;
        if (pair.facts.length !== 1)
            continue;
        if (sameSignature(scene, pair.after))
            continue;
        return pair;
    }
    return null;
}
