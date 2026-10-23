/** Page script: check.html. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc, nq } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { record, store } from "../app/progress.mjs";
import { renderQuestion } from "../app/question.mjs";
import { currentLesson, cumulativeScope, cumulativeOrder, scopeStatus } from "../domain/scope.mjs";
import { idLabel, isOwnId } from "../domain/items.mjs";
import { startRun, answerRun, nextTicket, isFinished, runResult, lessonTrend, answeredCount } from "../domain/run.mjs";

header("eps");
const [D, E, st] = await Promise.all([loadTickets(), loadEpisodes(), store]);
const m = $("#m");
const lessonId = new URLSearchParams(location.search).get("lesson") || (currentLesson(E.released) || {}).id;
const L = E.released.find(x => x.id === lessonId);
if (!L) { m.innerHTML = `<h1>Урок не найден</h1><p><a href="index.html">К списку выпусков</a></p>`; throw new Error("unknown lesson"); }
document.title = `Накопительная проверка: выпуск ${L.num} — ПДД Грузии`;
let scope, allIds;
const rescope = () => { scope = cumulativeScope(E.released, L.id, { own: st.settings().own !== false }); allIds = [...scope.current, ...scope.previous]; };
rescope();
const ownCount = ids => ids.filter(isOwnId).length;
const fmt = ms => new Date(ms).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function trendHtml() {
  const tr = lessonTrend(st.runs(), L.id);
  if (!tr.length) return `<p class="small mut">Завершённых проверок пока нет.</p>`;
  return `<div class="card" style="padding:0;overflow:auto"><table class="plan trend"><tr><th>Дата</th><th>Результат</th><th>Верно</th><th>Ошибки (билеты)</th></tr>
    ${tr.map(r => `<tr><td>${fmt(r.date)}</td><td><b>${r.score}%</b></td><td>${r.correct} из ${r.total}</td><td class="small">${r.wrong.length ? r.wrong.map(i => esc(idLabel(i))).join(", ") : "—"}</td></tr>`).join("")}</table></div>`;
}

function intro() {
  const active = st.activeRun(L.id), ss = scopeStatus(allIds, st.progress()), order = st.settings().order, own = st.settings().own !== false;
  m.innerHTML = `<div class="small mut"><a href="episode.html?id=${L.id}">Выпуск ${L.num}</a> · накопительная проверка</div>
   <h1>Накопительная проверка после выпуска ${L.num}</h1>
   <p>Все билеты этого урока (${scope.current.length}) и всех предыдущих (${scope.previous.length}) — всего ${nq(allIds.length)}${own ? `, из них наших вопросов ${ownCount(allIds)}` : ""}. Решаются все подряд; ответы сохраняются в прогресс и в «Типичные ошибки». Можно закрыть страницу и продолжить позже.</p>
   <p class="small mut">По этим билетам: решено ${ss.solved} из ${ss.inScope}${ss.errorRate != null ? ` · доля ошибок за всё время ${Math.round(100 * ss.errorRate)}%` : ""}.</p>
   ${allIds.length ? `<div class="card"><fieldset class="order"><legend class="small mut">Порядок вопросов (для новой проверки)</legend>
     <label><input type="radio" name="order" value="new-first" ${order !== "mixed" ? "checked" : ""}> Сначала новые билеты, затем прежние вперемешку</label>
     <label><input type="radio" name="order" value="mixed" ${order === "mixed" ? "checked" : ""}> Всё вперемешку</label></fieldset>
     <label class="ownopt"><input type="checkbox" id="ownopt" ${own ? "checked" : ""}> Включать наши вопросы (помечены «наш вопрос»; их нет в официальной базе)</label>
     <div class="row" style="margin-top:10px">${active ? `<button class="btn" id="resume">Продолжить: ${answeredCount(active)} из ${active.ids.length}</button><button class="btn ghost" id="restart">Начать заново</button>` : `<button class="btn" id="start">Начать проверку</button>`}</div></div>`
   : `<div class="note">У этого и предыдущих уроков нет билетов${own ? "" : " (наши вопросы выключены)"}.</div>
     <label class="ownopt"><input type="checkbox" id="ownopt" ${own ? "checked" : ""}> Включать наши вопросы (помечены «наш вопрос»; их нет в официальной базе)</label>`}
   <h2>Динамика</h2>${trendHtml()}`;
  m.querySelectorAll("input[name=order]").forEach(i => i.onchange = () => st.saveSettings({ order: i.value }));
  if ($("#ownopt")) $("#ownopt").onchange = e => { st.saveSettings({ own: e.target.checked }); rescope(); intro(); };
  const begin = () => {
    const run = startRun({ id: `${L.id}-${Date.now()}`, lesson: L.id, ids: cumulativeOrder(scope, { order: st.settings().order }), order: st.settings().order, now: Date.now() });
    st.saveActiveRun(run); play(run);
  };
  if ($("#start")) $("#start").onclick = begin;
  if ($("#restart")) $("#restart").onclick = () => { if (confirm("Начать заново? Текущая незавершённая проверка будет сброшена (ответы в прогрессе останутся).")) begin(); };
  if ($("#resume")) $("#resume").onclick = () => play(st.activeRun(L.id));
}

let cur = null;
function play(run) {
  if (isFinished(run)) return finish(run);
  const id = nextTicket(run), t = D.byId[id], done = answeredCount(run);
  m.innerHTML = `<div class="small mut"><a href="check.html?lesson=${L.id}">Накопительная проверка · выпуск ${L.num}</a></div>
   <div class="bar" style="margin:10px 0"><i style="width:${(100 * done / run.ids.length).toFixed(1)}%"></i></div>
   <p class="small">${done + 1} из ${run.ids.length}${(t.own ? t.lesson === L.id : scope.current.includes(id)) ? ` · <span class="badge">новый урок</span>` : ` · <span class="badge grey">прежние уроки</span>`}${t.own ? ` · <span class="badge own">наш вопрос</span>` : ""}</p>
   <div id="q"></div><div class="row" style="margin-top:12px"><button class="btn" id="next" disabled>Дальше</button></div>`;
  cur = $("#q");
  renderQuestion(cur, t, { mode: "instant", noRecord: true, onAnswer: async (choice, ok) => {
    run = answerRun(run, id, { choice, ok });
    st.saveActiveRun(run);
    await record(id, ok, choice, "check");
    $("#next").disabled = false; $("#next").focus();
  } });
  $("#next").onclick = () => play(run);
}

function finish(run) {
  const res = runResult(run, Date.now());
  st.finishRun(L.id, res);
  m.innerHTML = `<div class="small mut"><a href="episode.html?id=${L.id}">Выпуск ${L.num}</a> · накопительная проверка</div>
   <h1>Проверка завершена</h1>
   <div class="result ${res.wrong.length ? "bad" : "ok"}">${res.correct} из ${res.total} верно (${res.score}%)</div>
   ${res.wrong.length ? `<p>Ошибки: ${res.wrong.map(i => esc(idLabel(i))).join(", ")}.</p><div class="row"><a class="btn" href="errors.html?drill=1&ids=${res.wrong.join(",")}">Разобрать ошибки</a><a class="btn ghost" href="errors.html">Типичные ошибки</a></div>` : `<p>Без ошибок.</p>`}
   <h2>Динамика</h2>${trendHtml()}
   <div class="row" style="margin-top:16px"><a class="btn ghost" href="check.html?lesson=${L.id}">Пройти ещё раз</a></div>`;
}

document.addEventListener("keydown", e => {
  if (e.target.closest("input,select,textarea") || e.ctrlKey || e.metaKey || e.altKey || !cur || !cur.isConnected) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 4) cur._pick(n - 1);
  else if (e.key === "Enter" && e.target.tagName !== "BUTTON" && $("#next") && !$("#next").disabled) $("#next").click();
});
intro();
