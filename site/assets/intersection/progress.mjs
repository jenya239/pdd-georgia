export const HISTORY_LIMIT = 40;
const isObj = (value) => !!value && typeof value === "object" && !Array.isArray(value);
export function freshProgress() {
    return { version: 1, answered: 0, firstTry: 0, concepts: {}, history: [] };
}
export function recordProgress(progress, concept, firstTry) {
    const previous = progress.concepts[concept] ?? { seen: 0, firstTry: 0, missed: 0 };
    const concepts = {
        ...progress.concepts,
        [concept]: {
            seen: previous.seen + 1,
            firstTry: previous.firstTry + (firstTry ? 1 : 0),
            missed: previous.missed + (firstTry ? 0 : 1),
        },
    };
    return {
        version: 1,
        answered: progress.answered + 1,
        firstTry: progress.firstTry + (firstTry ? 1 : 0),
        concepts,
        history: progress.history ?? [],
    };
}
export function rememberSituation(progress, record) {
    const copy = {
        scenario: record.scenario,
        steps: record.steps.map((step) => ({
            vehicleId: step.vehicleId,
            correct: step.correct,
            text: step.text,
            norms: step.norms.map((norm) => ({ id: norm.id, label: norm.label })),
            highlight: {
                selected: step.highlight.selected,
                yieldTo: [...step.highlight.yieldTo],
                paths: [...step.highlight.paths],
                signs: [...step.highlight.signs],
            },
        })),
    };
    return {
        ...progress,
        history: [...(progress.history ?? []), copy].slice(-HISTORY_LIMIT),
    };
}
/** The line worth keeping under the next task: a correct step that cites a norm, else the last one. */
export function situationSummary(record) {
    if (!record || !Array.isArray(record.steps) || record.steps.length === 0)
        return null;
    const correct = record.steps.filter((step) => step.correct);
    const withNorm = [...correct].reverse().find((step) => step.norms.length > 0);
    return withNorm ?? correct[correct.length - 1] ?? record.steps[record.steps.length - 1] ?? null;
}
export function parseProgress(raw) {
    if (!isObj(raw))
        return freshProgress();
    if (raw.version !== 1 || typeof raw.answered !== "number" || typeof raw.firstTry !== "number")
        return freshProgress();
    if (!isObj(raw.concepts))
        return freshProgress();
    return {
        version: 1,
        answered: raw.answered,
        firstTry: raw.firstTry,
        concepts: raw.concepts,
        history: cleanHistory(raw.history),
    };
}
function cleanHistory(raw) {
    if (!Array.isArray(raw))
        return [];
    const records = [];
    for (const item of raw) {
        const record = cleanRecord(item);
        if (record)
            records.push(record);
    }
    return records.slice(-HISTORY_LIMIT);
}
function cleanRecord(raw) {
    if (!isObj(raw) || !cleanScenario(raw.scenario) || !Array.isArray(raw.steps))
        return null;
    const steps = raw.steps.map(cleanStep).filter((step) => step !== null);
    if (!steps.length)
        return null;
    return { scenario: raw.scenario, steps };
}
function cleanScenario(raw) {
    if (!isObj(raw) || !Array.isArray(raw.vehicles) || !Array.isArray(raw.approaches))
        return false;
    if (raw.vehicles.length < 1 || raw.vehicles.length > 8)
        return false;
    if (raw.approaches.length < 1 || raw.approaches.length > 8)
        return false;
    return raw.vehicles.every((vehicle) => isObj(vehicle) && typeof vehicle.id === "string" && typeof vehicle.from === "string" && typeof vehicle.maneuver === "string");
}
function cleanStep(raw) {
    if (!isObj(raw) || typeof raw.vehicleId !== "string" || typeof raw.correct !== "boolean")
        return null;
    if (typeof raw.text !== "string" || raw.text.length === 0 || raw.text.length > 500)
        return null;
    const norms = Array.isArray(raw.norms)
        ? raw.norms.flatMap((item) => {
            if (!isObj(item) || typeof item.id !== "string" || typeof item.label !== "string")
                return [];
            return [{ id: item.id, label: item.label }];
        })
        : [];
    return {
        vehicleId: raw.vehicleId,
        correct: raw.correct,
        text: raw.text,
        norms,
        highlight: cleanHighlight(raw.highlight, raw.vehicleId),
    };
}
function cleanHighlight(raw, vehicleId) {
    const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, 8) : [];
    if (!isObj(raw))
        return { selected: vehicleId, yieldTo: [], paths: [vehicleId], signs: [] };
    return {
        selected: typeof raw.selected === "string" ? raw.selected : vehicleId,
        yieldTo: strings(raw.yieldTo),
        paths: strings(raw.paths),
        signs: strings(raw.signs),
    };
}
