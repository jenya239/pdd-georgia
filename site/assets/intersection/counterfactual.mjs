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
        return "Такая замена выходит за проверенный срез. Решатель не подставляет ответ для правила, которое ещё не разобрано.";
    }
    if (delta.kind === "signs" && admissibleChanged) {
        return "Знаки приоритета убраны, остальное на месте. Кто может ехать сейчас, изменилось: без знаков стороны и пересечение путей решают там, где раньше решала главная дорога.";
    }
    if (delta.kind === "signs") {
        return "Знаки приоритета убраны, но кто может ехать сейчас, не изменился. Пути и раньше не заставляли ждать, либо ждать по-прежнему нужно уже по другому основанию.";
    }
    if (delta.kind === "maneuver" && admissibleChanged) {
        return `У автомобиля ${delta.vehicle} теперь другой манёвр. Пути сходятся иначе, и набор тех, кто может ехать сейчас, изменился.`;
    }
    if (delta.kind === "maneuver") {
        return `У автомобиля ${delta.vehicle} другой манёвр, но кто может ехать сейчас, остался тем же.`;
    }
    if (delta.kind === "from" && admissibleChanged) {
        return `Автомобиль ${delta.vehicle} подъезжает с другой стороны. Из-за этого меняется, кто может ехать сейчас.`;
    }
    if (delta.kind === "from") {
        return `Автомобиль ${delta.vehicle} подъезжает с другой стороны, но набор допустимых проездов остался тем же.`;
    }
    return admissibleChanged
        ? "Изменилось одно условие, и набор тех, кто может ехать сейчас, тоже изменился."
        : "Изменилось одно условие, а набор тех, кто может ехать сейчас, остался прежним.";
}
export function sameSignature(before, after) {
    return signature(before) === signature(after);
}
export function leadFor(delta) {
    if (delta.kind === "signs")
        return "Знаки приоритета убраны. Всё остальное на месте.";
    if (delta.kind === "maneuver")
        return `У автомобиля ${delta.vehicle} другой манёвр. Остальное на месте.`;
    if (delta.kind === "from")
        return `Автомобиль ${delta.vehicle} подъезжает с другой стороны. Остальное на месте.`;
    return "Изменилось одно условие.";
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
