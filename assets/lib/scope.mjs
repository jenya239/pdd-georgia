/** Lesson scope and the cumulative ticket set (pure). */
export const releasedLessons = released => [...released].sort((a, b) => a.num - b.num);

export function currentLesson(released) {
  const list = releasedLessons(released);
  return list.length ? list[list.length - 1] : null;
}

/** Tickets of this lesson (`current`) and of all earlier lessons (`previous`). */
export function cumulativeScope(released, lessonId) {
  const list = releasedLessons(released);
  const idx = list.findIndex(l => l.id === lessonId);
  if (idx < 0) throw new Error(`unknown lesson ${lessonId}`);
  return {
    current: [...(list[idx].tickets_lesson || [])],
    previous: list.slice(0, idx).flatMap(l => l.tickets_lesson || []),
  };
}

export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "new-first": the new lesson in its order, then earlier lessons shuffled; "mixed": all shuffled. */
export function cumulativeOrder({ current, previous }, { order = "new-first", rng = Math.random } = {}) {
  return order === "mixed" ? shuffle([...current, ...previous], rng) : [...current, ...shuffle(previous, rng)];
}

export function scopeStatus(ids, progress) {
  let solved = 0, correctNow = 0, attempts = 0, wrong = 0;
  for (const id of ids) {
    const r = progress[id];
    if (!r) continue;
    solved++;
    if (r.l === 1) correctNow++;
    attempts += r.s;
    wrong += r.w;
  }
  return { inScope: ids.length, solved, correctNow, attempts, wrong, errorRate: attempts ? wrong / attempts : null };
}
