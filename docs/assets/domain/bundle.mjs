/**
 * The progress file: the whole learner state (every key of registry.mjs) as one versioned JSON (pure).
 *   { format, schema, app, exportedAt, data: { <registry id>: value } }
 * Older files are migrated: schema 2 (no per-attempt history `h`, no notes: records keep their counters),
 * schema 1 (top-level progress/runs/active/settings) and a bare progress map.
 * Sections of retired keys (registry RETIRED, e.g. "lang" from ≤ 0.6) are ignored like any unknown section.
 */
import { migrateProgress, mergeProgress, isMastered } from "./progress.mjs";
import { isOwnId } from "./items.mjs";
import { SCHEMA_VERSION } from "./registry.mjs";

export const FORMAT = "pddge-progress";
const THEMES = ["light", "dark"];
const NOT_OURS = "Это не файл прогресса ПДД Грузии.";

const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const NOTE_MAX = 4000;

/** Notes: {ticket id: {x text, t saved at}}; empty or malformed notes are dropped. */
export function cleanNotes(v) {
  if (!isObj(v)) return undefined;
  const out = {};
  for (const [id, n] of Object.entries(v)) {
    if (!(/^\d+$/.test(id) || isOwnId(id)) || !isObj(n) || typeof n.x !== "string" || typeof n.t !== "number") continue;
    const x = n.x.trim().slice(0, NOTE_MAX);
    if (x) out[id] = { x, t: n.t };
  }
  return out;
}

/** Per-section validators: return the clean value or undefined (section dropped). */
const CLEAN = {
  progress: v => migrateProgress(v),
  runs: v => (Array.isArray(v) ? v.filter(r => isObj(r) && typeof r.id === "string") : undefined),
  active: v => (isObj(v) ? v : undefined),
  settings: v => (isObj(v) ? v : undefined),
  exams: v => (Array.isArray(v) ? v.filter(e => isObj(e) && typeof e.d === "number") : undefined),
  theme: v => (THEMES.includes(v) ? v : undefined),
  notes: cleanNotes,
};

export function cleanState(data) {
  const out = {};
  for (const [id, fn] of Object.entries(CLEAN)) {
    if (data[id] === undefined || data[id] === null) continue;
    const v = fn(data[id]);
    if (v !== undefined) out[id] = v;
  }
  return out;
}

export function makeBundle(state, now, app) {
  return { format: FORMAT, schema: SCHEMA_VERSION, app, exportedAt: new Date(now).toISOString(), data: cleanState(state) };
}

/** Parses a file's text → { schema, app, exportedAt, migratedFrom, state }. Throws Error with a Russian message. */
export function parseBundle(text) {
  let f;
  try { f = JSON.parse(text); } catch (e) { throw new Error("Файл не читается как JSON."); }
  if (!isObj(f)) throw new Error(NOT_OURS);
  if (f.format === FORMAT && f.schema === undefined && f.version === 1) {
    const { progress, runs, active, settings } = f;
    return { schema: 1, app: null, exportedAt: f.exportedAt ?? null, migratedFrom: 1, state: cleanState({ progress, runs, active, settings }) };
  }
  if (f.format === FORMAT) {
    if (!Number.isInteger(f.schema) || f.schema < 1) throw new Error(`Неизвестная версия файла: ${f.schema ?? f.version}.`);
    if (f.schema > SCHEMA_VERSION)
      throw new Error(`Файл сохранён более новой версией сайта (схема ${f.schema}, здесь ${SCHEMA_VERSION}). Обновите страницу (Ctrl+F5) и попробуйте снова.`);
    if (!isObj(f.data)) throw new Error("Файл повреждён: нет раздела data.");
    return { schema: f.schema, app: f.app ?? null, exportedAt: f.exportedAt ?? null,
      migratedFrom: f.schema < SCHEMA_VERSION ? f.schema : null, state: cleanState(f.data) };
  }
  const keys = Object.keys(f);
  if (keys.length && keys.every(k => /^\d+$/.test(k)))
    return { schema: 0, app: null, exportedAt: null, migratedFrom: 0, state: { progress: migrateProgress(f) } };
  throw new Error(NOT_OURS);
}

const unionBy = (a = [], b = [], key) => {
  const seen = new Set(a.map(key));
  return [...a, ...b.filter(x => !seen.has(key(x)))];
};

/** Merge: progress summed, histories united, local unfinished runs, settings and preferences win. */
export function mergeState(current, incoming) {
  const out = {
    progress: mergeProgress(current.progress || {}, incoming.progress || {}),
    runs: unionBy(current.runs, incoming.runs, r => r.id),
    active: { ...(incoming.active || {}), ...(current.active || {}) },
    settings: { ...(incoming.settings || {}), ...(current.settings || {}) },
    exams: unionBy(current.exams, incoming.exams, e => e.d).sort((x, y) => x.d - y.d),
  };
  const notes = { ...(incoming.notes || {}) };
  for (const [id, n] of Object.entries(current.notes || {})) if (!notes[id] || n.t >= notes[id].t) notes[id] = n;
  if (Object.keys(notes).length) out.notes = notes;
  const theme = current.theme ?? incoming.theme;
  if (theme != null) out.theme = theme;
  return out;
}

export function applyImport(current, incoming, mode) {
  if (mode === "replace") return { ...incoming };
  if (mode === "merge") return mergeState(current, incoming);
  throw new Error(`Неизвестный режим загрузки: ${mode}.`);
}

export function summarize(s) {
  const recs = Object.entries(s.progress || {});
  return {
    tickets: recs.filter(([id]) => !isOwnId(id)).length,
    own: recs.filter(([id]) => isOwnId(id)).length,
    wrong: recs.filter(([, r]) => r.l === 0).length,
    mastered: recs.filter(([, r]) => isMastered(r)).length,
    runs: (s.runs || []).length,
    active: Object.keys(s.active || {}).length,
    exams: (s.exams || []).length,
    settings: Object.keys(s.settings || {}).length > 0,
    theme: s.theme ?? null,
    notes: Object.keys(s.notes || {}).length,
  };
}

export function previewImport(current, incoming, mode) {
  return { mode, before: summarize(current), file: summarize(incoming), after: summarize(applyImport(current, incoming, mode)) };
}
