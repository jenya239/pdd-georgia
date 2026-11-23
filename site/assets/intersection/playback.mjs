/**
 * Pure navigation for a saved situation list.
 * The cursor is an index into that list; a cursor equal to the length
 * means the live task, which has not been stored yet.
 */
/** How long the finished scene stays up before the next one opens. */
export function advancePause(reducedMotion) {
    return reducedMotion ? 2600 : 1500;
}
export function historyCursor(cursor, length, direction) {
    const at = Number.isInteger(cursor) ? cursor : length;
    const clamped = Math.max(0, Math.min(length, at));
    const next = clamped + direction;
    if (next < 0)
        return 0;
    if (next > length)
        return length;
    return next;
}
