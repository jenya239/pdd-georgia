/** Text / video episode helpers (pure). */
export const LESSON_MARKER = "<!--AFTER-TICKETS-->";
export const episodeKind = (ep) => ((ep.kind || ep.format) === "text" ? "text" : "video");
/** Lesson HTML is split in two: theory before the tickets, own questions after them. */
export function splitLesson(html) {
    const i = html.indexOf(LESSON_MARKER);
    return i < 0 ? { before: html, after: "" } : { before: html.slice(0, i), after: html.slice(i + LESSON_MARKER.length) };
}
function headingText(tag) {
    return tag.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
/** The lesson as complete pieces: the opening, each heading, and the short text after the tickets. */
export function lessonParts(html) {
    const { before, after } = splitLesson(html);
    const parts = [];
    const marks = [...before.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi)];
    if (!marks.length) {
        if (before.trim())
            parts.push({ heading: "", html: before.trim() });
    }
    else {
        const intro = before.slice(0, marks[0].index).trim();
        if (intro)
            parts.push({ heading: "", html: intro });
        marks.forEach((mark, index) => {
            const from = mark.index ?? 0;
            const to = marks[index + 1]?.index ?? before.length;
            const piece = before.slice(from, to).trim();
            if (piece)
                parts.push({ heading: headingText(mark[0]), html: piece });
        });
    }
    if (after.trim())
        parts.push({ heading: "", html: after.trim() });
    return parts;
}
function htmlHref(href) {
    return typeof href === "string" && href.endsWith(".html");
}
/** The lesson text the flow reads: the plain edition, else the lesson file. A film is not text. */
export function readingHref(ep) {
    if (!ep)
        return null;
    const editions = lessonEditions(ep);
    const plain = editions.find(item => item.id === "plain" && htmlHref(item.href));
    if (plain)
        return plain.href;
    if (htmlHref(ep.lesson))
        return ep.lesson;
    return editions.find(item => htmlHref(item.href))?.href ?? null;
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
