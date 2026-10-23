/** Page script: practice.html. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc, nq, plural } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { progress, resetProgress, summary } from "../app/progress.mjs";
import { renderQuestion } from "../app/question.mjs";
import { shuffle } from "../domain/scope.mjs";
(async () => {
  header("practice");
  const [D, E] = await Promise.all([loadTickets(), loadEpisodes()]);
  const qs = new URLSearchParams(location.search);
  const T = D.meta.topics;
  const epTitle = Object.fromEntries(E.plan.map(p => [p.e, p.title]));
  const epCount = Object.fromEntries(E.plan.map(p => [p.e, p.n]));
  let opts = `<option value="all">Все вопросы (${D.tickets.length})</option><option value="mistakes">Повторить ошибки</option><option value="new">Ещё не решённые</option>`;
  opts += `<optgroup label="Выпуски">${E.released.map(r => `<option value="rel:${r.id}">Выпуск ${r.num}. ${esc(r.title)} (${r.tickets_core.length + r.tickets_linked.length})</option>`).join("")}</optgroup>`;
  opts += `<optgroup label="Темы базы">${Object.entries(T).sort((a, b) => a[0] - b[0]).map(([k, v]) => `<option value="t:${k}">${k}. ${esc(v)} (${D.tickets.filter(t => t.t == k).length})</option>`).join("")}</optgroup>`;
  opts += `<optgroup label="Серии плана">${E.plan.filter(p => p.n).map(p => `<option value="ep:${p.e}">${p.e} · ${esc(p.title)} (${p.n})</option>`).join("")}</optgroup>`;
  $("#set").innerHTML = opts;
  if (qs.get("mode") === "mistakes") $("#set").value = "mistakes";
  if (qs.get("ep")) $("#set").value = "ep:" + qs.get("ep");
  if (qs.get("topic")) $("#set").value = "t:" + qs.get("topic");

  function pool() {
    const v = $("#set").value, p = progress();
    let L = D.tickets;
    if (v === "mistakes") L = L.filter(t => (p[t.id] || {}).l === 0);
    else if (v === "new") L = L.filter(t => !p[t.id]);
    else if (v.startsWith("t:")) L = L.filter(t => t.t == v.slice(2));
    else if (v.startsWith("ep:")) L = L.filter(t => t.ep.includes(v.slice(3)));
    else if (v.startsWith("rel:")) { const r = E.released.find(x => x.id === v.slice(4)); const ids = new Set([...r.tickets_core, ...r.tickets_linked]); L = L.filter(t => ids.has(t.id)); }
    if ($("#onlynew").checked) L = L.filter(t => !p[t.id]);
    if ($("#nountr").checked) L = L.filter(t => !(t.nu || []).includes("ru"));
    return L;
  }
  const upd = () => { const n = pool().length; $("#cnt").textContent = n ? nq(n) : "в этом наборе нет вопросов"; $("#go").disabled = !n; };
  ["#set", "#onlynew", "#nountr"].forEach(s => $(s).onchange = upd); upd();

  let list = [], i = 0, ok = 0, bad = 0, cur = null;
  function show() {
    const t = list[i]; cur = $("#qbox");
    renderQuestion(cur, t, { mode: "instant", index: i, total: list.length, onAnswer: (_, good) => { good ? ok++ : bad++; stat(); $("#next").disabled = false; $("#next").focus(); } });
    $("#next").disabled = true; $("#next").textContent = i + 1 < list.length ? "Дальше →" : "Завершить";
    stat();
  }
  function stat() {
    $("#sess").innerHTML = `<span>Вопрос <b>${Math.min(i + 1, list.length)}</b> из ${list.length}</span><span>Верно <b style="color:var(--ok)">${ok}</b></span><span>Ошибок <b style="color:var(--bad)">${bad}</b></span>`;
    $("#pbar").style.width = (100 * (i + (cur && cur._state && cur._state.answered ? 1 : 0)) / list.length) + "%";
  }
  function finish() {
    $("#qbox").innerHTML = `<div class="card q"><div class="result">Набор пройден: ${ok} верно, ${bad} ${plural(bad, ["ошибка", "ошибки", "ошибок"])}.</div>
      <div class="row" style="margin-top:12px">${bad ? `<a class="btn" href="practice.html?mode=mistakes">Повторить ошибки</a>` : ""}<a class="btn ghost" href="practice.html">Другой набор</a></div></div>`;
    $("#next").disabled = true; drawTopics();
  }
  $("#go").onclick = () => {
    list = pool(); if ($("#order").value === "rnd") list = shuffle(list); else list = list.slice().sort((a, b) => a.id - b.id);
    i = ok = bad = 0; $("#setup").style.display = "none"; $("#run").style.display = ""; show();
  };
  $("#next").onclick = () => { if (i + 1 < list.length) { i++; show(); scrollTo({ top: 0 }); } else finish(); };
  $("#stop").onclick = () => { $("#run").style.display = "none"; $("#setup").style.display = ""; upd(); drawTopics(); };
  document.addEventListener("pdd:lang", () => { if ($("#run").style.display !== "none" && cur && list[i]) { const st = cur._state; renderQuestion(cur, list[i], st.answered ? { mode: "instant", reveal: true, selected: st.choice, index: i, total: list.length } : { mode: "instant", index: i, total: list.length, onAnswer: (_, g) => { g ? ok++ : bad++; stat(); $("#next").disabled = false; } }); } });
  document.addEventListener("keydown", e => {
    if ($("#run").style.display === "none" || e.target.closest("select,input")) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4 && cur && cur._pick) { cur._pick(n - 1); e.preventDefault(); }
    else if ((e.key === "Enter" || e.key === "ArrowRight") && !$("#next").disabled) { e.preventDefault(); $("#next").click(); }
  });
  function drawTopics() {
    const p = progress();
    let h = `<tr><th style="text-align:left">Тема</th><th>Решено</th><th>Верно</th><th>Ошибки</th><th></th></tr>`;
    for (const [k, v] of Object.entries(T).sort((a, b) => a[0] - b[0])) {
      const ids = D.tickets.filter(t => t.t == k).map(t => t.id), s = summary(ids);
      h += `<tr><td>${k}. ${esc(v)}</td><td>${s.seen}/${s.total}</td><td style="color:var(--ok)">${s.ok}</td><td style="color:var(--bad)">${s.bad}</td><td><a href="practice.html?topic=${k}">решать</a></td></tr>`;
    }
    $("#topics").innerHTML = h;
  }
  drawTopics();
  $("#reset").onclick = () => { if (confirm("Удалить весь сохранённый прогресс?")) { resetProgress(); drawTopics(); upd(); } };
})();
