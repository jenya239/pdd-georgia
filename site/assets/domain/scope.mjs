export const releasedLessons = (released) => [...released].sort((a, b) => a.num - b.num);
export function currentLesson(released) {
    const list = releasedLessons(released);
    return list.length ? list[list.length - 1] : null;
}
/** The lesson to open next. No answers yet → the first lesson. Otherwise the earliest
 * lesson that still has an unanswered question, then the earliest with a wrong last answer. */
export function studyLesson(released, progress = {}, { own = false } = {}) {
    const list = releasedLessons(released);
    if (!list.length)
        return null;
    const work = (lesson) => [...(lesson.tickets_lesson || []), ...(own ? lesson.own_items || [] : [])];
    if (!Object.keys(progress).length)
        return list[0];
    const open = list.find(lesson => work(lesson).some(id => !progress[id]));
    if (open)
        return open;
    const wrong = list.find(lesson => work(lesson).some(id => progress[id]?.l === 0));
    return wrong ?? list[list.length - 1];
}
/** Tickets of this lesson (`current`) and of all earlier lessons (`previous`);
 *  with {own: true} each lesson's own check items follow its tickets. */
export function cumulativeScope(released, lessonId, { own = false } = {}) {
    const list = releasedLessons(released);
    const idx = list.findIndex(l => l.id === lessonId);
    if (idx < 0)
        throw new Error(`unknown lesson ${lessonId}`);
    const ids = (l) => [...(l.tickets_lesson || []), ...(own ? l.own_items || [] : [])];
    return { current: ids(list[idx]), previous: list.slice(0, idx).flatMap(ids) };
}
export function shuffle(items, rng = Math.random) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/** "new-first": the new lesson in its order, then earlier lessons shuffled; "mixed": all shuffled. */
export function cumulativeOrder({ current, previous }, { order = "new-first", rng = Math.random } = {}) {
    return order === "mixed" ? shuffle([...current, ...previous], rng) : [...current, ...shuffle(previous, rng)];
}
export function scopeStatus(ids, progress) {
    let solved = 0, correctNow = 0, attempts = 0, wrong = 0;
    for (const id of ids) {
        const r = progress[id];
        if (!r)
            continue;
        solved++;
        if (r.l === 1)
            correctNow++;
        attempts += r.s;
        wrong += r.w;
    }
    return { inScope: ids.length, solved, correctNow, attempts, wrong, errorRate: attempts ? wrong / attempts : null };
}
