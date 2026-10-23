/** Error statistics and the "разобрать ошибки" drill (pure). */
import { isMastered } from "./progress.mjs";

export function errorStats(progress, tickets) {
  const out = [];
  for (const t of tickets) {
    const r = progress[t.id];
    if (!r || !r.w) continue;
    out.push({ id: t.id, attempts: r.s, wrong: r.w, rate: r.w / r.s, lastWrong: r.lw ?? null, lastChoice: r.lc ?? null,
      picks: r.p || {}, mastered: isMastered(r), lesson: t.lesson ?? null, topic: t.t,
      ruleKey: t.rule ? t.rule.key : null, ruleLabel: t.rule ? t.rule.label : null });
  }
  return out.sort((a, b) => b.rate - a.rate || b.wrong - a.wrong || (b.lastWrong || 0) - (a.lastWrong || 0));
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
  const pool = ids ?? Object.keys(progress).map(Number).sort((a, b) => a - b);
  return pool.filter(id => progress[id] && progress[id].w > 0 && !isMastered(progress[id]));
}
