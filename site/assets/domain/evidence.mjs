/**
 * Skill evidence is not ticket mastery.
 * Invariants:
 * - two correct attempts on one item are one observation
 * - a correct attempt within PROMPT_MS after a miss on the same item, or on another item of the skill, does not count
 * - confirmed needs two independent items and one of them decisive for this skill
 * - no independent item means the skill is not due, even if `now` is far ahead
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
function wrongTime(rec) {
    if (!rec)
        return undefined;
    if (rec.events?.length) {
        const found = [...rec.events].reverse().find(event => event.ok === 0);
        if (found)
            return found.t;
    }
    if (rec.l === 0 && typeof rec.t === "number")
        return rec.t;
    return typeof rec.lw === "number" ? rec.lw : undefined;
}
function prompted(id, rec, skill, progress) {
    if (rec.l !== 1 || typeof rec.t !== "number")
        return false;
    const near = (at) => typeof at === "number" && rec.t >= at && rec.t - at < PROMPT_MS;
    if (near(wrongTime(rec)))
        return true;
    return skill.items.some(item => item.id !== id && near(wrongTime(progress[item.id])));
}
export function skillState(skill, progress, opts = {}) {
    const seen = skill.items.filter(item => usable(progress[item.id], opts.hashes?.[item.id]));
    const independent = seen.filter(item => {
        const rec = progress[item.id];
        return rec.l === 1 && !prompted(item.id, rec, skill, progress);
    }).map(item => item.id);
    const decisive = independent.some(id => skill.items.some(item => item.id === id && item.decisive));
    let status = "unknown";
    if (seen.length) {
        const missed = seen.some(item => progress[item.id]?.l === 0);
        if (missed || !independent.length)
            status = "gap";
        else if (independent.length >= 2 && decisive)
            status = "confirmed";
        else
            status = "practiced";
    }
    if ((status === "confirmed" || status === "practiced") && typeof opts.now === "number") {
        const times = independent.map(id => progress[id]?.t).filter((at) => typeof at === "number");
        if (times.length === independent.length && times.length > 0) {
            const latest = Math.max(...times);
            if (Number.isFinite(latest) && opts.now - latest >= DUE_MS)
                status = "due";
        }
    }
    return { status, label: SKILL_LABEL[status], independent };
}
