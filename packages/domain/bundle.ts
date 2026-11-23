/**
 * The progress file: the whole learner state (every key of registry.mjs) as one versioned JSON (pure).
 *   { format, schema, app, exportedAt, data: { <registry id>: value } }
 * Older files are migrated: schema 3 (history `h` becomes events; the attempts that were never stored
 * one by one stay one balance), schema 2 (counters only, no notes), schema 1 (top-level sections)
 * and a bare progress map.
 * Sections of retired keys (registry RETIRED, e.g. "lang" from ≤ 0.6) are ignored like any unknown section.
 */
import { migrateProgress, mergeProgress, isMastered, type ProgressView } from "./progress.ts";
import { isOwnId } from "./items.ts";
import { SCHEMA_VERSION } from "./registry.ts";

export const FORMAT = "pddge-progress";
const THEMES = ["light", "dark"];
const NOT_OURS = "Это не файл прогресса ПДД Грузии.";

type Note = { x: string; t: number };
export type LearnerState = {
  progress?: Record<string, ProgressView>;
  runs?: { id: string; lesson?: string; date?: number }[];
  active?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  exams?: { d: number }[];
  theme?: string;
  notes?: Record<string, Note>;
  session?: { ids: (string | number)[]; i: number; ok: number; bad: number; held: boolean };
  intersection?: {
    version: 1;
    answered: number;
    firstTry: number;
    concepts: Record<string, unknown>;
    history?: {
      scenario: Record<string, unknown>;
      steps: {
        vehicleId: string;
        correct: boolean;
        text: string;
        norms: { id: string; label: string }[];
        highlight?: { selected: string; yieldTo: string[]; paths: string[]; signs: string[] };
      }[];
    }[];
  };
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const NOTE_MAX = 4000;

/** Notes: {ticket id: {x text, t saved at}}; empty or malformed notes are dropped. */
export function cleanNotes(v: unknown): Record<string, Note> | undefined {
  if (!isObj(v)) return undefined;
  const out: Record<string, Note> = {};
  for (const [id, raw] of Object.entries(v)) {
    if (!(/^\d+$/.test(id) || isOwnId(id)) || !isObj(raw) || typeof raw.x !== "string" || typeof raw.t !== "number") continue;
    const x = raw.x.trim().slice(0, NOTE_MAX);
    if (x) out[id] = { x, t: raw.t };
  }
  return out;
}

/** Unfinished practice: the question list, the index still on screen, counters, and whether that question is already answered. */
export function cleanSession(v: unknown) {
  if (!isObj(v) || !Array.isArray(v.ids) || !v.ids.length) return undefined;
  if (typeof v.i !== "number" || !Number.isInteger(v.i) || v.i < 0 || v.i >= v.ids.length) return undefined;
  if (!v.ids.every(id => typeof id === "number" || (typeof id === "string" && id.length > 0))) return undefined;
  const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
  return { ids: v.ids as (string | number)[], i: v.i, ok: count(v.ok), bad: count(v.bad), held: v.held === true };
}

/** Per-section validators: return the clean value or undefined (section dropped). */
const CLEAN: Record<string, (v: unknown) => unknown> = {
  progress: v => migrateProgress(v),
  runs: v => (Array.isArray(v) ? v.filter(r => isObj(r) && typeof r.id === "string") : undefined),
  active: v => (isObj(v) ? v : undefined),
  settings: v => (isObj(v) ? v : undefined),
  exams: v => (Array.isArray(v) ? v.filter(e => isObj(e) && typeof e.d === "number") : undefined),
  theme: v => (typeof v === "string" && THEMES.includes(v) ? v : undefined),
  notes: cleanNotes,
  session: cleanSession,
  intersection: cleanIntersection,
};

/** Trainer counts stay out of the ticket journal. A bad or foreign shape is dropped, not repaired. */
function cleanIntersection(v: unknown) {
  if (!isObj(v) || v.version !== 1) return undefined;
  if (typeof v.answered !== "number" || typeof v.firstTry !== "number" || !isObj(v.concepts)) return undefined;
  const history = cleanTrainerHistory(v.history);
  const base = { version: 1 as const, answered: v.answered, firstTry: v.firstTry, concepts: v.concepts };
  return history.length ? { ...base, history } : base;
}

function cleanTrainerHistory(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const records = [];
  for (const item of raw) {
    if (!isObj(item) || !isObj(item.scenario) || !Array.isArray(item.scenario.vehicles) || item.scenario.vehicles.length === 0) continue;
    if (!Array.isArray(item.steps)) continue;
    const steps = [];
    for (const step of item.steps) {
      if (!isObj(step) || typeof step.vehicleId !== "string" || typeof step.correct !== "boolean") continue;
      if (typeof step.text !== "string" || step.text.length === 0) continue;
      const norms = Array.isArray(step.norms)
        ? step.norms.flatMap((norm) => isObj(norm) && typeof norm.id === "string" && typeof norm.label === "string"
          ? [{ id: norm.id, label: norm.label }] : [])
        : [];
      const highlight = isObj(step.highlight) ? {
        selected: typeof step.highlight.selected === "string" ? step.highlight.selected : step.vehicleId,
        yieldTo: stringList(step.highlight.yieldTo),
        paths: stringList(step.highlight.paths),
        signs: stringList(step.highlight.signs),
      } : undefined;
      steps.push({ vehicleId: step.vehicleId, correct: step.correct, text: step.text, norms, ...(highlight ? { highlight } : {}) });
    }
    if (steps.length) records.push({ scenario: item.scenario, steps });
  }
  return records.slice(-40);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
}

export function cleanState(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [id, fn] of Object.entries(CLEAN)) {
    if (data[id] === undefined || data[id] === null) continue;
    const v = fn(data[id]);
    if (v !== undefined) out[id] = v;
  }
  return out;
}

