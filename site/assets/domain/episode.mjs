/** Text / video episode helpers (pure). */
export const LESSON_MARKER = "<!--AFTER-TICKETS-->";
export const episodeKind = (ep) => ((ep.kind || ep.format) === "text" ? "text" : "video");
/** Lesson HTML is split in two: theory before the tickets, own questions after them. */
export function splitLesson(html) {
    const i = html.indexOf(LESSON_MARKER);
    return i < 0 ? { before: html, after: "" } : { before: html.slice(0, i), after: html.slice(i + LESSON_MARKER.length) };
}
/** Editions declared on a built episode. Empty when the lesson has a single text. */
export function lessonEditions(ep) {
    const list = Array.isArray(ep?.editions) ? ep.editions : [];
    return list.filter((e) => !!e && typeof e.id === "string" && !!e.id && typeof e.href === "string" && !!e.href);
}
/** Preferred edition, or the first declared one. Null when the lesson has none. */
export function pickEdition(editions, preferred) {
    if (!editions.length)
        return null;
    return editions.find(e => e.id === preferred) ?? editions[0];
}
