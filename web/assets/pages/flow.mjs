/** Page script: flow.html. One fragment or one question; nothing advances by itself. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc } from "../app/dom.mjs";
import { enhanceFigures } from "../app/figzoom.mjs";
import { header } from "../app/layout.mjs";
import { store } from "../app/progress.mjs";
import { renderQuestion } from "../app/question.mjs";
import { lessonParts, readingHref } from "../domain/episode.mjs";
import { cleanFlowRun, flowKey, nextFlowItem } from "../domain/flow.mjs";

const MODES = ["mix", "situations", "explain", "review"];
const PAUSE = "Сейчас можно остановиться. До этого места выпуски уже пройдены.";
const DONE = "Новые вопросы вышедших выпусков отвечены. Это спокойное место остановиться. Дальше — повторение.";

header("home");
const [E, st] = await Promise.all([loadEpisodes(), store]);
const modeEl = $("#mode");
const saved = cleanFlowRun(st.settings().flowRun);
if (MODES.includes(st.settings().flow)) modeEl.value = st.settings().flow;

let avoid = saved.avoid;
let last = saved.last;
let anchor = saved.anchor;
let part = saved.part;
let partLesson = saved.partLesson;
let repeat = saved.repeat;
let just, held;
let bank = null;
let token = 0;
const partsCache = new Map();

const lessonOf = (id) => E.released.find(item => item.id === id);

function persist() {
  st.saveSettings({ flowRun: { last, anchor, avoid, part, partLesson, repeat } });
}

function stepNow() {
  const own = st.settings().own !== false;
  const opts = { mode: modeEl.value, own, last, anchor, avoid, just, repeat };
  if (repeat && !nextFlowItem(E.released, st.progress(), { ...opts, repeat: false })?.done) {
    repeat = false;
    persist();
    return nextFlowItem(E.released, st.progress(), { ...opts, repeat: false });
  }
  return nextFlowItem(E.released, st.progress(), opts);
}

function forward(step, skip) {
  if ($("#next")) $("#next").disabled = true;
  const key = flowKey(step);
  if (skip && !avoid.includes(key)) avoid.push(key);
  just = key;
  last = step.kind;
  anchor = step.lessonId;
  held = null;
  part = 0;
  partLesson = undefined;
  persist();
  void render(stepNow());
}

function gate(step, key) {
  $("#stage").innerHTML = `<p class="note">${step.done ? DONE : PAUSE}</p>
    <div class="row">
      <a class="btn ghost" href="index.html">Остановиться</a>
      <button type="button" class="btn" id="go">${step.done ? "Продолжить повторение" : "Продолжить"}</button>
      ${step.done ? "" : `<button type="button" class="btn ghost" id="skip">Пропустить</button>`}
    </div>`;
  $("#go").onclick = () => {
    if (step.done) { repeat = true; persist(); void render(stepNow()); return; }
    held = key;
    void render(step);
  };
  if ($("#skip")) $("#skip").onclick = () => forward(step, true);
}

async function partsOf(lesson) {
  if (!lesson) return [];
  if (partsCache.has(lesson.id)) return partsCache.get(lesson.id);
  const href = readingHref(lesson);
  let parts = [];
  if (href) {
    const res = await fetch(href);
    if (res.ok) parts = lessonParts(await res.text());
  }
  partsCache.set(lesson.id, parts);
  return parts;
}

function fragmentAt(parts, lessonId, from) {
  for (let i = from; i < parts.length; i++) {
    if (!avoid.includes(`theory:${lessonId}:${i}`)) return i;
  }
  return -1;
}

function paintTheory(step, parts) {
  const stage = $("#stage");
  if (!parts.length) parts = [{ heading: "", html: `<p>${esc(step.lead || "Короткое объяснение этого выпуска.")}</p>` }];
  if (partLesson !== step.lessonId) { part = 0; partLesson = step.lessonId; }
  let index = fragmentAt(parts, step.lessonId, part);
  if (index < 0) {
    if (!avoid.includes(flowKey(step))) { forward(step, true); return; }
    index = 0;
  }
  part = index;
  const piece = parts[index];
  const head = piece.heading ? "" : `<h2>${esc(step.title)}</h2>`;
  const where = piece.heading ? `<p class="mut">${esc(step.title)}</p>` : "";
  stage.innerHTML = `<p class="kicker">Объяснение</p>${where}${head}
    <div class="reading">${piece.html}</div>
    <p class="whole"><a href="episode.html?id=${esc(step.lessonId)}">Весь выпуск</a></p>
    <div class="row"><button type="button" class="btn" id="next">Дальше</button><button type="button" class="btn ghost" id="skip">Пропустить</button></div>`;
  enhanceFigures(stage);
  const move = (skipOne) => {
    $("#next").disabled = true;
    const mark = `theory:${step.lessonId}:${index}`;
    if (skipOne && !avoid.includes(mark)) avoid.push(mark);
    const rest = fragmentAt(parts, step.lessonId, index + 1);
    if (rest >= 0) { part = rest; partLesson = step.lessonId; persist(); void render(step); return; }
    forward(step, false);
  };
  $("#next").onclick = () => move(false);
  $("#skip").onclick = () => move(true);
}

async function showTheory(step, mine) {
  const lesson = lessonOf(step.lessonId);
  let parts = lesson && partsCache.has(lesson.id) ? partsCache.get(lesson.id) : null;
  if (!parts) {
    if (!$("#next")) $("#stage").innerHTML = `<p class="kicker">Объяснение</p><h2>${esc(step.title)}</h2>`;
    parts = await partsOf(lesson);
    if (mine !== token) return;
  }
  paintTheory(step, parts);
}

async function showQuestion(step, mine) {
  if (!bank) bank = await loadTickets();
  if (mine !== token) return;
  const stage = $("#stage");
  const ticket = bank.byId[step.ticketId];
  if (!ticket) {
    stage.innerHTML = `<p>Вопрос этого шага не найден.</p><div class="row"><button type="button" class="btn" id="skip">Дальше</button></div>`;
    $("#skip").onclick = () => forward(step, true);
    return;
  }
  const kicker = step.kind === "review" ? "Повтор ошибки" : (step.again ? "Повторение" : "Дорожная ситуация");
  stage.innerHTML = `<p class="kicker">${kicker}</p>
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

async function render(step) {
  const mine = ++token;
  const stage = $("#stage");
  stage.classList.remove("step");
  void stage.offsetWidth;
  stage.classList.add("step");
  $("#modenote").hidden = modeEl.value !== "review";
  if (!step) { stage.textContent = "Выпусков пока нет."; return; }
  const key = flowKey(step);
  if ((step.done || step.pause) && held !== key) { gate(step, key); return; }
  if (step.kind === "theory") { await showTheory(step, mine); return; }
  await showQuestion(step, mine);
}

modeEl.onchange = () => {
  last = undefined;
  anchor = undefined;
  just = undefined;
  held = null;
  part = 0;
  partLesson = undefined;
  repeat = false;
  st.saveSettings({ flow: modeEl.value, flowRun: { avoid, part: 0, repeat: false } });
  void render(stepNow());
};

void render(stepNow());
