/** Page script: errors.html. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { record, store } from "../app/progress.mjs";
import { renderQuestion } from "../app/question.mjs";
import { errorStats, groupStats, drillQueue, notedStats } from "../domain/errors.mjs";
import { MASTERY_STREAK } from "../domain/progress.mjs";
import { idLabel, parseId, questionText } from "../domain/items.mjs";
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

function optionText(t, i) { return i == null ? "—" : `${i + 1}. ${questionText(t).a[i] ?? ""}`; }

const ALL = [...D.tickets, ...D.items];

function item(s) {
  const t = D.byId[s.id];
  const picks = Object.entries(s.picks).sort((a, b) => b[1] - a[1]);
  return `<details class="err card" data-id="${s.id}"><summary>
     <span class="errhead"><b>${esc(idLabel(s.id))}</b>${t.own ? ` <span class="badge own">наш вопрос</span>` : ""} <span class="badge ${s.rate >= 0.5 ? "warn" : "grey"}">${s.wrong ? `ошибок ${s.wrong} из ${s.attempts} · ${pct(s.rate)}` : s.attempts ? `без ошибок · ответов ${s.attempts}` : "ответов нет"}</span>${s.noted ? ` <span class="badge note" title="У билета есть ваша заметка">заметка</span>` : ""}
     ${s.mastered ? `<span class="badge ok">исправлено: ${MASTERY_STREAK} верно подряд</span>` : ""}
     <span class="small mut">${s.wrong ? `последняя ошибка ${fmt(s.lastWrong)}` : ""}${s.ruleLabel ? " · " + esc(s.ruleLabel) : ""}</span></span>
     <span class="errq">${esc(questionText(t).q)}</span></summary>
     <div class="errbody">
       ${s.attempts ? `<p class="small"><span class="${s.wrong ? "bad" : "ok"}">Ваш ответ:</span> ${picks.length ? picks.map(([i, n]) => `${esc(optionText(t, +i))}${n > 1 ? ` <span class="mut">(×${n})</span>` : ""}`).join("; ") : esc(optionText(t, s.lastChoice))}<br>
       <span class="ok">Правильный:</span> ${esc(optionText(t, t.c))}</p>` : ""}
       <div class="qwrap"></div></div></details>`;
}

function list() {
  const notes = st.notes(), nNotes = Object.keys(notes).length, onlyNotes = q.get("notes") === "1" && nNotes > 0;
  const errs = errorStats(st.progress(), ALL, notes);
  const stats = onlyNotes ? notedStats(st.progress(), ALL, notes) : errs;
  const by = GROUPS[q.get("by")] ? q.get("by") : "lesson";
  const left = drillQueue(st.progress(), errs.map(s => s.id));
  const notesBtn = nNotes ? `<label class="small notesfilter"><input type="checkbox" id="onlynotes"${onlyNotes ? " checked" : ""}> только билеты с заметками (${nNotes})</label>` : "";
  m.innerHTML = `<h1>Типичные ошибки</h1>
   ${stats.length ? `<p>${onlyNotes ? `Билетов с вашими заметками: ${stats.length} (с ошибками и без).` : `Билетов с ошибками: ${stats.length}; ещё не исправлено (нужно ${MASTERY_STREAK} верных ответа подряд): ${left.length}.`}</p>
   <div class="row">${left.length ? `<a class="btn" href="errors.html?drill=1">Разобрать ошибки (${left.length})</a>` : ""}${notesBtn}</div>
   <div class="seg groupby" role="tablist" style="margin:14px 0">${Object.entries(GROUPS).map(([k, g]) => `<button class="${k === by ? "on" : ""}" data-by="${k}">${g.label}</button>`).join("")}</div>
   <p class="small mut">Порядок: сначала самая высокая доля ошибок, затем — больше повторных ошибок, затем — свежие. Нажмите на билет: ваш и правильный ответ, затем вкладки — пояснение, разбор, нормы, ваша история ответов, типичная ошибка и ваша заметка.</p>
   <div id="list"></div>`
   : `<p>Ошибок пока нет. Они появятся здесь после ответов в <a href="practice.html">самопроверке</a>, <a href="exam.html">экзамене</a> или накопительной проверке.</p>${notesBtn ? `<div class="row">${notesBtn}</div>` : ""}`}`;
  const nb = $("#onlynotes");
  if (nb) nb.onchange = () => { nb.checked ? q.set("notes", "1") : q.delete("notes"); history.replaceState(null, "", "?" + q); list(); };
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
      const r = await record(id, ok, choice, "drill");
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
