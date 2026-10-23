/**
 * Storage adapter. `backend` is anything with getItem/setItem/removeItem (window.localStorage
 * in the browser, memoryBackend() in tests). All domain rules live in the pure modules.
 */
import { applyAnswer, migrateProgress } from "./progress.mjs";
import { makeBundle, parseBundle, mergeState } from "./bundle.mjs";

export const KEYS = {
  progress: "pddge.progress.v1", // per-ticket records (legacy key, records extended additively)
  runs: "pddge.runs.v1",         // finished cumulative checks
  active: "pddge.cumrun.v1",     // unfinished cumulative checks by lesson
  settings: "pddge.settings.v1",
};
const DEFAULT_SETTINGS = { order: "new-first" };

export function memoryBackend(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

export function createStore(backend) {
  const read = (key, fallback) => {
    try { const v = JSON.parse(backend.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
  };
  const write = (key, value) => backend.setItem(key, JSON.stringify(value));
  const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

  const progress = () => migrateProgress(read(KEYS.progress, {}));
  const runs = () => { const r = read(KEYS.runs, []); return Array.isArray(r) ? r : []; };
  const actives = () => obj(read(KEYS.active, {}));
  const settings = () => ({ ...DEFAULT_SETTINGS, ...obj(read(KEYS.settings, {})) });
  const state = () => ({ progress: progress(), runs: runs(), active: actives(), settings: obj(read(KEYS.settings, {})) });

  return {
    progress,
    runs,
    settings,
    recordAnswer(id, answer) {
      const p = progress();
      p[id] = applyAnswer(p[id], answer);
      write(KEYS.progress, p);
      return p[id];
    },
    activeRun: lesson => actives()[lesson] ?? null,
    saveActiveRun(run) { write(KEYS.active, { ...actives(), [run.lesson]: run }); },
    clearActiveRun(lesson) { const a = actives(); delete a[lesson]; write(KEYS.active, a); },
    finishRun(lesson, result) {
      this.clearActiveRun(lesson);
      write(KEYS.runs, [...runs(), result]);
    },
    saveSettings(s) { write(KEYS.settings, { ...obj(read(KEYS.settings, {})), ...s }); },
    exportText: now => JSON.stringify(makeBundle(state(), now), null, 1),
    importText(text) {
      const merged = mergeState(state(), parseBundle(text));
      write(KEYS.progress, merged.progress);
      write(KEYS.runs, merged.runs);
      write(KEYS.active, merged.active);
      write(KEYS.settings, merged.settings);
      return { tickets: Object.keys(merged.progress).length, runs: merged.runs.length };
    },
    resetAll() { Object.values(KEYS).forEach(k => backend.removeItem(k)); },
  };
}
