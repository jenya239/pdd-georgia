/**
 * Per-ticket progress records (pure, no storage, no DOM).
 *
 * Record shape (stored under the legacy key, backward compatible with v1 {s,c,w,l,t}):
 *   s  attempts            c  correct answers      w  wrong answers
 *   l  last answer ok (1/0) t  last answer time (ms)
 *   k  current streak of correct answers (reset by a mistake)
 *   lw last wrong time      lc last wrong choice (0-based)
 *   p  {choice: count} — how often each wrong option was picked
 */
export const MASTERY_STREAK = 2;

const isCount = v => Number.isInteger(v) && v >= 0;

export function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { s, c, w, l, t } = raw;
  if (![s, c, w].every(isCount) || c + w !== s || !(l === 0 || l === 1) || typeof t !== "number") return null;
  const r = { s, c, w, l, t, k: isCount(raw.k) ? raw.k : l };
  if (typeof raw.lw === "number") r.lw = raw.lw;
  if (isCount(raw.lc)) r.lc = raw.lc;
  if (raw.p && typeof raw.p === "object") {
    const p = Object.fromEntries(Object.entries(raw.p).filter(([, n]) => isCount(n) && n > 0));
    if (Object.keys(p).length) r.p = p;
  }
  return r;
}

export function applyAnswer(rec, { ok, choice, now }) {
  const prev = rec ? normalizeRecord(rec) || { s: 0, c: 0, w: 0, k: 0 } : { s: 0, c: 0, w: 0, k: 0 };
  const next = { ...prev, s: prev.s + 1, c: prev.c + (ok ? 1 : 0), w: prev.w + (ok ? 0 : 1),
    l: ok ? 1 : 0, t: now, k: ok ? (prev.k || 0) + 1 : 0 };
  if (!ok) {
    next.lw = now;
    next.lc = choice;
    next.p = { ...(prev.p || {}), [choice]: ((prev.p || {})[choice] || 0) + 1 };
  }
  return next;
}

export const isMastered = (rec, streak = MASTERY_STREAK) => !!rec && (rec.k || 0) >= streak;

export function migrateProgress(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, rec] of Object.entries(raw)) {
    if (!/^\d+$/.test(id)) continue;
    const r = normalizeRecord(rec);
    if (r) out[id] = r;
  }
  return out;
}

function mergeRecord(a, b) {
  const latest = b.t >= a.t ? b : a;
  const r = { s: a.s + b.s, c: a.c + b.c, w: a.w + b.w, l: latest.l, t: latest.t, k: latest.k };
  const wrongs = [a, b].filter(x => typeof x.lw === "number");
  if (wrongs.length) {
    const lastWrong = wrongs.reduce((x, y) => (y.lw >= x.lw ? y : x));
    r.lw = lastWrong.lw;
    if (lastWrong.lc != null) r.lc = lastWrong.lc;
  }
  const p = {};
  for (const x of [a, b]) for (const [k, n] of Object.entries(x.p || {})) p[k] = (p[k] || 0) + n;
  if (Object.keys(p).length) r.p = p;
  return r;
}

/** Combine progress from two devices: counters are summed, the latest answer decides the state. */
export function mergeProgress(a, b) {
  const A = migrateProgress(a), B = migrateProgress(b), out = {};
  for (const id of new Set([...Object.keys(A), ...Object.keys(B)])) {
    out[id] = A[id] && B[id] ? mergeRecord(A[id], B[id]) : (A[id] || B[id]);
  }
  return out;
}
