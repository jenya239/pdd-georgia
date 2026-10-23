/** Page script: episode.html. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc, nq } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { store, summary } from "../app/progress.mjs";
import { renderQuestion } from "../app/question.mjs";
import { TYPE_LABEL } from "../domain/items.mjs";
(async () => {
  header("eps");
  const [D, E] = await Promise.all([loadTickets(), loadEpisodes()]);
  const id = new URLSearchParams(location.search).get("id") || "ep01";
  const r = E.released.find(x => x.id === id);
  const m = $("#m");
  if (!r) { m.innerHTML = `<h1>Выпуск не найден</h1><p><a href="index.html">К списку выпусков</a></p>`; return; }
  document.title = `Выпуск ${r.num}. ${r.title} — ПДД Грузии`;
  const idx = E.released.indexOf(r), prev = E.released[idx - 1], next = E.released[idx + 1];
  const core = r.tickets_core.map(i => D.byId[i]), linked = r.tickets_linked.map(i => D.byId[i]);
  const own = (r.own_items || []).map(i => D.byId[i]);
  const { episodeKind, splitLesson, ownQuestionVerdict } = await import("../domain/episode.mjs");
  const isText = episodeKind(r) === "text";
  const lesson = isText ? splitLesson(await (await fetch(r.lesson)).text()) : null;
  const lawPart = `<h2>Главное</h2>
   <ol class="points">${r.points.map(p => `<li>${esc(p.t)} <span class="cite">${esc(p.c)}</span></li>`).join("")}</ol>
   <h3>Текст закона к выпуску</h3>
   <p class="small mut">Цитаты из русского перевода Matsne, ред. 25.06.2026. Юридическую силу имеет грузинский текст.</p>
   ${r.law_quotes.map(q => `<details class="law"><summary>${esc(q.ref)}${q.title ? " — " + esc(q.title) : ""}</summary><div class="lawtext">${esc(q.text)}</div></details>`).join("")}`;
  const nav = `<div class="row" style="margin-top:24px">${prev ? `<a class="btn ghost" href="episode.html?id=${prev.id}">← Выпуск ${prev.num}</a>` : ""}${next ? `<a class="btn ghost" href="episode.html?id=${next.id}">Выпуск ${next.num} →</a>` : ""}</div>`;
  const kindLine = `<div class="small mut"><a href="index.html">Выпуски</a> · Выпуск ${r.num} · серии плана ${r.plan.join(", ")} · ${r.duration}${isText ? ` · <span class="badge kind text">текст</span>` : ""}</div>`;
  m.innerHTML = isText
    ? `${kindLine}<h1>${esc(r.title)}</h1><p class="lead">${esc(r.lead)}</p>
   <article class="lesson">${lesson.before}</article>
   ${lawPart}
   <h2>Билеты к выпуску</h2>
   <div id="tk"></div>
   <article class="lesson">${lesson.after}</article>
   <div id="own-items"></div>
   <div id="cum"></div>${nav}`
    : `${kindLine}
   <h1>${esc(r.title)}</h1>
   <video controls preload="metadata" poster="${r.poster}" src="${r.video}"></video>
   <p>${esc(r.lead)}</p>
   ${lawPart}
   <h2>Билеты к выпуску</h2>
   <div id="tk"></div>
   <div id="own-items"></div>
   <div id="cum"></div>${nav}`;
  // свои вопросы урока: проверяются на месте, в прогресс не пишутся
  m.querySelectorAll(".ownq").forEach(q => {
    const bs = [...q.querySelectorAll(".ans")], fb = q.querySelector(".fb");
    bs.forEach((b, i) => b.onclick = () => {
      const v = ownQuestionVerdict(i, q.dataset.ok), okI = Number(q.dataset.ok);
      bs.forEach((x, j) => { x.disabled = true; if (j === okI) x.classList.add("ok"); if (j === i && !v.ok) x.classList.add("bad"); });
      fb.hidden = false; const vd = fb.querySelector(".verdict"); vd.className = "verdict " + (v.ok ? "ok" : "bad"); vd.textContent = `${v.label} Правильный ответ: ${okI + 1}.`;
    });
  });
  // накопительная проверка: этот урок + все предыдущие
  const { cumulativeScope, scopeStatus } = await import("../domain/scope.mjs");
  const st = await store, withOwn = st.settings().own !== false;
  const sc = cumulativeScope(E.released, r.id, { own: withOwn }), scopeIds = [...sc.current, ...sc.previous];
  if (scopeIds.length) {
    const active = st.activeRun(r.id), ss = scopeStatus(scopeIds, st.progress());
    $("#cum").innerHTML = `<div class="card cumcard"><h2 style="margin-top:0">Накопительная проверка</h2>
     <p class="small">Все билеты этого урока (${sc.current.length}) и предыдущих уроков (${sc.previous.length})${withOwn ? ", включая наши вопросы," : ""} — ${nq(scopeIds.length)} подряд. Сначала новые, затем прежние вперемешку. Можно прерваться и продолжить позже.</p>
     <p class="small mut">Решено ${ss.solved} из ${ss.inScope}${ss.errorRate != null ? ` · доля ошибок ${Math.round(100 * ss.errorRate)}%` : ""}</p>
     <div class="row"><a class="btn" id="cumgo" href="check.html?lesson=${r.id}">${active ? "Продолжить проверку" : "Начать проверку"}</a><a class="btn ghost" href="errors.html">Типичные ошибки</a></div></div>`;
  }
  const tk = $("#tk");
  let all = [];
  function section(box, title, note, list) {
    if (!list.length) return;
    const h = document.createElement("div");
    h.innerHTML = `<h3>${esc(title)} (${list.length})</h3>${note ? `<p class="small mut">${esc(note)}</p>` : ""}`;
    box.append(h);
    for (const t of list) { const d = document.createElement("div"); d.className = "qwrap"; box.append(d); all.push([d, t]); }
  }
  if (own.length) {
    const box = $("#own-items"), so = summary(own.map(t => t.id));
    const types = [...new Set(own.map(t => t.type))].map(k => TYPE_LABEL[k]).join(", ");
    box.innerHTML = `<h2>Наши вопросы к уроку</h2>
     <p class="small mut">Их нет в официальной базе билетов: мы составили их по тексту закона, который разобран в этом и предыдущих уроках (${esc(types)}). После ответа — пояснение и дословная цитата. Ответы сохраняются в прогресс, в накопительную проверку и в «Типичные ошибки». Решено ${so.seen} из ${so.total}.</p>`;
    section(box, "Вопросы урока", "", own);
  }
  if (!core.length && !linked.length) {
    tk.innerHTML = `<div class="note">${esc(r.no_tickets_note || "К этому выпуску в базе нет привязанных билетов.")}</div>`;
  } else {
    const s = summary([...core, ...linked].map(t => t.id));
    tk.innerHTML = `<p class="small mut">Нажмите вариант (или клавиши <kbd>1</kbd>–<kbd>4</kbd> для вопроса в фокусе) — ответ проверяется сразу и сохраняется в прогресс. Решено ${s.seen} из ${s.total}.</p>`;
  }
  section(tk, r.core_title || "По статьям, разобранным в выпуске", r.core_note || "Вопросы, в пояснении к которым есть ссылка на пункты, разобранные выше.", core);
  section(tk, r.linked_title || "Привязанные к серии", r.linked_note || "", linked);
  const draw = () => all.forEach(([d, t]) => { const st = d._state; renderQuestion(d, t, st && st.answered ? { mode: "instant", reveal: true, selected: st.choice } : { mode: "instant" }); });
  draw();
  document.addEventListener("pdd:lang", draw);
  // клавиши 1–4: для вопроса, ближайшего к центру экрана и ещё не отвеченного
  document.addEventListener("keydown", e => {
    if (e.target.closest("input,select,textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = parseInt(e.key, 10); if (!(n >= 1 && n <= 4)) return;
    const mid = innerHeight / 2; let best = null, bd = 1e9;
    for (const [d] of all) { const b = d.getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight) continue; if (d._state.answered) continue;
      const dist = Math.abs((b.top + b.bottom) / 2 - mid); if (dist < bd) { bd = dist; best = d; } }
    if (best) best._pick(n - 1);
  });
})();
