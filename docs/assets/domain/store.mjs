/**
 * Storage adapter. `backend` is anything with getItem/setItem/removeItem (window.localStorage
 * in the browser, memoryBackend() in tests). All domain rules live in the pure modules.
 */
import { applyAnswer, migrateProgress } from "./progress.mjs";
import { makeBundle, parseBundle, applyImport, previewImport, cleanState } from "./bundle.mjs";
import { STORAGE, KEYS, RETIRED, APP_VERSION } from "./registry.mjs";

export { KEYS };
const DEFAULT_SETTINGS = { order: "new-first", own: true };

export function memoryBackend(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

export function createStore(backend) {
  RETIRED.forEach(r => backend.removeItem(r.key));
  const read = (key, fallback) => {
    try { const v = JSON.parse(backend.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
  };
  const write = (key, value) => backend.setItem(key, JSON.stringify(value));
  const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

  const progress = () => migrateProgress(read(KEYS.progress, {}));
  const runs = () => { const r = read(KEYS.runs, []); return Array.isArray(r) ? r : []; };
  const actives = () => obj(read(KEYS.active, {}));
  const settings = () => ({ ...DEFAULT_SETTINGS, ...obj(read(KEYS.settings, {})) });
  const exams = () => { const r = read(KEYS.exams, []); return Array.isArray(r) ? r : []; };
  /** Raw snapshot of every registered key (json parsed, text as is); absent keys are omitted. */
  const snapshot = () => {
    const out = {};
    for (const s of STORAGE) {
      const raw = backend.getItem(s.key);
      if (raw === null || raw === undefined) continue;
      if (s.kind === "text") { out[s.id] = raw; continue; }
      try { out[s.id] = JSON.parse(raw); } catch (e) { /* broken value: not exported */ }
    }
    return cleanState(out);
  };
  const restore = st => {
    for (const s of STORAGE) {
      const v = st[s.id];
      if (v === undefined || v === null) backend.removeItem(s.key);
      else backend.setItem(s.key, s.kind === "text" ? String(v) : JSON.stringify(v));
    }
  };

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
    exams,
    addExam(e, keep = 50) { write(KEYS.exams, [...exams(), e].slice(-keep)); },
    snapshot,
    /** The whole browser state as the progress file text. */
    exportText: (now, app = APP_VERSION) => JSON.stringify(makeBundle(snapshot(), now, app), null, 1),
    /** Parses a file and describes what loading it would do (nothing is written). Throws on a bad file. */
    previewText(text, mode = "merge") {
      const f = parseBundle(text);
      return { ...f, ...previewImport(snapshot(), f.state, mode) };
    },
    /** Loads a file: mode "merge" (combine with this browser) or "replace" (this browser becomes the file). */
    importText(text, mode = "merge") {
      const f = parseBundle(text);
      const next = applyImport(snapshot(), f.state, mode);
      restore(next);
      return previewImport(next, {}, "merge").before;
    },
    resetAll() { STORAGE.forEach(s => backend.removeItem(s.key)); },
  };
}
