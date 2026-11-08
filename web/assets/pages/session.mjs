/** Page script: one pausable study. The order is fixed by the domain; this page only shows the current step. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { store } from "../app/progress.mjs";
import { isMastered } from "../domain/progress.mjs";
import { completeStep, currentStep, studyFor, studyLeft } from "../domain/session.mjs";

const KIND = {
  theory: "Теория",
  practice: "Практика",
  review: "Повтор",
  breakdown: "Разбор",
  variation: "Другая ситуация",
};

const EP07 = {
  theory: ["ostanovka", "stoyanka", "vynuzhdennaya"],
  breakdown: ["ostanovka", "stoyanka", "vynuzhdennaya"],
  variation: ["o-ep07-01", "o-ep07-02"],
};

function lastWrong(rec) {
  const events = rec?.events || rec?.h || [];
  const last = events[events.length - 1];
  return !!last && !last.ok;
}

function href(lesson, step) {
  if (step.kind === "practice" || step.kind === "review" || step.kind === "variation") return `practice.html?ids=${encodeURIComponent(step.ref)}&start=1`;
  return `episode.html?id=${lesson}#${encodeURIComponent(step.ref)}`;
}

function fresh(lesson, tickets) {
  const progress = store.progress();
  return studyFor({
    id: `study-${lesson}-${Date.now()}`,
    lesson: lesson.id,
    theory: EP07.theory,
    breakdown: EP07.breakdown,
    variation: EP07.variation,
    tickets: tickets.map((ticket) => {
      const rec = progress[ticket.id];
      return { id: String(ticket.id), mastered: isMastered(rec), lastWrong: lastWrong(rec) };
    }),
  });
}

function draw(study) {
  const step = currentStep(study);
  const left = studyLeft(study);
  const root = $("#m");
  if (!step) {
    root.innerHTML = `<p class="small mut"><a href="index.html">Выпуски</a></p><h1>Занятие закончено</h1><p>Шагов было ${study.steps.length}. Можно начать то же занятие сначала: состав снова посчитается по журналу.</p><button class="btn" id="again" type="button">Сначала</button>`;
    $("#again").onclick = () => { store.clearStudy(); location.reload(); };
    return;
  }
  root.innerHTML = `<p class="small mut"><a href="index.html">Выпуски</a> · занятие можно закрыть и открыть снова</p>
    <h1>${KIND[step.kind]}</h1>
    <p class="small">Шаг ${study.cursor + 1} из ${study.steps.length}. Осталось ${left}.</p>
    <p><a class="btn" href="${href(study.lesson, step)}">${step.kind === "practice" || step.kind === "review" || step.kind === "variation" ? "Открыть вопрос" : "Открыть раздел"}</a></p>
    <p class="small mut">На вопросе ответ пишется в журнал и открывает пояснение. Здесь шаг отмечается отдельно, когда раздел прочитан или вопрос решён.</p>
    <div class="row"><button class="btn" id="done" type="button">Шаг сделан</button><a class="btn ghost" href="index.html">Остановить</a></div>`;
  $("#done").onclick = () => { store.saveStudy(completeStep(study)); draw(store.study()); };
}

(async () => {
  header("eps");
  const [tickets, episodes] = await Promise.all([loadTickets(), loadEpisodes()]);
  const lesson = episodes.released.find((item) => item.id === "ep07");
  if (!lesson) { $("#m").innerHTML = "<h1>Выпуск 7 ещё не собран</h1>"; return; }
  const ids = new Set([...(lesson.tickets_core || []), ...(lesson.tickets_linked || []), ...(lesson.own_items || [])]);
  const pool = tickets.tickets.filter((ticket) => ids.has(ticket.id));
  let study = store.study();
  if (!study || study.lesson !== lesson.id) study = fresh(lesson, pool);
  store.saveStudy(study);
  draw(study);
})();
