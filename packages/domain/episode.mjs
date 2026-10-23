/** Text / video episode helpers (pure). */
export const LESSON_MARKER = "<!--AFTER-TICKETS-->";

export const episodeKind = ep => ((ep.kind || ep.format) === "text" ? "text" : "video");

/** Lesson HTML is split in two: theory before the tickets, own questions after them. */
export function splitLesson(html) {
  const i = html.indexOf(LESSON_MARKER);
  return i < 0 ? { before: html, after: "" } : { before: html.slice(0, i), after: html.slice(i + LESSON_MARKER.length) };
}
