/**
 * Skill evidence is not ticket mastery.
 * Invariants:
 * - two correct attempts on one item are one observation
 * - a correct attempt within PROMPT_MS after a miss on the same item does not count
 * - a current miss on any item of the skill blocks confirmed and due
 * - a stored hash that differs from the current item text drops that observation
 * - status is one of five labels, never a percentage
 */
export const PROMPT_MS = 10 * 60 * 1000;
export const DUE_MS = 3 * 24 * 60 * 60 * 1000;
export const SKILL_LABEL = {
    unknown: "ещё не проверяли",
    gap: "требуется практика",
    practiced: "получается самостоятельно",
    confirmed: "подтверждено на разных задачах",
    due: "пора повторить",
};
function usable(rec, hash) {
    if (!rec || (rec.l !== 0 && rec.l !== 1))
        return false;
    if (!hash)
        return true;
    const last = rec.events?.[rec.events.length - 1];
    if (!last?.hash)
        return true;
    return last.hash === hash;
}
function promptBound(rec) {
    if (rec.l !== 1)
        return false;
    const wrongAt = rec.events?.length
        ? [...rec.events].reverse().find(event => event.ok === 0)?.t
        : rec.lw;
    return typeof wrongAt === "number" && typeof rec.t === "number" && rec.t >= wrongAt && rec.t - wrongAt < PROMPT_MS;
}
export function skillState(skill, progress, opts = {}) {
    const seen = skill.items.filter(item => usable(progress[item.id], opts.hashes?.[item.id]));
    const independent = seen.filter(item => {
        const rec = progress[item.id];
        return rec.l === 1 && !promptBound(rec);
    }).map(item => item.id);
    let status = "unknown";
    if (seen.length) {
        const missed = seen.some(item => progress[item.id]?.l === 0);
        if (missed)
            status = "gap";
        else if (independent.length >= 2)
            status = "confirmed";
        else
            status = "practiced";
    }
    if ((status === "confirmed" || status === "practiced") && typeof opts.now === "number") {
        const latest = Math.max(...independent.map(id => progress[id]?.t ?? 0));
        if (opts.now - latest >= DUE_MS)
            status = "due";
    }
    return { status, label: SKILL_LABEL[status], independent };
}
