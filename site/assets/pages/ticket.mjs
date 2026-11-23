/** Page script: ticket.html?id= — one ticket with its norms, lesson and neighbours. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc, toast } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { renderQuestion } from "../app/question.mjs";
import { questionText } from "../domain/items.mjs";
import { anchor } from "../domain/normlinks.mjs";
import { canonicalTicketId, ticketHref, ticketIndexHref, ticketPageModel } from "../domain/ticket-page.mjs";

header();
const root = $("#m");
const asked = canonicalTicketId(new URLSearchParams(location.search).get("id"));

function face(ticket) {
  return {
    id: ticket.id,
    own: !!ticket.own,
    t: ticket.t,
    lesson: ticket.lesson,
    question: questionText(ticket).q,
    kind: ticket.typeLabel || null,
    nm: ticket.nm,
    cn: ticket.cn,
    rule: ticket.rule,
    ep: ticket.ep,
  };
}

function missing() {
  document.title = "Билет не найден — ПДД Грузии";
  root.innerHTML = `<p class="kicker">Билет</p><h1>Такого билета нет</h1>
    <p class="deck">В курсе нет билета с этим номером. Список открывает все вопросы базы и наши вопросы.</p>
    <p><a class="btn" href="tickets.html">К списку билетов</a></p>`;
}

function step(item, rel, before, after) {
  if (!item) return "";
  return `<a class="btn ghost" href="${esc(ticketHref(item.id))}" rel="${rel}">${before}${esc(item.label)}${after}</a>`;
}

function paint(model, ticket) {
  document.title = `${model.title} — ПДД Грузии`;
  const kicker = model.own ? (model.kind || "Наш вопрос") : (model.topicLabel ? `${model.topicId}. ${model.topicLabel}` : "Билет");
  const bits = [];
  if (model.lessonId) bits.push(`<a href="episode.html?id=${esc(model.lessonId)}">${esc(model.lessonLabel || model.lessonId)}</a>`);
  if (model.ruleLabel) bits.push(esc(model.ruleLabel));
  if (model.topicId) bits.push(`<a href="${esc(ticketIndexHref({ topic: model.topicId }))}">все билеты темы</a>`);
  const shownSeries = model.series.slice(0, 4);
  const extraSeries = model.series.length - shownSeries.length;
  const series = shownSeries.length
    ? `<p class="small mut">Серии плана: ${shownSeries.map(item => esc(item.title === item.code ? item.code : `${item.code} · ${item.title}`)).join("; ")}${extraSeries > 0 ? ` и ещё ${extraSeries}` : ""}</p>`
    : "";
  const lesson = model.lessonId ? `<a class="btn ghost" href="episode.html?id=${esc(model.lessonId)}">К выпуску</a>` : "";
  const prev = step(model.prev, "prev", "← ", "");
  const next = step(model.next, "next", "", " →");
  const top = `<div class="row ticketnav"><button type="button" class="btn ghost js-back">Назад</button><a class="btn ghost" href="tickets.html">Список билетов</a>${lesson}${prev}${next}</div>`;
  const bottom = prev || next ? `<div class="row ticketnav">${prev}${next}</div>` : "";
  const concepts = model.concepts.length
    ? `<section><h2>Понятия</h2><ul>${model.concepts.map(item => `<li>${esc(item.label)}</li>`).join("")}</ul></section>`
    : "";
  const norms = model.norms.length
    ? `<section><h2>Нормы</h2><ul>${model.norms.map(norm => `<li>${anchor(norm.label, norm.slug)}${norm.role === "context" ? ` <span class="small mut">— в пояснении</span>` : ""}</li>`).join("")}</ul></section>`
    : `<section><h2>Нормы</h2><p class="small mut">У этого билета в курсе нет привязанной нормы.</p></section>`;
  const similar = model.similar.length
    ? `<section><h2>Похожие билеты</h2><ul>${model.similar.map(item => `<li><a href="${esc(ticketHref(item.id))}">${esc(item.label)}</a> <span class="small mut">— ${esc(item.why)}</span></li>`).join("")}</ul></section>`
    : "";
  root.innerHTML = `<nav class="crumbs small" aria-label="Навигация"><a href="tickets.html">Билеты</a> › <span>${esc(model.title)}</span></nav>
    <p class="kicker">${esc(kicker)}</p>
    <h1>${esc(model.title)}</h1>
    ${bits.length ? `<p class="deck">${bits.join(" · ")}</p>` : ""}
    ${series}
    ${top}
    <div id="stage"><div id="q"></div>
      <div class="row"><button type="button" class="btn ghost" id="show">Показать ответ</button></div>
    </div>
    <div class="ticketrels">${norms}${concepts}${similar}</div>
    ${bottom}
    <p class="small nperm">Постоянная ссылка: <code>${esc(ticketHref(model.id))}</code> <button class="iconbtn" id="copylink" type="button">Копировать ссылку</button></p>`;
  const show = $("#show");
  const ask = (extra = {}) => renderQuestion($("#q"), ticket, {
    mode: "instant",
    where: "ticket",
    standalone: true,
    onAnswer() { show.hidden = true; },
    onUndo() { show.hidden = false; },
    ...extra,
  });
  ask();
  show.onclick = () => {
    ask({ reveal: true, peek: true, selected: null });
    show.hidden = true;
  };
  for (const button of root.querySelectorAll(".js-back")) button.onclick = () => {
    if (history.length > 1) history.back();
    else location.href = "tickets.html";
  };
  $("#copylink").onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Ссылка скопирована"); }
    catch { toast(location.href); }
  };
  document.addEventListener("keydown", event => {
    if (event.target.closest("input,select,textarea,a,button") || event.ctrlKey || event.metaKey || event.altKey) return;
    const box = $("#q");
    const number = parseInt(event.key, 10);
    if (number >= 1 && number <= 4 && box && box._pick) {
      box._pick(number - 1);
      event.preventDefault();
    }
  });
}

try {
  const [bank, episodes] = await Promise.all([loadTickets(), loadEpisodes()]);
  const tickets = [...bank.tickets, ...bank.items].map(face);
  const model = asked == null ? null : ticketPageModel(asked, tickets, {
    topics: bank.meta.topics,
    concepts: bank.meta.concepts,
    lessons: bank.meta.lessons,
    series: Object.fromEntries(episodes.plan.map(row => [row.e, row.title])),
  });
  if (!model || !bank.byId[model.id]) missing();
  else paint(model, bank.byId[model.id]);
} catch (error) {
  root.innerHTML = `<h1>Билет не загрузился</h1><p>${esc(error.message)}</p><p><a href="tickets.html">К списку билетов</a></p>`;
}
