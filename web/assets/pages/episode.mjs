/** Page script: episode.html. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc, nq } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { store, summary } from "../app/progress.mjs";
import { renderQuestion } from "../app/question.mjs";
import { TYPE_LABEL } from "../domain/items.mjs";
import { episodeKind, splitLesson, lessonEditions, pickEdition } from "../domain/episode.mjs";
import { lk, lawDetails } from "../domain/normlinks.mjs";
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
  const isText = episodeKind(r) === "text";
  const editions = lessonEditions(r);
  const chosen = pickEdition(editions, new URLSearchParams(location.search).get("edition") || store.settings().edition);
  const showPlain = !isText && chosen?.id === "plain";
  const lessonHref = isText ? (chosen ? chosen.href : r.lesson) : (showPlain ? chosen.href : null);
  const lesson = lessonHref ? splitLesson(await (await fetch(lessonHref)).text()) : null;
  const editionBar = editions.length > 1
    ? `<div class="editions" role="group" aria-label="Редакция текста">${editions.map(e =>
      `<button type="button" data-edition="${esc(e.id)}" aria-pressed="${e.id === chosen.id}">${esc(e.label)}</button>`).join("")}</div>`
    : "";
  const lawPart = `<h2>Главное</h2>
   <ol class="points">${r.points.map(p => `<li>${lk(p, "t")} <span class="cite">${lk(p, "c")}</span></li>`).join("")}</ol>
   <h3>Текст закона к выпуску</h3>
   <p class="small mut">Цитаты из русского перевода Matsne, ред. 25.06.2026. Юридическую силу имеет грузинский текст.</p>
   ${r.law_quotes.map(q => lawDetails(q)).join("")}`;
  const nav = `<div class="row" style="margin-top:24px">${prev ? `<a class="btn ghost" href="episode.html?id=${prev.id}">← Выпуск ${prev.num}</a>` : ""}${next ? `<a class="btn ghost" href="episode.html?id=${next.id}">Выпуск ${next.num} →</a>` : ""}</div>`;
  const kindLine = `<div class="small mut"><a href="index.html">Выпуски</a> · Выпуск ${r.num} · серии плана ${r.plan.join(", ")} · ${r.duration}${isText ? ` · <span class="badge kind text">текст</span>` : ""}</div>`;
  const film = r.video
    ? `<video controls preload="metadata" poster="${r.poster}" src="${r.video}"></video>
   <p class="small mut">Ролик разбирает те же границы. Ниже — полный текст урока.</p>`
    : "";
  const ticketsFilm = r.tickets_video
    ? `<video controls preload="metadata" poster="${r.poster}" src="${r.tickets_video}"></video>
   <p class="small mut">Ролик по билетам выпуска: ситуация, признак, верный вариант. Под каждым билетом тот же разбор остаётся текстом.</p>`
    : "";
  m.innerHTML = (isText || showPlain)
    ? `${kindLine}<h1>${esc(r.title)}</h1><p class="lead">${lk(r, "lead")}</p>
   ${isText ? film : ""}
   ${editionBar}
   <article class="lesson" id="lb">${lesson.before}</article>
   ${lawPart}
   ${ticketsFilm}
   <h2>Билеты к выпуску</h2>
   <div id="tk"></div>
   <div id="own-items"></div>
   <article class="lesson" id="la">${lesson.after}</article>
   <div id="cum"></div>${nav}`
    : `${kindLine}
   <h1>${esc(r.title)}</h1>
   ${editionBar}
   <video controls preload="metadata" poster="${r.poster}" src="${r.video}"></video>
   <p>${lk(r, "lead")}</p>
   ${lawPart}
   ${ticketsFilm}
   <h2>Билеты к выпуску</h2>
   <div id="tk"></div>
   <div id="own-items"></div>
   <div id="cum"></div>${nav}`;
  const { enhanceFigures } = await import("../app/figzoom.mjs");
  enhanceFigures(m);
  const bar = document.querySelector(".editions");
  if (bar) bar.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-edition]");
    if (!b || b.getAttribute("aria-pressed") === "true") return;
    const ed = editions.find(x => x.id === b.dataset.edition);
    if (!ed) return;
    store.saveSettings({ edition: ed.id });
    const u = new URL(location.href);
    if (ed.id === editions[0].id) u.searchParams.delete("edition");
    else u.searchParams.set("edition", ed.id);
    if (!isText) { location.assign(`${u.pathname}${u.search}${u.hash}`); return; }
    history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
    const parts = splitLesson(await (await fetch(ed.href)).text());
    $("#lb").innerHTML = parts.before;
    $("#la").innerHTML = parts.after;
    bar.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    enhanceFigures(m);
  });
  // накопительная проверка: этот урок + все предыдущие
  const { cumulativeScope, scopeStatus } = await import("../domain/scope.mjs");
  const st = await store, withOwn = st.settings().own !== false;
  const sc = cumulativeScope(E.released, r.id, { own: withOwn }), scopeIds = [...sc.current, ...sc.previous];
  if (scopeIds.length) {
    const active = st.activeRun(r.id), ss = scopeStatus(scopeIds, st.progress());
    $("#cum").innerHTML = `<div class="card cumcard"><h2 style="margin-top:0">Накопительная проверка</h2>
     <p class="small">Все билеты этого урока (${sc.current.length}) и предыдущих уроков (${sc.previous.length})${withOwn ? ", включая наши вопросы," : ""} — ${nq(scopeIds.length)} подряд. Сначала новые, затем прежние вперемешку. Можно прерваться и продолжить позже.</p>
     <p class="small mut" id="cumstat">Решено ${ss.solved} из ${ss.inScope}${ss.errorRate != null ? ` · доля ошибок ${Math.round(100 * ss.errorRate)}%` : ""}</p>
     <div class="row"><a class="btn" id="cumgo" href="check.html?lesson=${r.id}">${active ? "Продолжить проверку" : "Начать проверку"}</a><a class="btn ghost" href="errors.html">Типичные ошибки</a><button type="button" class="btn ghost" id="reset-lesson">Сбросить прогресс выпуска</button></div></div>`;
  } else {
    $("#cum").innerHTML = `<div class="row" style="margin-top:16px"><button type="button" class="btn ghost" id="reset-lesson">Сбросить прогресс выпуска</button></div>`;
  }
  $("#reset-lesson").onclick = () => {
    const ids = [...(r.tickets_lesson || []), ...(r.own_items || [])];
    const ask = `Сбросить прогресс выпуска ${r.num}? Удалятся ответы на ${nq(ids.length)} этого выпуска: в уроке, в накопительной проверке, в самопроверке, в экзамене и в разборе ошибок. Удалится и история накопительных проверок этого выпуска. Заметки сохраняются. Ответы других выпусков сохраняются.`;
    if (!confirm(ask)) return;
    st.resetLesson(r.id, ids);
    location.reload();
  };
  const tk = $("#tk");
  let all = [];
  function section(box, title, note, list) {
    if (!list.length) return;
    const h = document.createElement("div");
    h.innerHTML = `<h3>${esc(title)} (${list.length})</h3>${note ? `<p class="small mut">${note}</p>` : ""}`;
    box.append(h);
    for (const t of list) { const d = document.createElement("div"); d.className = "qwrap"; box.append(d); all.push([d, t]); }
  }
  if (own.length) {
    const box = $("#own-items"), so = summary(own.map(t => t.id));
    const types = [...new Set(own.map(t => t.type))].map(k => TYPE_LABEL[k]).join(", ");
    box.innerHTML = `<h2>Наши вопросы к уроку</h2>
     <p class="small mut">Их нет в официальной базе билетов: мы составили их по тексту закона, который разобран в этом и предыдущих уроках (${esc(types)}). После ответа — пояснение и дословная цитата. Ответы сохраняются в прогресс, в накопительную проверку и в «Типичные ошибки». <span id="ownstat">Решено ${so.seen} из ${so.total}.</span></p>`;
    section(box, "Вопросы урока", "", own);
  }
  if (!core.length && !linked.length) {
    tk.innerHTML = `<div class="note">${esc(r.no_tickets_note || "К этому выпуску в базе нет привязанных билетов.")}</div>`;
  } else {
    const s = summary([...core, ...linked].map(t => t.id));
    tk.innerHTML = `<p class="small mut">Нажмите вариант (или клавиши <kbd>1</kbd>–<kbd>4</kbd> для вопроса в фокусе) — ответ проверяется сразу и сохраняется в прогресс. <span id="tkstat">Решено ${s.seen} из ${s.total}.</span></p>`;
  }
  section(tk, r.core_title || "По статьям, разобранным в выпуске", r.core_note ? lk(r, "core_note") : "Вопросы, в пояснении к которым есть ссылка на пункты, разобранные выше.", core);
  section(tk, r.linked_title || "Привязанные к серии", lk(r, "linked_note"), linked);
  function refreshSolved() {
    const bank = summary([...core, ...linked].map(t => t.id));
    const tkstat = $("#tkstat");
    if (tkstat) tkstat.textContent = `Решено ${bank.seen} из ${bank.total}.`;
    const ownStat = summary(own.map(t => t.id));
    const ownEl = $("#ownstat");
    if (ownEl) ownEl.textContent = `Решено ${ownStat.seen} из ${ownStat.total}.`;
    if (scopeIds.length) {
      const ss = scopeStatus(scopeIds, st.progress());
      const cum = $("#cumstat");
      if (cum) cum.textContent = `Решено ${ss.solved} из ${ss.inScope}${ss.errorRate != null ? ` · доля ошибок ${Math.round(100 * ss.errorRate)}%` : ""}`;
    }
  }
  all.forEach(([d, t]) => renderQuestion(d, t, { mode: "instant", where: "lesson", onAnswer: refreshSolved, onUndo: refreshSolved }));
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
