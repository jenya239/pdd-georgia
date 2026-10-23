/** Export / import of the whole learner state as a JSON file (pure). */
import { migrateProgress, mergeProgress } from "./progress.mjs";

export const FORMAT = "pddge-progress";
export const VERSION = 1;

export function makeBundle({ progress, runs, active, settings }, now) {
  return { format: FORMAT, version: VERSION, exportedAt: new Date(now).toISOString(), progress, runs, active, settings };
}

const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const validRuns = runs => (Array.isArray(runs) ? runs.filter(r => isObj(r) && typeof r.id === "string") : []);

export function parseBundle(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error("Файл не читается как JSON."); }
  if (!isObj(data)) throw new Error("Это не файл прогресса ПДД Грузии.");
  if (data.format === FORMAT) {
    if (data.version !== VERSION) throw new Error(`Неподдерживаемая версия файла: ${data.version}.`);
    return { progress: migrateProgress(data.progress), runs: validRuns(data.runs),
      active: isObj(data.active) ? data.active : {}, settings: isObj(data.settings) ? data.settings : {} };
  }
  const keys = Object.keys(data);
  if (keys.length && keys.every(k => /^\d+$/.test(k))) {
    return { progress: migrateProgress(data), runs: [], active: {}, settings: {} };
  }
  throw new Error("Это не файл прогресса ПДД Грузии.");
}

/** Local state wins for unfinished runs and settings; progress is summed; runs are united by id. */
export function mergeState(current, incoming) {
  const ids = new Set(current.runs.map(r => r.id));
  return {
    progress: mergeProgress(current.progress, incoming.progress),
    runs: [...current.runs, ...incoming.runs.filter(r => !ids.has(r.id))],
    active: { ...incoming.active, ...current.active },
    settings: { ...incoming.settings, ...current.settings },
  };
}
