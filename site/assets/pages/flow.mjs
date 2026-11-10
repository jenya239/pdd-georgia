/** Page script: flow.html. One step on screen; nothing advances by itself. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { store } from "../app/progress.mjs";
import { renderQuestion } from "../app/question.mjs";
import { flowKey, nextFlowItem } from "../domain/flow.mjs";

const MODES = ["mix", "situations", "explain", "review"];
const PAUSE = "Сейчас можно остановиться. До этого места выпуски уже пройдены.";
const DONE = "Вопросы вышедших выпусков отвечены. Это спокойное место остановиться.";

header("home");
const [D, E, st] = await Promise.all([loadTickets(), loadEpisodes(), store]);
const modeEl = $("#mode");
if (MODES.includes(st.settings().flow)) modeEl.value = st.settings().flow;

let avoid = [];
let last, anchor, just, held;

const stepNow = () => nextFlowItem(E.released, st.progress(), {
  mode: modeEl.value, own: st.settings().own !== false, last, anchor, avoid, just,
});

function forward(step, skip) {
  const key = flowKey(step);
  if (skip && !avoid.includes(key)) avoid.push(key);
  just = key;
  last = step.kind;
  anchor = step.lessonId;
  held = null;
  render(stepNow());
}

function gate(step, key) {
  $("#stage").innerHTML = `<p class="note">${step.done ? DONE : PAUSE}</p>
    <div class="row">
      <a class="btn ghost" href="index.html">Остановиться</a>
      <button type="button" class="btn" id="go">${step.done ? "Перечитать выпуск" : "Продолжить"}</button>
      ${step.done ? "" : `<button type="button" class="btn ghost" id="skip">Пропустить</button>`}
    </div>`;
  $("#go").onclick = () => { held = key; render(step); };
  if ($("#skip")) $("#skip").onclick = () => forward(step, true);
}

function bindMove(step) {
  if ($("#next")) $("#next").onclick = () => forward(step, false);
  if ($("#skip")) $("#skip").onclick = () => forward(step, true);
}

function render(step) {
  const stage = $("#stage");
  stage.classList.remove("step");
  void stage.offsetWidth;
  stage.classList.add("step");
  if (!step) { stage.textContent = "Выпусков пока нет."; return; }
  const key = flowKey(step);
  if ((step.done || step.pause) && held !== key) { gate(step, key); return; }
  if (step.kind === "theory") {
    stage.innerHTML = `<p class="kicker">Объяснение</p><h2>${esc(step.title)}</h2>
      <p class="deck">${esc(step.lead || "Короткое объяснение этого выпуска.")}</p>
      <p><a href="episode.html?id=${esc(step.lessonId)}">Открыть выпуск</a></p>
      ${step.done
        ? `<div class="row"><a class="btn ghost" href="course.html">Курс</a><a class="btn ghost" href="exam.html">Экзамен</a></div>`
        : `<div class="row"><button type="button" class="btn" id="next">Дальше</button><button type="button" class="btn ghost" id="skip">Пропустить</button></div>`}`;
    bindMove(step);
    return;
  }
  const ticket = D.byId[step.ticketId];
  if (!ticket) {
    stage.innerHTML = `<p>Вопрос этого шага не найден.</p><div class="row"><button type="button" class="btn" id="skip">Дальше</button></div>`;
    $("#skip").onclick = () => forward(step, true);
    return;
  }
  stage.innerHTML = `<p class="kicker">${step.kind === "review" ? "Повтор ошибки" : "Дорожная ситуация"}</p>
    <p class="mut">${esc(step.title)}</p><div id="q"></div>
    <div class="row" id="act"><button type="button" class="btn ghost" id="skip">Пропустить</button></div>`;
  $("#skip").onclick = () => forward(step, true);
  renderQuestion($("#q"), ticket, {
    where: "flow",
    onAnswer() {
      $("#act").innerHTML = `<button type="button" class="btn" id="next">Дальше</button>`;
      $("#next").onclick = () => forward(step, false);
    },
    onUndo() {
      $("#act").innerHTML = `<button type="button" class="btn ghost" id="skip">Пропустить</button>`;
      $("#skip").onclick = () => forward(step, true);
    },
  });
}

modeEl.onchange = () => {
  st.saveSettings({ flow: modeEl.value });
  last = undefined;
  anchor = undefined;
  just = undefined;
  held = null;
  render(stepNow());
};
render(stepNow());
