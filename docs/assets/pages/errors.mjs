/** Page script: errors.html. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { record, store } from "../app/progress.mjs";
import { renderQuestion } from "../app/question.mjs";
import { errorStats, groupStats, drillQueue } from "../domain/errors.mjs";
import { MASTERY_STREAK } from "../domain/progress.mjs";
import { idLabel, parseId, misconceptionFor } from "../domain/items.mjs";
import { lk } from "../domain/normlinks.mjs";

header("errors");
const [D, E, st] = await Promise.all([loadTickets(), loadEpisodes(), store]);
const m = $("#m");
const q = new URLSearchParams(location.search);
const lessonName = Object.fromEntries(E.released.map(r => [r.id, `Выпуск ${r.num}. ${r.title}`]));
const fmt = ms => (ms ? new Date(ms).toLocaleDateString("ru-RU") : "—");
const pct = x => Math.round(100 * x) + "%";
const GROUPS = {
  rank: { label: "Общий рейтинг", key: null },
  lesson: { label: "По урокам", key: s => s.lesson, name: k => (k ? lessonName[k] || k : "Пока не разобрано ни в одном уроке") },
  topic: { label: "По темам базы", key: s => s.topic, name: k => (k === "own" ? "Наши вопросы (их нет в официальной базе)" : D.meta.topics[k] || `Тема ${k}`) },
  rule: { label: "По правилам", key: s => s.ruleKey, name: (k, g) => (k ? g.items[0].ruleLabel : "Без ссылки на закон в пояснении") },
};

function optionText(t, i) { return i == null ? "—" : `${i + 1}. ${t.a.ru[i] ?? ""}`; }

const ALL = [...D.tickets, ...D.items];

/** Typical errors behind the options this learner picked (distinct, most frequent first). */
function mcLines(t, picks) {
  const seen = new Set();
  return picks.map(([i]) => misconceptionFor(t, +i, D.mc, D.ticketDistractors))
    .filter(m => m && !seen.has(m.id) && seen.add(m.id))
    .map(m => `<div class="note mc"><b>Типичная ошибка:</b> «${lk(m, "belief")}». <b>Как правильно:</b> ${lk(m, "truth")}.</div>`).join("");
}

function item(s) {
  const t = D.byId[s.id];
  const picks = Object.entries(s.picks).sort((a, b) => b[1] - a[1]);
  const mcs = mcLines(t, picks.length ? picks : s.lastChoice != null ? [[String(s.lastChoice), 1]] : []);
  return `<details class="err card" data-id="${s.id}"><summary>
     <span class="errhead"><b>${esc(idLabel(s.id))}</b>${t.own ? ` <span class="badge own">наш вопрос</span>` : ""} <span class="badge ${s.rate >= 0.5 ? "warn" : "grey"}">ошибок ${s.wrong} из ${s.attempts} · ${pct(s.rate)}</span>
     ${s.mastered ? `<span class="badge ok">исправлено: ${MASTERY_STREAK} верно подряд</span>` : ""}
     <span class="small mut">последняя ошибка ${fmt(s.lastWrong)}${s.ruleLabel ? " · " + esc(s.ruleLabel) : ""}</span></span>
     <span class="errq">${esc(t.q.ru)}</span></summary>
     <div class="errbody">
       <p class="small"><span class="bad">Ваш ответ:</span> ${picks.length ? picks.map(([i, n]) => `${esc(optionText(t, +i))}${n > 1 ? ` <span class="mut">(×${n})</span>` : ""}`).join("; ") : esc(optionText(t, s.lastChoice))}<br>
       <span class="ok">Правильный:</span> ${esc(optionText(t, t.c))}</p>
       ${t.why ? `<div class="note why"><b>Почему здесь ошибаются.</b> ${lk(t, "why")}</div>` : ""}
       ${mcs}
       <div class="qwrap"></div></div></details>`;
}

