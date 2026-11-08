export const STUDY_KINDS = ["theory", "practice", "review", "breakdown", "variation"];
const ORDER = STUDY_KINDS;
function byRef(a, b) {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb))
        return na - nb;
    return a < b ? -1 : a > b ? 1 : 0;
}
function take(buckets) {
    const steps = [];
    let pending = true;
    while (pending) {
        pending = false;
        for (const kind of ORDER) {
            const ref = buckets[kind].shift();
            if (ref === undefined)
                continue;
            steps.push({ kind, ref });
            pending = true;
        }
    }
    return steps;
}
export function planStudy(input) {
    const buckets = Object.fromEntries(ORDER.map((kind) => [kind, [...(input[kind] ?? [])]]));
    return { id: input.id, lesson: input.lesson, steps: take(buckets), cursor: 0 };
}
export function studyFor(input) {
    const review = input.tickets.filter((ticket) => ticket.lastWrong).map((ticket) => ticket.id).sort(byRef);
    const practice = input.tickets.filter((ticket) => !ticket.mastered && !ticket.lastWrong).map((ticket) => ticket.id).sort(byRef);
    return planStudy({
        id: input.id,
        lesson: input.lesson,
        theory: input.theory,
        practice,
        review,
        breakdown: input.breakdown,
        variation: input.variation,
    });
}
export function currentStep(study) {
    return study.steps[study.cursor] ?? null;
}
export function completeStep(study) {
    if (study.cursor >= study.steps.length)
        return study;
    return { ...study, cursor: study.cursor + 1 };
}
export function studyLeft(study) {
    return Math.max(0, study.steps.length - study.cursor);
}
