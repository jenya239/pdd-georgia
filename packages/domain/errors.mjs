/** Error statistics and the "разобрать ошибки" drill (pure). */
import { isMastered } from "./progress.mjs";
import { parseId, compareIds } from "./items.mjs";

function statOf(t, r = { s: 0, w: 0 }, notes) {
  const last = r.h && r.h.length ? r.h[r.h.length - 1].c : null;
  const s = { id: t.id, attempts: r.s, wrong: r.w, rate: r.s ? r.w / r.s : 0, lastWrong: r.lw ?? null, lastChoice: r.lc ?? last ?? null,
    picks: r.p || {}, mastered: isMastered(r), lesson: t.lesson ?? null, topic: t.t,
    ruleKey: t.rule ? t.rule.key : null, ruleLabel: t.rule ? t.rule.label : null };
  if (notes) s.noted = !!notes[t.id];
  return s;
}

const rank = (a, b) => b.rate - a.rate || b.wrong - a.wrong || (b.lastWrong || 0) - (a.lastWrong || 0);

/** Tickets with mistakes, worst first; with `notes` given every entry says whether the learner wrote a note. */
export function errorStats(progress, tickets, notes = null) {
  return tickets.filter(t => progress[t.id] && progress[t.id].w).map(t => statOf(t, progress[t.id], notes)).sort(rank);
}

/** Tickets the learner wrote a note on (with or without mistakes), ranked like errorStats. */
export function notedStats(progress, tickets, notes) {
  return tickets.filter(t => notes[t.id]).map(t => statOf(t, progress[t.id], notes)).sort(rank);
}

/** Groups keep the ranking inside; groups are ordered by total mistakes, unknown key last. */
export function groupStats(stats, keyOf) {
  const groups = new Map();
  for (const s of stats) {
    const k = keyOf(s) ?? null;
    if (!groups.has(k)) groups.set(k, { key: k, wrong: 0, items: [] });
    const g = groups.get(k);
    g.wrong += s.wrong;
    g.items.push(s);
  }
  return [...groups.values()].sort((a, b) => (a.key === null) - (b.key === null) || b.wrong - a.wrong);
}

/** Tickets with mistakes that are not yet answered correctly MASTERY_STREAK times in a row. */
export function drillQueue(progress, ids = null) {
  const pool = ids ?? Object.keys(progress).map(parseId).sort(compareIds);
  return pool.filter(id => progress[id] && progress[id].w > 0 && !isMastered(progress[id]));
}