export function makeBundle(state: Record<string, unknown>, now: number, app: string) {
  return { format: FORMAT, schema: SCHEMA_VERSION, app, exportedAt: new Date(now).toISOString(), data: cleanState(state) };
}

/** Parses a file's text → { schema, app, exportedAt, migratedFrom, state }. Throws Error with a Russian message. */
export function parseBundle(text: string) {
  let f;
  try { f = JSON.parse(text); } catch (e) { throw new Error("Файл не читается как JSON."); }
  if (!isObj(f)) throw new Error(NOT_OURS);
  if (f.format === FORMAT && f.schema === undefined && f.version === 1) {
    const { progress, runs, active, settings } = f;
    return { schema: 1, app: null, exportedAt: f.exportedAt ?? null, migratedFrom: 1, state: cleanState({ progress, runs, active, settings }) };
  }
  if (f.format === FORMAT) {
    const schema = f.schema;
    if (typeof schema !== "number" || !Number.isInteger(schema) || schema < 1) throw new Error(`Неизвестная версия файла: ${schema ?? f.version}.`);
    if (schema > SCHEMA_VERSION)
      throw new Error(`Файл сохранён более новой версией сайта (схема ${schema}, здесь ${SCHEMA_VERSION}). Обновите страницу (Ctrl+F5) и попробуйте снова.`);
    if (!isObj(f.data)) throw new Error("Файл повреждён: нет раздела data.");
    return { schema, app: f.app ?? null, exportedAt: f.exportedAt ?? null,
      migratedFrom: schema < SCHEMA_VERSION ? schema : null, state: cleanState(f.data) };
  }
  const keys = Object.keys(f);
  if (keys.length && keys.every(k => /^\d+$/.test(k)))
    return { schema: 0, app: null, exportedAt: null, migratedFrom: 0, state: { progress: migrateProgress(f) } };
  throw new Error(NOT_OURS);
}

const unionBy = <T>(a: T[] | undefined = [], b: T[] | undefined = [], key: (x: T) => unknown): T[] => {
  const left = a ?? [];
  const right = b ?? [];
  const seen = new Set(left.map(key));
  return [...left, ...right.filter(x => !seen.has(key(x)))];
};

/** Merge: journals united by event id (a balance is not added twice), local unfinished runs, settings and preferences win. */
export function mergeState(current: LearnerState, incoming: LearnerState): LearnerState {
  const out: LearnerState = {
    progress: mergeProgress(current.progress || {}, incoming.progress || {}),
    runs: unionBy(current.runs, incoming.runs, r => r.id),
    active: { ...(incoming.active || {}), ...(current.active || {}) },
    settings: { ...(incoming.settings || {}), ...(current.settings || {}) },
    exams: unionBy(current.exams, incoming.exams, e => e.d).sort((x, y) => x.d - y.d),
  };
  const notes: Record<string, Note> = { ...(incoming.notes || {}) };
  for (const [id, n] of Object.entries(current.notes || {})) if (!notes[id] || n.t >= notes[id].t) notes[id] = n;
  if (Object.keys(notes).length) out.notes = notes;
  const theme = current.theme ?? incoming.theme;
  if (theme != null) out.theme = theme;
  const session = current.session ?? incoming.session;
  if (session) out.session = session;
  const intersection = current.intersection ?? incoming.intersection;
  if (intersection) out.intersection = intersection;
  return out;
}

export function applyImport(current: LearnerState, incoming: LearnerState, mode: string) {
  if (mode === "replace") return { ...incoming };
  if (mode === "merge") return mergeState(current, incoming);
  throw new Error(`Неизвестный режим загрузки: ${mode}.`);
}

export function summarize(s: LearnerState) {
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

export function previewImport(current: LearnerState, incoming: LearnerState, mode: string) {
  return { mode, before: summarize(current), file: summarize(incoming), after: summarize(applyImport(current, incoming, mode)) };
}
