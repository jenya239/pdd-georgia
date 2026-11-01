/** A cumulative-check run: a fixed ordered list of tickets solved in full (pure, JSON-serialisable). */
type Run = { id: string; lesson: string; ids: (string | number)[]; order?: string; startedAt: number; answers: Record<string, { choice: number; ok: boolean }> };
export function startRun({ id, lesson, ids, order, now }: { id: string; lesson: string; ids: (string | number)[]; order?: string; now: number }): Run {
  return { id, lesson, ids: [...ids], order, startedAt: now, answers: {} };
}

export function answerRun(run: Run, ticketId: string | number, { choice, ok }: { choice: number; ok: boolean }): Run {
  if (!run.ids.includes(ticketId)) throw new Error(`ticket ${ticketId} is not in run ${run.id}`);
  if (run.answers[ticketId]) throw new Error(`ticket ${ticketId} already answered`);
  return { ...run, answers: { ...run.answers, [ticketId]: { choice, ok: !!ok } } };
}

export const nextTicket = (run: Run) => run.ids.find(id => !run.answers[id]) ?? null;
export const isFinished = (run: Run) => nextTicket(run) === null;
export const answeredCount = (run: Run) => run.ids.filter(id => run.answers[id]).length;

export function runResult(run: Run, now: number) {
  if (!isFinished(run)) throw new Error("run is not finished");
  const wrong = run.ids.filter(id => !run.answers[id].ok);
  const total = run.ids.length, correct = total - wrong.length;
  return { id: run.id, lesson: run.lesson, date: now, startedAt: run.startedAt, total, correct,
    score: total ? Math.round((100 * correct) / total) : 0, wrong };
}

export const lessonTrend = (runs: { lesson: string; date: number }[], lesson: string) => runs.filter(r => r.lesson === lesson).sort((a, b) => a.date - b.date);