function list() {
  const stats = errorStats(st.progress(), ALL);
  const by = GROUPS[q.get("by")] ? q.get("by") : "lesson";
  const left = drillQueue(st.progress(), stats.map(s => s.id));
  m.innerHTML = `<h1>Типичные ошибки</h1>
   ${stats.length ? `<p>Билетов с ошибками: ${stats.length}; ещё не исправлено (нужно ${MASTERY_STREAK} верных ответа подряд): ${left.length}.</p>
   <div class="row">${left.length ? `<a class="btn" href="errors.html?drill=1">Разобрать ошибки (${left.length})</a>` : ""}</div>
   <div class="seg groupby" role="tablist" style="margin:14px 0">${Object.entries(GROUPS).map(([k, g]) => `<button class="${k === by ? "on" : ""}" data-by="${k}">${g.label}</button>`).join("")}</div>
   <p class="small mut">Порядок: сначала самая высокая доля ошибок, затем — больше повторных ошибок, затем — свежие. Нажмите на билет, чтобы увидеть ваш и правильный ответ, пояснение и текст закона. Заметка «почему ошибаются» есть только там, где её даёт текст урока.</p>
   <div id="list"></div>`
   : `<p>Ошибок пока нет. Они появятся здесь после ответов в <a href="practice.html">самопроверке</a>, <a href="exam.html">экзамене</a> или накопительной проверке.</p>`}`;
  m.querySelectorAll("[data-by]").forEach(b => b.onclick = () => { q.set("by", b.dataset.by); history.replaceState(null, "", "?" + q); list(); });
  const L = $("#list"); if (!L) return;
  const g = GROUPS[by];
  L.innerHTML = g.key
    ? groupStats(stats, g.key).map(gr => `<section class="errgroup"><h3>${esc(g.name(gr.key, gr))} <span class="small mut">— ошибок ${gr.wrong}</span></h3>${gr.items.map(item).join("")}</section>`).join("")
    : stats.map(item).join("");
  L.querySelectorAll("details.err").forEach(d => d.addEventListener("toggle", () => {
    const w = d.querySelector(".qwrap");
    if (d.open && !w.firstChild) { const s = stats.find(x => x.id == d.dataset.id); renderQuestion(w, D.byId[s.id], { mode: "instant", reveal: true, selected: s.lastChoice }); }
  }));
}

function drill() {
  const only = (q.get("ids") || "").split(",").filter(Boolean).map(parseId).filter(id => D.byId[id]);
  const pool = only.length ? only : errorStats(st.progress(), ALL).map(s => s.id);
  let lastId = null, cur = null;
  function step() {
    const left = drillQueue(st.progress(), pool);
    if (!left.length) {
      m.innerHTML = `<h1>Разбор ошибок</h1><div class="result ok">Готово: каждый билет решён верно ${MASTERY_STREAK} раза подряд.</div><div class="row" style="margin-top:12px"><a class="btn ghost" href="errors.html">К списку ошибок</a></div>`;
      return;
    }
    const id = left.find(x => x !== lastId) ?? left[0], t = D.byId[id], k = (st.progress()[id] || {}).k || 0;
    lastId = id;
    m.innerHTML = `<div class="small mut"><a href="errors.html">Типичные ошибки</a> · разбор</div><h1>Разбор ошибок</h1>
     <p class="small">Осталось ${left.length}. Билет уходит из разбора после ${MASTERY_STREAK} верных ответов подряд; у этого сейчас ${k} из ${MASTERY_STREAK}.</p>
     ${t.why ? `<details class="small"><summary>Подсказка из урока</summary><div class="note why">${lk(t, "why")}</div></details>` : ""}
     <div id="q"></div><div class="row" style="margin-top:12px"><button class="btn" id="next" disabled>Дальше</button></div>`;
    cur = $("#q");
    renderQuestion(cur, t, { mode: "instant", noRecord: true, onAnswer: async (choice, ok) => {
      const r = await record(id, ok, choice);
      const fb = cur.querySelector(".fb"), n = document.createElement("p");
      n.className = "small"; n.textContent = ok ? `Серия верных: ${r.k} из ${MASTERY_STREAK}.` : "Ошибка: серия сброшена, билет вернётся позже.";
      fb.prepend(n);
      $("#next").disabled = false; $("#next").focus();
    } });
    $("#next").onclick = step;
  }
  document.addEventListener("keydown", e => {
    if (e.target.closest("input,select,textarea") || e.ctrlKey || e.metaKey || e.altKey || !cur || !cur.isConnected) return;
    const n = parseInt(e.key, 10); if (n >= 1 && n <= 4) cur._pick(n - 1);
  });
  step();
}

q.get("drill") ? drill() : list();
document.addEventListener("pdd:lang", () => { if (!q.get("drill")) list(); });
