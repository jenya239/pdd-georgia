/**
 * Review order for a finished course.
 * Invariants:
 * - without `now`, the given order is unchanged
 * - an item answered sooner than REVIEW_GAP_MS ago stays behind due items
 * - the gap is a fixed heuristic, not a fitted memory model
 */
export const REVIEW_GAP_MS = 24 * 60 * 60 * 1000;

type ReviewAttempt = { t?: number };

export function reviewAge(id: string | number, progress: Record<string, ReviewAttempt | undefined>, now: number | undefined) {
  if (typeof now !== "number") return 0;
  const t = progress[String(id)]?.t;
  return typeof t === "number" ? now - t : 0;
}

export function reviewDue(id: string | number, progress: Record<string, ReviewAttempt | undefined>, now: number | undefined) {
  return reviewAge(id, progress, now) >= REVIEW_GAP_MS;
}

export function orderReview<T extends string | number>(
  ids: T[],
  progress: Record<string, ReviewAttempt | undefined>,
  now?: number,
): T[] {
  if (typeof now !== "number") return ids;
  const due = ids.filter(id => reviewDue(id, progress, now));
  if (!due.length) return ids;
  const rest = ids.filter(id => !due.includes(id));
  due.sort((a, b) => reviewAge(b, progress, now) - reviewAge(a, progress, now) || ids.indexOf(a) - ids.indexOf(b));
  return [...due, ...rest];
}
