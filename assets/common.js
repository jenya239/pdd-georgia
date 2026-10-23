/* ПДД Грузии — общий код: данные, прогресс, язык, тема, отрисовка вопроса. */
"use strict";
const PDD = (() => {
  const SCRIPT_URL = document.currentScript.src;
  const LS = { prog: "pddge.progress.v1", lang: "pddge.lang", theme: "pddge.theme" };
  const LANGS = { ru: "RU", ka: "KA", en: "EN" };
  let DATA = null, EPS = null;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const plural = (n, f) => { const m10 = n % 10, m100 = n % 100; return f[(m10 === 1 && m100 !== 11) ? 0 : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 1 : 2]; };
  const nq = n => n + " " + plural(n, ["вопрос", "вопроса", "вопросов"]);

  async function load() {
    if (!DATA) DATA = await (await fetch("data/tickets.json")).json();
    DATA.byId = DATA.byId || Object.fromEntries(DATA.tickets.map(t => [t.id, t]));
    return DATA;
  }
  async function loadEps() { if (!EPS) EPS = await (await fetch("data/episodes.json")).json(); return EPS; }

  // ---------- прогресс ----------
  function prog() { try { return JSON.parse(localStorage.getItem(LS.prog)) || {}; } catch (e) { return {}; } }
  // Правила записи ответа — в чистом модуле assets/lib/progress.mjs, хранение — в assets/lib/store.mjs.
  const STORE = import(new URL("lib/store.mjs", SCRIPT_URL)).then(m => m.createStore(localStorage));
  /** Записать ответ (choice — индекс выбранного варианта, с 0). Возвращает Promise с новой записью. */
  function record(id, ok, choice) { return STORE.then(st => st.recordAnswer(id, { ok: !!ok, choice, now: Date.now() })); }
  function resetProgress() { localStorage.removeItem(LS.prog); }
  function summary(ids) {
    const p = prog(); let seen = 0, ok = 0, bad = 0;
    for (const id of ids) { const r = p[id]; if (!r) continue; seen++; r.l ? ok++ : bad++; }
    return { total: ids.length, seen, ok, bad };
  }

  // ---------- язык / тема ----------
  const getLang = () => localStorage.getItem(LS.lang) || "ru";
  function setLang(l) { localStorage.setItem(LS.lang, l); document.dispatchEvent(new CustomEvent("pdd:lang", { detail: l })); syncHeader(); }
  function applyTheme() {
    const t = localStorage.getItem(LS.theme) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = t; return t;
  }
  applyTheme();

  function header(active) {
    const h = document.createElement("header"); h.className = "top";
    const nav = [["index.html", "Выпуски", "eps"], ["practice.html", "Самопроверка", "practice"], ["exam.html", "Экзамен", "exam"], ["errors.html", "Ошибки", "errors"], ["about.html", "О данных", "about"]];
    h.innerHTML = `<div class="in"><a class="brand" href="index.html">ПДД Грузии <small>· категория B</small></a>
      <nav class="main">${nav.map(([u, t, k]) => `<a href="${u}" class="${k === active ? "on" : ""}">${t}</a>`).join("")}</nav>
      <div class="tools"><span class="seg" id="langseg" title="Язык текста вопросов">${Object.entries(LANGS).map(([k, v]) => `<button data-l="${k}">${v}</button>`).join("")}</span>
      <button class="iconbtn" id="themebtn" title="Светлая / тёмная тема">◐ Тема</button></div></div>`;
    document.body.prepend(h);
    h.querySelectorAll("#langseg button").forEach(b => b.onclick = () => setLang(b.dataset.l));
    $("#themebtn", h).onclick = () => { const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; localStorage.setItem(LS.theme, t); applyTheme(); };
    syncHeader();
    const z = document.createElement("div"); z.className = "zoom"; z.id = "zoom"; z.innerHTML = "<img alt=''>"; z.onclick = () => z.classList.remove("on");
    document.body.append(z);
    const f = document.createElement("footer");
    f.innerHTML = `Учебный черновик. Вопросы, картинки и пояснения — база teoria.on.ge (кат. B/B1, выгрузка 20.10.2026). Закон — Matsne, ред. 25.06.2026; юридическую силу имеет грузинский текст. <a href="about.html">О данных и ограничениях</a>.`;
    document.body.append(f);
  }
  function syncHeader() { document.querySelectorAll("#langseg button").forEach(b => b.classList.toggle("on", b.dataset.l === getLang())); }
  function zoom(src) { const z = $("#zoom"); z.querySelector("img").src = src; z.classList.add("on"); }

  // ---------- вопрос ----------
  function textFor(t, lang) {
    const untr = (t.nu || []).includes(lang);
    return { q: t.q[lang] || t.q.ru, a: t.a[lang] || t.a.ru, untr };
  }
  function lawBlock(t) {
    if (!t.law || !t.law.length) return "";
    return t.law.map(k => { const L = DATA.laws[k]; return `<details class="law"><summary>${esc(L.ref)}${L.title ? " — " + esc(L.title) : ""}</summary><div class="lawtext">${esc(L.text)}</div></details>`; }).join("") +
      `<div class="small mut">Текст действующей редакции (25.06.2026, рус. перевод Matsne). Пункт подобран автоматически по ссылке в грузинском пояснении и проверен по совпадению с грузинским текстом закона; подпункт смотрите в пояснении.</div>`;
  }
  /**
   * Рисует вопрос в контейнер.
   * opts: mode "instant" (сразу показать ответ) | "exam" (только выбор), selected, reveal, onAnswer(idx, ok), index, total, topics
   */
  function renderQuestion(el, t, opts = {}) {
    const lang = getLang(); const tx = textFor(t, lang);
    const topic = DATA.meta.topics[t.t] || "";
    el.innerHTML = `<div class="q card" data-id="${t.id}">
      <div class="qhead">${opts.index != null ? `<b>${opts.index + 1}${opts.total ? " / " + opts.total : ""}</b>` : ""}
        <span>Билет № ${t.id}</span><span class="badge grey">${esc(topic)}</span>
        ${tx.untr ? `<span class="badge warn" title="В исходной базе этот вопрос не переведён">нет перевода на ${LANGS[lang]} — текст на грузинском</span>` : ""}
        ${opts.mode !== "exam" ? `<a class="small" href="${esc(t.src)}" target="_blank" rel="noopener">источник</a>` : ""}</div>
      <div class="qtext" ${tx.untr || lang === "ka" ? 'lang="ka"' : ""}>${esc(tx.q)}</div>
      ${t.img ? `<img class="qimg" src="${esc(t.img)}" alt="Иллюстрация к билету ${t.id}" loading="lazy">` : ""}
      <div class="answers">${tx.a.map((a, i) => `<button class="ans" data-i="${i}"><span class="k">${i + 1}</span><span>${esc(a)}</span></button>`).join("")}</div>
      <div class="fb"></div></div>`;
    const img = el.querySelector(".qimg"); if (img) img.onclick = () => zoom(img.src);
    const btns = [...el.querySelectorAll(".ans")];
    const state = { answered: false, choice: opts.selected ?? null };
    function reveal(choice) {
      state.answered = true; state.choice = choice;
      btns.forEach((b, i) => { b.disabled = true; if (i === t.c) b.classList.add("ok"); if (i === choice && choice !== t.c) b.classList.add("bad"); });
      const ok = choice === t.c;
      const fb = el.querySelector(".fb");
      fb.innerHTML = `<div class="verdict ${ok ? "ok" : "bad"}">${choice == null ? "Нет ответа." : ok ? "Верно." : "Неверно."} Правильный ответ: ${t.c + 1}.</div>
        ${t.ex ? `<div class="expl"><div class="small mut">Пояснение из базы (только на грузинском):</div><div class="ka" lang="ka">${esc(t.ex)}</div></div>`
               : `<div class="expl small mut">Пояснения в исходной базе нет.</div>`}
        ${lawBlock(t)}`;
      return ok;
    }
    if (opts.mode === "exam") {
      if (state.choice != null) btns[state.choice].classList.add("sel");
      btns.forEach((b, i) => b.onclick = () => { btns.forEach(x => x.classList.remove("sel")); b.classList.add("sel"); state.choice = i; opts.onAnswer && opts.onAnswer(i, i === t.c); });
    } else if (opts.reveal) { reveal(opts.selected ?? null); }
    else btns.forEach((b, i) => b.onclick = () => { if (state.answered) return; const ok = reveal(i); if (!opts.noRecord) record(t.id, ok, i); opts.onAnswer && opts.onAnswer(i, ok); });
    el._pick = i => { if (i < btns.length && !btns[i].disabled) btns[i].click(); };
    el._state = state;
    return el;
  }

  return { load, loadEps, header, renderQuestion, record, store: () => STORE, prog, summary, resetProgress, getLang, setLang, esc, $, shuffle, plural, nq, zoom };
})();
