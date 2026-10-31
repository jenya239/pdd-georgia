/**
 * Drop one lesson's answers and its cumulative-check history.
 *
 * ids: that lesson's tickets and own questions. A later lesson's unfinished check
 * loses answers for those ids, so the questions come up again. Finished checks of
 * other lessons stay as recorded. Notes, exams and settings are outside this state.
 */
export function forgetLesson(state, lessonId, ids) {
  const drop = new Set((ids || []).map(String));
  const progress = {};
  for (const [id, rec] of Object.entries(state.progress || {})) {
    if (!drop.has(id)) progress[id] = rec;
  }
  const runs = (state.runs || []).filter(r => r.lesson !== lessonId);
  const active = {};
  for (const [id, run] of Object.entries(state.active || {})) {
    if (id === lessonId || !run) continue;
    const answers = { ...(run.answers || {}) };
    let changed = false;
    for (const key of Object.keys(answers)) {
      if (drop.has(key)) { delete answers[key]; changed = true; }
    }
    active[id] = changed ? { ...run, answers } : run;
  }
  return { progress, runs, active };
}
