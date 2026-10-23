/** Page script: index.html. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc, nq } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { progress, store, summary } from "../app/progress.mjs";
(async () => {
  header("eps");
  const [D, E] = await Promise.all([loadTickets(), loadEpisodes()]);
  const all = D.tickets.map(t => t.id), s = summary(all);
  const mist = D.tickets.filter(t => (progress()[t.id] || {}).l === 0).length;
  $("#quick").innerHTML = `
   <div class="card"><h3 style="margin-top:0">Самопроверка</h3><p class="small mut">${D.tickets.length} вопросов, по темам и сериям. Прогресс сохраняется в браузере.</p>
     <div class="bar"><i style="width:${(100 * s.seen / s.total).toFixed(1)}%"></i></div><p class="small">Решено ${s.seen} из ${s.total} · верно сейчас ${s.ok} · ошибок ${s.bad}</p>
     <div class="row"><a class="btn" href="practice.html">Тренироваться</a>${mist ? `<a class="btn ghost" href="practice.html?mode=mistakes">Ошибки (${mist})</a>` : ""}</div></div>
   <div class="card"><h3 style="margin-top:0">Пробный экзамен</h3><p class="small mut">30 случайных вопросов, 30 минут, не больше 5 ошибок.</p><a class="btn" href="exam.html">Начать</a></div>`;
  // текущий урок и накопительный статус (этот урок + все предыдущие)
  const [{ currentLesson, cumulativeScope, scopeStatus }, st] = await Promise.all([import("../domain/scope.mjs"), store]);
  const cl = currentLesson(E.released.filter(r => r.tickets_lesson.length));
  if (cl) {
    const sc = cumulativeScope(E.released, cl.id), ss = scopeStatus([...sc.current, ...sc.previous], st.progress()), act = st.activeRun(cl.id);
    const c = document.createElement("div"); c.className = "card cumcard"; c.id = "cumstatus";
    c.innerHTML = `<h3 style="margin-top:0">Текущий урок: выпуск ${cl.num}</h3><p class="small mut">${esc(cl.title)}</p>
     <p class="small">Накопительно (уроки 1–${cl.num}): ${nq(ss.inScope)} · решено ${ss.solved} · верно сейчас ${ss.correctNow}${ss.errorRate != null ? ` · доля ошибок ${Math.round(100 * ss.errorRate)}%` : ""}</p>
     <div class="bar"><i style="width:${ss.inScope ? (100 * ss.solved / ss.inScope).toFixed(1) : 0}%"></i></div>
     <div class="row" style="margin-top:8px"><a class="btn" href="check.html?lesson=${cl.id}">${act ? "Продолжить проверку" : "Накопительная проверка"}</a><a class="btn ghost" href="errors.html">Типичные ошибки</a></div>`;
    $("#quick").prepend(c);
  }
  const rel = new Set(E.released.flatMap(r => r.plan));
  $("#released").innerHTML = E.released.map(r => `<a class="card ep" href="episode.html?id=${r.id}">
     <img src="${r.poster}" alt=""><div><div class="small mut">${r.kind === "text" ? `<span class="badge kind text">текст</span>` : `<span class="badge kind video">видео</span>`} Выпуск ${r.num} · ${r.plan.join("–")} · ${r.duration}</div><h3>${esc(r.title)}</h3>
     <div class="small mut">${esc(r.lead)}</div>
     <div class="small" style="margin-top:4px">${r.tickets_core.length + r.tickets_linked.length ? `Билетов к выпуску: ${r.tickets_core.length + r.tickets_linked.length}` : "Привязанных билетов нет"}</div></div></a>`).join("");
  const BL = {0:"Вступление",1:"Термины (ст. 5)",2:"Участники движения",3:"Светофор и регулировщик",4:"Знаки и разметка",5:"Манёвры, скорость, обгон",6:"Перекрёстки",7:"Остановка и стоянка",8:"Особые места и участники",9:"Буксировка, перевозка",10:"Свет и сигналы",11:"Техсостояние, регистрация",12:"Права, категории, баллы",13:"Штрафы (КоАП)",14:"Вне закона: первая помощь, безопасность, эко"};
  let html = `<tr><th>Серия</th><th>Тема</th><th class="hide-s">Источник</th><th>Билеты</th><th>Статус</th></tr>`, lastB = -1;
  for (const p of E.plan) {
    if (p.block !== lastB) { html += `<tr class="blockhead"><td colspan="5">Блок ${p.block}. ${BL[p.block] || ""}</td></tr>`; lastB = p.block; }
    const r = E.released.find(x => x.plan.includes(p.e));
    html += `<tr class="${r ? "rel" : "soon"}"><td>${p.e}</td><td>${r ? `<a href="episode.html?id=${r.id}">${esc(p.title)}</a>` : esc(p.title)}</td><td class="hide-s">${esc(p.src)}</td>
      <td>${p.n ? `<a href="practice.html?ep=${p.e}">${p.n}</a>` : "0"}</td><td>${r ? `<span class="badge">Выпуск ${r.num}</span>` : `<span class="badge grey">скоро</span>`}</td></tr>`;
  }
  $("#plan").innerHTML = html;
  const { mountProgressFile } = await import("../app/progress-file.mjs");
  mountProgressFile($("#file"), st, { onImport: () => setTimeout(() => location.reload(), 1500) });
})();
