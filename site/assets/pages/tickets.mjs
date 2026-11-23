/** Page script: tickets.html — every bank ticket and own question, each opening its page. */
import { loadTickets } from "../app/data.mjs";
import { $, esc } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { questionText } from "../domain/items.mjs";
import { excerptQuestion, filterTicketRows, ticketHref, ticketListRows } from "../domain/ticket-page.mjs";

header();
const root = $("#m");

function readQuery() {
  const params = new URLSearchParams(location.search);
  return { q: params.get("q") || "", topic: params.get("topic") || "", lesson: params.get("lesson") || "" };
}

function writeQuery(query) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.topic) params.set("topic", query.topic);
  if (query.lesson) params.set("lesson", query.lesson);
  const text = params.toString();
  history.replaceState(null, "", text ? `?${text}` : location.pathname);
}

try {
  const bank = await loadTickets();
  const faces = [...bank.tickets, ...bank.items].map(ticket => ({
    id: ticket.id, own: !!ticket.own, t: ticket.t, lesson: ticket.lesson, question: questionText(ticket).q,
  }));
  const meta = { topics: bank.meta.topics, lessons: bank.meta.lessons };
  const rows = ticketListRows(faces, meta);
  const topics = Object.entries(bank.meta.topics).sort((a, b) => Number(a[0]) - Number(b[0]));
  const lessons = Object.entries(bank.meta.lessons).sort((a, b) => a[0] < b[0] ? -1 : 1);
  root.innerHTML = `<p class="kicker">Билеты</p>
    <h1>Все билеты</h1>
    <p class="deck">У каждого билета и нашего вопроса своя страница: вопрос, ответ, пояснение, нормы и выпуск. Набор вопросов по-прежнему открывается в самопроверке.</p>
    <form class="ticketfilters" id="filters">
      <label>Поиск <input type="search" id="q" placeholder="номер или слова вопроса" autocomplete="off"></label>
      <label>Тема <select id="topic"><option value="">Все темы</option><option value="own">Наши вопросы</option>${topics.map(([id, name]) => `<option value="${esc(id)}">${esc(id)}. ${esc(name)}</option>`).join("")}</select></label>
      <label>Выпуск <select id="lesson"><option value="">Все выпуски</option><option value="none">Без выпуска</option>${lessons.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("")}</select></label>
    </form>
    <p class="small mut" id="count" aria-live="polite"></p>
    <ul class="ticketlist" id="list"></ul>
    <p class="small"><a href="practice.html">Самопроверка</a> · <a href="exam.html">Экзамен</a></p>`;
  const query = readQuery();
  $("#q").value = query.q;
  $("#topic").value = query.topic;
  $("#lesson").value = query.lesson;
  const paint = () => {
    const next = { q: $("#q").value.trim(), topic: $("#topic").value, lesson: $("#lesson").value };
    writeQuery(next);
    const found = filterTicketRows(rows, next);
    $("#count").textContent = found.length === rows.length ? `${rows.length}` : `${found.length} из ${rows.length}`;
    $("#list").innerHTML = found.length
      ? found.map(row => `<li><a class="ticketrow" href="${esc(ticketHref(row.id))}"><span class="num">${esc(row.label)}</span> <span class="ask">${esc(excerptQuestion(row.question))}</span><span class="small mut">${[row.topic ? `${row.topicId}. ${row.topic}` : (row.own ? "наш вопрос" : ""), row.lesson || "без выпуска"].filter(Boolean).join(" · ")}</span></a></li>`).join("")
      : `<li class="small mut">Ничего не найдено.</li>`;
  };
  $("#filters").onsubmit = event => { event.preventDefault(); paint(); };
  $("#q").oninput = paint;
  $("#topic").onchange = paint;
  $("#lesson").onchange = paint;
  paint();
} catch (error) {
  root.innerHTML = `<h1>Список не загрузился</h1><p>${esc(error.message)}</p>`;
}
