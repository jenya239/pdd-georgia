/** Error statistics and the "разобрать ошибки" drill (pure). */
import { MASTERY_STREAK, isMastered } from "./progress.ts";
import { parseId, compareIds } from "./items.ts";

type Ticket = { id: string | number; hash?: string; lesson?: string | null; t?: string; rule?: { key: string; label: string } | null };
type LooseRec = { s: number; w: number; h?: { c?: number | null }[]; lw?: number; lc?: number; p?: Record<string, number> };
type Stat = { id: string | number; attempts: number; wrong: number; rate: number; lastWrong: number | null; lastChoice: number | null; picks: Record<string, number>; mastered: boolean; lesson: string | null; topic?: string; ruleKey: string | null; ruleLabel: string | null; noted?: boolean };

function statOf(t: Ticket, r: LooseRec = { s: 0, w: 0 }, notes: Record<string, { x: string }> | null = null): Stat {
  const last = r.h && r.h.length ? r.h[r.h.length - 1].c : null;
  const s: Stat = { id: t.id, attempts: r.s, wrong: r.w, rate: r.s ? r.w / r.s : 0, lastWrong: r.lw ?? null, lastChoice: r.lc ?? last ?? null,
    picks: r.p || {}, mastered: isMastered(r as Parameters<typeof isMastered>[0], MASTERY_STREAK, t.hash), lesson: t.lesson ?? null, topic: t.t,
    ruleKey: t.rule ? t.rule.key : null, ruleLabel: t.rule ? t.rule.label : null };
  if (notes) s.noted = !!notes[t.id];
  return s;
}

const rank = (a: Stat, b: Stat) => b.rate - a.rate || b.wrong - a.wrong || (b.lastWrong || 0) - (a.lastWrong || 0);

/** Tickets with mistakes, worst first; with `notes` given every entry says whether the learner wrote a note. */
export function errorStats(progress: Record<string, LooseRec | undefined>, tickets: Ticket[], notes: Record<string, { x: string }> | null = null) {
  return tickets.filter(t => progress[String(t.id)] && progress[String(t.id)]!.w).map(t => statOf(t, progress[String(t.id)], notes)).sort(rank);
}

/** Tickets the learner wrote a note on (with or without mistakes), ranked like errorStats. */
export function notedStats(progress: Record<string, LooseRec | undefined>, tickets: Ticket[], notes: Record<string, { x: string }>) {
  return tickets.filter(t => notes[String(t.id)]).map(t => statOf(t, progress[String(t.id)], notes)).sort(rank);
}

/** Groups keep the ranking inside; groups are ordered by total mistakes, unknown key last. */
export function groupStats(stats: Stat[], keyOf: (s: Stat) => string | null | undefined) {
  const groups = new Map<string | null, { key: string | null; wrong: number; items: Stat[] }>();
  for (const s of stats) {
    const k = keyOf(s) ?? null;
    if (!groups.has(k)) groups.set(k, { key: k, wrong: 0, items: [] });
    const g = groups.get(k)!;
    g.wrong += s.wrong;
    g.items.push(s);
  }
  return [...groups.values()].sort((a, b) => Number(a.key === null) - Number(b.key === null) || b.wrong - a.wrong);
}

/** Tickets with mistakes that are not yet answered correctly MASTERY_STREAK times in a row.
 *  `hashOf(id)` is the ticket's current text hash; attempts hashed for another text do not count. */
export function drillQueue(progress: Record<string, LooseRec | undefined>, ids: (string | number)[] | null = null, hashOf: ((id: string | number) => string | undefined) | null = null) {
  const pool = ids ?? Object.keys(progress).map(parseId).sort(compareIds);
  return pool.filter(id => {
    const rec = progress[String(id)];
    return rec && rec.w > 0 && !isMastered(rec as Parameters<typeof isMastered>[0], MASTERY_STREAK, hashOf?.(id));
  });
}
