/** The learner's store bound to this browser's localStorage (rules live in ../domain). */
import { createStore, KEYS } from "../domain/store.mjs";

export const store = createStore(localStorage);

/** Records an answer (choice = 0-based option index, where = place, see domain WHERE); returns the new record. */
export const record = (id, ok, choice, where) => store.recordAnswer(id, { ok: !!ok, choice, now: Date.now(), where });

export const progress = () => store.progress();

export function resetProgress() { localStorage.removeItem(KEYS.progress); }

export function summary(ids) {
  const p = progress();
  let seen = 0, ok = 0, bad = 0;
  for (const id of ids) {
    const r = p[id];
    if (!r) continue;
    seen++;
    r.l ? ok++ : bad++;
  }
  return { total: ids.length, seen, ok, bad };
}
