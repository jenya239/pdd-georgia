/** Page script: practice.html. */
import { loadEpisodes, loadTickets } from "../app/data.mjs";
import { $, esc, nq, plural } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { progress, resetProgress, store, summary } from "../app/progress.mjs";
import { renderQuestion } from "../app/question.mjs";
import { shuffle } from "../domain/scope.mjs";
import { parseId, compareIds } from "../domain/items.mjs";
(async () => {
  header("exam");
  const [D, E] = await Promise.all([loadTickets(), loadEpisodes()]);
  const qs = new URLSearchParams(location.search);
  const T = D.meta.topics;
  const epTitle = Object.fromEntries(E.plan.map(p => [p.e, p.title]));
  const epCount = Object.fromEntries(E.plan.map(p => [p.e, p.n]));
  let opts = `<option value="all">Все вопросы (${D.tickets.length})</option><option value="mistakes">Повторить ошибки</option><option value="new">Ещё не решённые</option>`;
  opts += `<optgroup label="Курс">${E.released.map(r => `<option value="rel:${r.id}">Выпуск ${r.num}. ${esc(r.title)} (${r.tickets_core.length + r.tickets_linked.length})</option>`).join("")}</optgroup>`;
  opts += `<optgroup label="Темы базы">${Object.entries(T).sort((a, b) => a[0] - b[0]).map(([k, v]) => `<option value="t:${k}">${k}. ${esc(v)} (${D.tickets.filter(t => t.t == k).length})</option>`).join("")}</optgroup>`;
  opts += `<optgroup label="Серии плана">${E.plan.filter(p => p.n).map(p => `<option value="ep:${p.e}">${p.e} · ${esc(p.title)} (${p.n})</option>`).join("")}</optgroup>`;
  // ?ids=12,o-ep05-02 — the questions a norm page links to («Решить все»)
  const byIds = (qs.get("ids") || "").split(",").filter(Boolean).map(parseId).map(id => D.byId[id]).filter(Boolean);
  if (byIds.length) opts = `<option value="ids">Вопросы по норме (${byIds.length})</option>` + opts;
  $("#set").innerHTML = opts;
  if (qs.get("mode") === "mistakes") $("#set").value = "mistakes";
  if (qs.get("ep")) $("#set").value = "ep:" + qs.get("ep");
  if (qs.get("topic")) $("#set").value = "t:" + qs.get("topic");
  const askedLen = qs.get("len");
  if (askedLen === "10" || askedLen === "15" || askedLen === "30" || askedLen === "all") $("#len").value = askedLen;
  else if (byIds.length) $("#len").value = "all";

  function pool() {
    const v = $("#set").value, p = progress();
    let L = D.tickets;
    if (v === "ids") L = byIds;
    else if (v === "mistakes") L = L.filter(t => (p[t.id] || {}).l === 0);
    else if (v === "new") L = L.filter(t => !p[t.id]);
    else if (v.startsWith("t:")) L = L.filter(t => t.t == v.slice(2));
    else if (v.startsWith("ep:")) L = L.filter(t => t.ep.includes(v.slice(3)));
    else if (v.startsWith("rel:")) { const r = E.released.find(x => x.id === v.slice(4)); const ids = new Set([...r.tickets_core, ...r.tickets_linked]); L = L.filter(t => ids.has(t.id)); }
    if ($("#onlynew").checked) L = L.filter(t => !p[t.id]);
    if ($("#nountr").checked) L = L.filter(t => !(t.nu || []).includes("ru"));
    return L;
  }
  const upd = () => {
    const n = pool().length, cap = $("#len").value === "all" ? n : Math.min(n, Number($("#len").value));
    $("#cnt").textContent = n ? (cap === n ? nq(n) : `${cap} из ${n}`) : "в этом наборе нет вопросов";
    $("#go").disabled = !n;
  };
  ["#set", "#len", "#onlynew", "#nountr"].forEach(s => $(s).onchange = upd); upd();

  let list = [], i = 0, ok = 0, bad = 0, held = false, cur = null;
  const lastChoice = id => { const ev = (progress()[id]?.events || []); return ev.length ? ev[ev.length - 1].c : null; };
  function persist() { store.saveSession({ ids: list.map(t => t.id), i, ok, bad, held }); }
  function show() {
    const t = list[i]; cur = $("#qbox");
    renderQuestion(cur, t, { mode: "instant", index: i, total: list.length, reveal: held, selected: held ? lastChoice(t.id) : null,
      onAnswer: (_, good) => { good ? ok++ : bad++; held = true; persist(); stat(); $("#next").disabled = false; $("#next").focus(); },
      onUndo: (undone, info) => {
        if (info.session) { if (undone.ok) ok--; else bad--; held = false; persist(); }
        stat();
        $("#next").disabled = true;
      } });
    $("#next").disabled = !held; $("#next").textContent = i + 1 < list.length ? "Дальше →" : "Завершить";
    stat();
  }
  function stat() {
    $("#sess").innerHTML = `<span>Вопрос <b>${Math.min(i + 1, list.length)}</b> из ${list.length}</span><span>Верно <b style="color:var(--ok)">${ok}</b></span><span>Ошибок <b style="color:var(--bad)">${bad}</b></span>`;
    $("#pbar").style.width = (100 * (i + (cur && cur._state && cur._state.answered ? 1 : 0)) / list.length) + "%";
  }
  function openRun() { $("#setup").style.display = "none"; $("#run").style.display = ""; show(); }
  function finish() {
    store.clearSession(); paintResume();
    $("#qbox").innerHTML = `<div class="card q"><div class="result">Набор пройден: ${ok} верно, ${bad} ${plural(bad, ["ошибка", "ошибки", "ошибок"])}.</div>
      <div class="row" style="margin-top:12px">${bad ? `<a class="btn" href="practice.html?mode=mistakes">Повторить ошибки</a>` : ""}<a class="btn ghost" href="practice.html">Другой набор</a></div></div>`;
    $("#next").disabled = true; drawTopics();
  }
  function paintResume() {
    const s = store.session();
    $("#resume").hidden = !s;
    if (s) $("#resume").textContent = `Продолжить занятие (${Math.min(s.i + 1, s.ids.length)} из ${s.ids.length})`;
  }
  $("#go").onclick = () => {
    list = pool(); if ($("#order").value === "rnd") list = shuffle(list); else list = list.slice().sort((a, b) => compareIds(a.id, b.id));
    if ($("#len").value !== "all") list = list.slice(0, Number($("#len").value));
    i = ok = bad = 0; held = false; persist(); openRun();
  };
  $("#resume").onclick = () => {
    const s = store.session(); if (!s) return;
    const next = s.ids.map(id => D.byId[id]).filter(Boolean);
    if (next.length !== s.ids.length) { store.clearSession(); paintResume(); return; }
    list = next; i = s.i; ok = s.ok; bad = s.bad; held = s.held; openRun();
  };
  if (qs.get("start") === "1" && byIds.length) $("#go").click();
  $("#next").onclick = () => { if (i + 1 < list.length) { i++; held = false; persist(); show(); scrollTo({ top: 0 }); } else finish(); };
  $("#stop").onclick = () => {
    const left = list.length - i - (held ? 1 : 0);
    if (left > 0 && !confirm("Завершить занятие? Неотвеченные вопросы этого набора не сохранятся.")) return;
    store.clearSession(); paintResume(); $("#run").style.display = "none"; $("#setup").style.display = ""; upd(); drawTopics();
  };
  document.addEventListener("keydown", e => {
    if ($("#run").style.display === "none" || e.target.closest("select,input,textarea,[data-undo]")) return;
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
  $("#reset").onclick = () => { if (confirm("Удалить весь сохранённый прогресс?")) { resetProgress(); store.clearSession(); paintResume(); drawTopics(); upd(); } };
  paintResume();
})();
