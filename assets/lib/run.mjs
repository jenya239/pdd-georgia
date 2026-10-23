/** A cumulative-check run: a fixed ordered list of tickets solved in full (pure, JSON-serialisable). */
export function startRun({ id, lesson, ids, order, now }) {
  return { id, lesson, ids: [...ids], order, startedAt: now, answers: {} };
}

export function answerRun(run, ticketId, { choice, ok }) {
  if (!run.ids.includes(ticketId)) throw new Error(`ticket ${ticketId} is not in run ${run.id}`);
  if (run.answers[ticketId]) throw new Error(`ticket ${ticketId} already answered`);
  return { ...run, answers: { ...run.answers, [ticketId]: { choice, ok: !!ok } } };
}

export const nextTicket = run => run.ids.find(id => !run.answers[id]) ?? null;
export const isFinished = run => nextTicket(run) === null;
export const answeredCount = run => run.ids.filter(id => run.answers[id]).length;

export function runResult(run, now) {
  if (!isFinished(run)) throw new Error("run is not finished");
  const wrong = run.ids.filter(id => !run.answers[id].ok);
  const total = run.ids.length, correct = total - wrong.length;
  return { id: run.id, lesson: run.lesson, date: now, startedAt: run.startedAt, total, correct,
    score: total ? Math.round((100 * correct) / total) : 0, wrong };
}

export const lessonTrend = (runs, lesson) => runs.filter(r => r.lesson === lesson).sort((a, b) => a.date - b.date);
