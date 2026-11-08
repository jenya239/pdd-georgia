/**
 * Storage adapter. `backend` is anything with getItem/setItem/removeItem (window.localStorage
 * in the browser, memoryBackend() in tests). All domain rules live in the pure modules.
 */
import { applyAnswer, migrateProgress, undoLast } from "./progress.ts";
import { forgetLesson } from "./forget.ts";
import { makeBundle, parseBundle, applyImport, previewImport, cleanState, cleanNotes } from "./bundle.ts";
import { STORAGE, KEYS, RETIRED, APP_VERSION } from "./registry.ts";

export { KEYS };
const DEFAULT_SETTINGS = { order: "new-first", own: true };

type Backend = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

export function memoryBackend(init: Record<string, string> = {}): Backend {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
}

export function createStore(backend: Backend) {
  RETIRED.forEach(r => backend.removeItem(r.key));
  const read = (key: string, fallback: unknown) => {
    try { const v = JSON.parse(backend.getItem(key) ?? "null"); return v ?? fallback; } catch (e) { return fallback; }
  };
  const write = (key: string, value: unknown) => backend.setItem(key, JSON.stringify(value));
  const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {});

  const progress = () => migrateProgress(read(KEYS.progress, {}));
  const runs = () => { const r = read(KEYS.runs, []); return Array.isArray(r) ? r : []; };
  const actives = () => obj(read(KEYS.active, {}));
  const settings = () => ({ ...DEFAULT_SETTINGS, ...obj(read(KEYS.settings, {})) });
  const notes = () => cleanNotes(read(KEYS.notes, {})) || {};
  const exams = () => { const r = read(KEYS.exams, []); return Array.isArray(r) ? r : []; };
  /** Raw snapshot of every registered key (json parsed, text as is); absent keys are omitted. */
  const snapshot = () => {
    const out: Record<string, unknown> = {};
    for (const s of STORAGE) {
      const raw = backend.getItem(s.key);
      if (raw === null || raw === undefined) continue;
      if (s.kind === "text") { out[s.id] = raw; continue; }
      try { out[s.id] = JSON.parse(raw); } catch (e) { /* broken value: not exported */ }
    }
    return cleanState(out);
  };
  const restore = (st: Record<string, unknown>) => {
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
    recordAnswer(id: string | number, answer: Parameters<typeof applyAnswer>[1]) {
      const p = progress();
      p[id] = applyAnswer(p[id], answer);
      write(KEYS.progress, p);
      return p[id];
    },
    /** Drops the latest attempt. A paused check loses this ticket only when that attempt was given there and matches. */
    undoAnswer(id: string | number) {
      const p = progress();
      const res = undoLast(p[id]);
      if (!res) return null;
      if (res.record) p[id] = res.record;
      else delete p[id];
      write(KEYS.progress, p);
      if (res.undone.w === "check") {
        const a = actives();
        let changed = false;
        for (const [lesson, run] of Object.entries(a)) {
          if (!run?.answers) continue;
          const key = Object.keys(run.answers).find(k => k === String(id));
          const ans = key ? run.answers[key] : null;
          if (!key || !ans || ans.choice !== res.undone.c || !!ans.ok !== !!res.undone.ok) continue;
          const answers = { ...run.answers };
          delete answers[key];
          a[lesson] = { ...run, answers };
          changed = true;
        }
        if (changed) write(KEYS.active, a);
      }
      return res;
    },
    activeRun: (lesson: string) => actives()[lesson] ?? null,
    study: () => actives().study ?? null,
    saveStudy(study: { id: string; lesson: string }) { write(KEYS.active, { ...actives(), study }); },
    clearStudy() { const a = actives(); delete a.study; write(KEYS.active, a); },
    saveActiveRun(run: { lesson: string }) { write(KEYS.active, { ...actives(), [run.lesson]: run }); },
    clearActiveRun(lesson: string) { const a = actives(); delete a[lesson]; write(KEYS.active, a); },
    finishRun(lesson: string, result: unknown) {
      this.clearActiveRun(lesson);
      write(KEYS.runs, [...runs(), result]);
    },
    saveSettings(s: Record<string, unknown>) { write(KEYS.settings, { ...obj(read(KEYS.settings, {})), ...s }); },
    exams,
    notes,
    /** Saves the learner's note on a ticket; blank text deletes it. */
    saveNote(id: string, text: string, now: number) {
      const n = notes(), x = String(text ?? "").trim();
      if (x) n[id] = { x, t: now }; else delete n[id];
      write(KEYS.notes, n);
      return n[id] ?? null;
    },
    addExam(e: unknown, keep = 50) { write(KEYS.exams, [...exams(), e].slice(-keep)); },
    snapshot,
    /** The whole browser state as the progress file text. */
    exportText: (now: number, app = APP_VERSION) => JSON.stringify(makeBundle(snapshot(), now, app), null, 1),
    /** Parses a file and describes what loading it would do (nothing is written). Throws on a bad file. */
    previewText(text: string, mode = "merge") {
      const f = parseBundle(text);
      return { ...f, ...previewImport(snapshot(), f.state, mode) };
    },
    /** Loads a file: mode "merge" (combine with this browser) or "replace" (this browser becomes the file). */
    importText(text: string, mode = "merge") {
      const f = parseBundle(text);
      const next = applyImport(snapshot(), f.state, mode);
      restore(next);
      return previewImport(next, {}, "merge").before;
    },
    resetAll() { STORAGE.forEach(s => backend.removeItem(s.key)); },
    /** Drops answers and cumulative-check history of one lesson. Notes, exams and settings stay. */
    resetLesson(lessonId: string, ids: (string | number)[]) {
      const next = forgetLesson({ progress: progress(), runs: runs(), active: actives() }, lessonId, ids);
      write(KEYS.progress, next.progress);
      write(KEYS.runs, next.runs);
      write(KEYS.active, next.active);
      return next;
    },
  };
}
