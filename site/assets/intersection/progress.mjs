/**
 * Local counts by concept. This is a record, not a claim that the count
 * measures real-world driving, and it does not choose the next statute.
 */
export function freshProgress() {
    return { version: 1, answered: 0, firstTry: 0, concepts: {} };
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
    };
}
export function parseProgress(raw) {
    if (!raw || typeof raw !== "object")
        return freshProgress();
    const value = raw;
    if (value.version !== 1 || typeof value.answered !== "number" || typeof value.firstTry !== "number") {
        return freshProgress();
    }
    if (!value.concepts || typeof value.concepts !== "object")
        return freshProgress();
    return {
        version: 1,
        answered: value.answered,
        firstTry: value.firstTry,
        concepts: value.concepts,
    };
}
