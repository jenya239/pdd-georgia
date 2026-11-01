/**
 * Per-ticket progress (pure, no storage, no DOM).
 *
 * The journal is the source of truth (schema 4). Each answer is an event `{id,t,c,ok,w?,hash?}`.
 * `id` is stable, so merging two files unites events instead of adding the counters.
 * A `balance` is the one aggregate left by schema ≤ 3 for attempts that were never stored
 * one by one. A later import replaces that aggregate; it is not added again.
 *
 * The fields the rest of the site reads are derived:
 *   s c w l t k lw lc p
 *   h  the last HISTORY_CAP events, oldest first, without ids (the panel)
 *   events  the whole journal
 *   balance the aggregate, when there is one
 *
 * Records from schema ≤ 2 have no events: only the aggregate remains, and there is nothing to undo.
 */
import { isOwnId } from "./items.mjs";
export const MASTERY_STREAK = 2;
export const HISTORY_CAP = 50;
export const WHERE = { practice: "самопроверка", lesson: "урок", check: "накопительная проверка", exam: "экзамен", drill: "разбор ошибок" };
const BALANCE_ID = "balance";
const isCount = (v) => Number.isInteger(v) && v >= 0;
const isRecord = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isWhere = (v) => typeof v === "string" && Object.hasOwn(WHERE, v);
export function eventId(t, c, ok) {
    return `${t}:${c ?? ""}:${ok ? 1 : 0}`;
}
function attemptView(e) {
    const a = { t: e.t, c: e.c, ok: e.ok };
    if (isWhere(e.w))
        a.w = e.w;
    return a;
}
function cleanEvent(raw) {
    if (!isRecord(raw) || typeof raw.t !== "number")
        return null;
    if (!(raw.c === null || isCount(raw.c)) || !(raw.ok === 0 || raw.ok === 1))
        return null;
    const e = {
        id: typeof raw.id === "string" && raw.id ? raw.id : eventId(raw.t, raw.c, raw.ok === 1),
        t: raw.t, c: raw.c, ok: raw.ok,
    };
    if (isWhere(raw.w))
        e.w = raw.w;
    if (typeof raw.hash === "string" && raw.hash)
        e.hash = raw.hash;
    return e;
}
function cleanP(raw) {
    if (!isRecord(raw))
        return undefined;
    const p = {};
    for (const [k, n] of Object.entries(raw))
        if (isCount(n) && n > 0)
            p[k] = n;
    return Object.keys(p).length ? p : undefined;
}
function addP(a, b) {
    const p = { ...(a || {}) };
    for (const [k, n] of Object.entries(b || {}))
        p[k] = (p[k] || 0) + n;
    return Object.keys(p).length ? p : undefined;
}
function subtractP(stored, used) {
    const p = {};
    for (const [k, n] of Object.entries(stored || {})) {
        const left = n - (used[k] || 0);
        if (left > 0)
            p[k] = left;
    }
    return Object.keys(p).length ? p : undefined;
}
function pOf(events) {
    const p = {};
    for (const e of events)
        if (!e.ok && e.c != null)
            p[e.c] = (p[e.c] || 0) + 1;
    return p;
}
function cleanBalance(raw) {
    if (!isRecord(raw))
        return null;
    if (!isCount(raw.s) || !isCount(raw.c) || !isCount(raw.w) || raw.c + raw.w !== raw.s || raw.s === 0)
        return null;
    const b = { id: BALANCE_ID, s: raw.s, c: raw.c, w: raw.w };
    if (isCount(raw.k))
        b.k = raw.k;
    if (raw.l === 0 || raw.l === 1)
        b.l = raw.l;
    if (typeof raw.t === "number")
        b.t = raw.t;
    if (typeof raw.lw === "number")
        b.lw = raw.lw;
    if (isCount(raw.lc))
        b.lc = raw.lc;
    const p = cleanP(raw.p);
    if (p)
        b.p = p;
    return b;
}
function toJournal(rec) {
    if (!isRecord(rec))
        return { events: [], balance: null };
    if (Array.isArray(rec.events) || rec.balance) {
        const seen = new Set();
        const events = [];
        for (const raw of Array.isArray(rec.events) ? rec.events : []) {
            const e = cleanEvent(raw);
            if (!e || seen.has(e.id))
                continue;
            seen.add(e.id);
            events.push(e);
        }
        events.sort((x, y) => x.t - y.t);
        return { events, balance: cleanBalance(rec.balance) };
    }
    if (!isCount(rec.s) || !isCount(rec.c) || !isCount(rec.w) || rec.c + rec.w !== rec.s || !(rec.l === 0 || rec.l === 1) || typeof rec.t !== "number")
        return { events: [], balance: null };
    const seen = new Set();
    const events = [];
    for (const raw of Array.isArray(rec.h) ? rec.h : []) {
        const e = cleanEvent(raw);
        if (!e || seen.has(e.id))
            continue;
        seen.add(e.id);
        events.push(e);
    }
    const coveredC = events.filter(e => e.ok).length;
    const coveredW = events.length - coveredC;
    const balS = rec.s - events.length;
    const balC = rec.c - coveredC;
    const balW = rec.w - coveredW;
    if (balS <= 0 || balC < 0 || balW < 0 || balC + balW !== balS)
        return { events, balance: null };
    const balance = { id: BALANCE_ID, s: balS, c: balC, w: balW };
    const k = isCount(rec.k) ? rec.k : rec.l;
    if (!events.length) {
        balance.k = k;
        balance.l = rec.l;
        balance.t = rec.t;
        if (typeof rec.lw === "number")
            balance.lw = rec.lw;
        if (isCount(rec.lc))
            balance.lc = rec.lc;
        const p = cleanP(rec.p);
        if (p)
            balance.p = p;
    }
    else {
        balance.k = events.every(e => e.ok) && k >= events.length ? k - events.length : 0;
        const p = subtractP(cleanP(rec.p), pOf(events));
        if (p)
            balance.p = p;
        if (!events.some(e => !e.ok)) {
            if (typeof rec.lw === "number")
                balance.lw = rec.lw;
            if (isCount(rec.lc))
                balance.lc = rec.lc;
        }
    }
    return { events, balance };
}
function byTime(a, b) {
    return a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function streak(events, balance, pin) {
    let k = balance?.k ?? 0;
    const latest = pin || [...events].reverse().find(e => e.hash)?.hash;
    for (const e of events) {
        if (latest && e.hash && e.hash !== latest) {
            k = 0;
            continue;
        }
        k = e.ok ? k + 1 : 0;
    }
    return k;
}
function view({ events, balance }) {
    events = [...events].sort(byTime);
    if (!events.length && !balance)
        return null;
    if (!events.length && balance) {
        const r = {
            s: balance.s, c: balance.c, w: balance.w,
            l: balance.l ?? (balance.c ? 1 : 0), t: balance.t ?? 0, k: balance.k ?? 0,
        };
        if (typeof balance.lw === "number")
            r.lw = balance.lw;
        if (isCount(balance.lc))
            r.lc = balance.lc;
        if (balance.p)
            r.p = { ...balance.p };
        return r;
    }
    const last = events[events.length - 1];
    const r = {
        s: (balance?.s ?? 0) + events.length,
        c: (balance?.c ?? 0) + events.filter(e => e.ok).length,
        w: (balance?.w ?? 0) + events.filter(e => !e.ok).length,
        l: last.ok, t: last.t, k: streak(events, balance),
        h: events.slice(-HISTORY_CAP).map(attemptView),
        events: events.map(e => ({ ...e })),
    };
    const p = addP(balance?.p, pOf(events));
    if (p)
        r.p = p;
    const prevWrong = [...events].reverse().find(e => !e.ok);
    if (prevWrong) {
        r.lw = prevWrong.t;
        if (prevWrong.c != null)
            r.lc = prevWrong.c;
    }
    else if (balance) {
        if (typeof balance.lw === "number")
            r.lw = balance.lw;
        if (isCount(balance.lc))
            r.lc = balance.lc;
    }
    if (balance)
        r.balance = { ...balance, ...(balance.p ? { p: { ...balance.p } } : {}) };
    return r;
}
export function normalizeRecord(raw) {
    const journal = toJournal(raw);
    if (!journal.events.length && !journal.balance)
        return null;
    return view(journal);
}
export function applyAnswer(rec, answer) {
    const { ok, choice, now, where, hash } = answer;
    const journal = rec ? toJournal(normalizeRecord(rec) || rec) : { events: [], balance: null };
    let id = eventId(now, choice ?? null, !!ok);
    let n = 2;
    while (journal.events.some(e => e.id === id))
        id = `${eventId(now, choice ?? null, !!ok)}#${n++}`;
    const e = { id, t: now, c: choice ?? null, ok: ok ? 1 : 0 };
    if (isWhere(where))
        e.w = where;
    if (typeof hash === "string" && hash)
        e.hash = hash;
    return view({ events: [...journal.events, e], balance: journal.balance });
}
export function undoLast(rec) {
    const cur = normalizeRecord(rec);
    if (!cur?.events?.length)
        return null;
    const last = cur.events[cur.events.length - 1];
    if (last.t !== cur.t || last.ok !== cur.l)
        return null;
    const events = cur.events.slice(0, -1);
    const undone = attemptView(last);
    if (!events.length && !cur.balance)
        return { record: null, undone };
    const record = view({ events, balance: cur.balance || null });
    return record ? { record, undone } : null;
}
/** Correct answers in a row. With `hash`, an event counts only when it has no hash or that same hash. */
export function streakOf(rec, hash) {
    if (!rec)
        return 0;
    if (typeof hash !== "string" || !hash)
        return rec.k || 0;
    const j = toJournal(rec);
    return streak(j.events, j.balance, hash);
}
export const isMastered = (rec, streakNeed = MASTERY_STREAK, hash) => streakOf(rec, hash) >= (streakNeed ?? MASTERY_STREAK);
export function migrateProgress(raw) {
    const out = {};
    if (!isRecord(raw))
        return out;
    for (const [id, rec] of Object.entries(raw)) {
        if (!/^\d+$/.test(id) && !isOwnId(id))
            continue;
        const r = normalizeRecord(rec);
        if (r)
            out[id] = r;
    }
    return out;
}
function pickBalance(a, b) {
    if (!a)
        return b;
    if (!b)
        return a;
    if (b.s !== a.s)
        return b.s > a.s ? b : a;
    return (b.t || 0) >= (a.t || 0) ? b : a;
}
function mergeRecord(a, b) {
    const A = toJournal(a), B = toJournal(b);
    if (A.events.length && !B.events.length)
        return view(A);
    if (B.events.length && !A.events.length)
        return view(B);
    const seen = new Set();
    const events = [];
    for (const e of [...A.events, ...B.events].sort((x, y) => x.t - y.t || (x.id < y.id ? -1 : 1))) {
        if (seen.has(e.id))
            continue;
        seen.add(e.id);
        events.push(e);
    }
    return view({ events, balance: pickBalance(A.balance, B.balance) });
}
/** Unite journals by event id. An aggregate with no events is kept once, the larger one, and is not added twice. */
export function mergeProgress(a, b) {
    const A = migrateProgress(a), B = migrateProgress(b), out = {};
    for (const id of new Set([...Object.keys(A), ...Object.keys(B)])) {
        const left = A[id], right = B[id];
        const merged = left && right ? mergeRecord(left, right) : (left || right);
        if (merged)
            out[id] = merged;
    }
    return out;
}
