/** Page script: exam.html. */
import { loadTickets } from "../app/data.mjs";
import { $, plural } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { record, store } from "../app/progress.mjs";
import { renderQuestion } from "../app/question.mjs";
import { shuffle } from "../domain/scope.mjs";
(async () => {
  header("exam");
  const D = await loadTickets();
  const N = 30, LIMIT = 30 * 60, MAXERR = 5;
  let qs = [], ans = [], i = 0, t0 = 0, timer = null, done = false;
  const hist = () => store.exams();
  function drawHist() {
    const h = hist().slice(-10).reverse();
    $("#hist").innerHTML = h.length ? `<h2>Последние попытки</h2><div class="card" style="padding:6px 10px"><table class="topics">${h.map(x => `<tr><td>${new Date(x.d).toLocaleString("ru-RU")}</td><td>${x.ok}/30</td><td>${x.pass ? "<span style='color:var(--ok)'>сдан</span>" : "<span style='color:var(--bad)'>не сдан</span>"}</td><td>${Math.floor(x.s / 60)} мин ${x.s % 60} с</td></tr>`).join("")}</table></div>` : "";
  }
  drawHist();
  function start() {
    let pool = D.tickets; if ($("#nountr").checked) pool = pool.filter(t => !(t.nu || []).includes("ru"));
    qs = shuffle(pool).slice(0, N); ans = Array(N).fill(null); i = 0; done = false; t0 = Date.now();
    $("#setup").style.display = "none"; $("#res").style.display = "none"; $("#run").style.display = "";
    $("#grid").innerHTML = qs.map((_, k) => `<button data-k="${k}">${k + 1}</button>`).join("");
    $("#grid").querySelectorAll("button").forEach(b => b.onclick = () => go(+b.dataset.k));
    timer = setInterval(tick, 500); tick(); go(0);
  }
  function tick() {
    const left = Math.max(0, LIMIT - Math.floor((Date.now() - t0) / 1000));
    $("#timer").textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
    $("#timer").classList.toggle("low", left < 300);
    if (left <= 0) finish(true);
  }
  function go(k) {
    i = Math.max(0, Math.min(N - 1, k));
    renderQuestion($("#qbox"), qs[i], { mode: "exam", index: i, total: N, selected: ans[i], onAnswer: a => { ans[i] = a; grid(); } });
    grid(); $("#prev").disabled = i === 0; $("#next").textContent = i < N - 1 ? "Дальше →" : "К первому без ответа";
  }
  function grid() {
    $("#grid").querySelectorAll("button").forEach((b, k) => { b.classList.toggle("done", ans[k] != null); b.classList.toggle("cur", k === i); });
    const n = ans.filter(a => a != null).length; $("#answered").textContent = `Отвечено ${n} из ${N}`;
  }
  function nextUnanswered() { for (let s = 1; s <= N; s++) { const k = (i + s) % N; if (ans[k] == null) return k; } return -1; }
  $("#next").onclick = () => { if (i < N - 1) go(i + 1); else { const k = nextUnanswered(); if (k >= 0) go(k); } };
  $("#prev").onclick = () => go(i - 1);
  $("#finish").onclick = () => { const left = ans.filter(a => a == null).length; if (!left || confirm(`Без ответа ${left} — завершить экзамен?`)) finish(false); };
  $("#start").onclick = start;
  document.addEventListener("keydown", e => {
    if ($("#run").style.display === "none" || e.target.closest("select,input")) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) { $("#qbox")._pick(n - 1); e.preventDefault(); }
    else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); $("#next").click(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
  });
  function finish(timeout) {
    if (done) return; done = true; clearInterval(timer);
    const secs = Math.min(LIMIT, Math.round((Date.now() - t0) / 1000));
    const res = qs.map((t, k) => ({ t, a: ans[k], ok: ans[k] === t.c }));
    const ok = res.filter(r => r.ok).length, err = N - ok;
    res.forEach(r => { if (r.a != null) record(r.t.id, r.ok, r.a); });
    store.addExam({ d: Date.now(), ok, pass: err <= MAXERR, s: secs });
    $("#run").style.display = "none"; const R = $("#res"); R.style.display = "";
    const unans = ans.filter(a => a == null).length;
    R.innerHTML = `<div class="card"><div class="result ${err <= MAXERR ? "ok" : "bad"}">${err <= MAXERR ? "Экзамен сдан" : "Экзамен не сдан"}: ${ok} из ${N} верно, ${err} ${plural(err, ["ошибка", "ошибки", "ошибок"])}</div>
      <p class="small mut">${timeout ? "Время вышло. " : ""}Время: ${Math.floor(secs / 60)} мин ${secs % 60} с. Без ответа: ${unans}. Критерий: не больше ${MAXERR} ошибок (25/30). При пороге 27/30 (не больше 3 ошибок) результат был бы: ${err <= 3 ? "сдан" : "не сдан"}.</p>
      <div class="exgrid" style="margin:10px 0">${res.map((r, k) => `<button class="${r.ok ? "ok" : "bad"}" data-k="${k}">${k + 1}</button>`).join("")}</div>
      <div class="row"><button class="btn" id="again">Новый экзамен</button>${err ? `<a class="btn ghost" href="practice.html?mode=mistakes">Тренировать ошибки</a>` : ""}</div></div>
      <h2>${err ? "Разбор ошибок" : "Ошибок нет"}</h2><div id="rev"></div>`;
    const rev = $("#rev");
    res.forEach((r, k) => { if (r.ok) return; const d = document.createElement("div"); d.id = "r" + k; rev.append(d); renderQuestion(d, r.t, { mode: "instant", reveal: true, selected: r.a, index: k, total: N }); });
    R.querySelectorAll(".exgrid button").forEach(b => b.onclick = () => { const el = document.getElementById("r" + b.dataset.k); if (el) el.scrollIntoView({ behavior: "smooth" }); });
    $("#again").onclick = () => { R.style.display = "none"; $("#setup").style.display = ""; drawHist(); scrollTo({ top: 0 }); };
    scrollTo({ top: 0 });
  }
})();
