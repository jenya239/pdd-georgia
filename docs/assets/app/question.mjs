/** Renders one exam question (a bank ticket or an own check item) with instant or exam-mode answering. */
import { esc } from "./dom.mjs";
import { loadedTickets } from "./data.mjs";
import { record } from "./progress.mjs";
import { zoom } from "./layout.mjs";
import { figureSvg } from "../domain/figure.mjs";
import { misconceptionFor, questionText } from "../domain/items.mjs";
import { lk, lawDetails } from "../domain/normlinks.mjs";
import { breakdownHtml } from "../domain/breakdown.mjs";

function lawBlock(t) {
  if (!t.law || !t.law.length) return "";
  const { laws } = loadedTickets();
  return t.law.map(k => lawDetails(laws[k])).join("") +
    `<div class="small mut">Текст действующей редакции (25.06.2026, рус. перевод Matsne). Пункт подобран автоматически по ссылке в грузинском пояснении и проверен по совпадению с грузинским текстом закона; подпункт смотрите в пояснении.</div>`;
}

function ownExplanation(t) {
  const q = t.quote, ref = q.n ? `<a class="nref" href="norm/${esc(q.n)}.html" data-norm="${esc(q.n)}">${esc(q.ref)}</a>` : esc(q.ref);
  return `<div class="expl own"><div>${lk(t, "explain")}</div>
    <blockquote class="lawquote"><div class="small mut">${ref} — дословно, рус. перевод Matsne, ред. 25.06.2026</div>«${lk(q, "text")}»</blockquote></div>`;
}

function mcNote(t, choice) {
  const D = loadedTickets(), m = misconceptionFor(t, choice, D.mc, D.ticketDistractors);
  return m ? `<div class="note mc"><b>Типичная ошибка:</b> «${lk(m, "belief")}». <b>Как правильно:</b> ${lk(m, "truth")}.</div>` : "";
}

function explanation(t) {
  if (t.own) return ownExplanation(t);
  return (t.ex ? `<div class="expl"><div class="small mut">Пояснение из базы (только на грузинском):</div><div class="ka" lang="ka">${lk(t, "ex")}</div></div>`
    : `<div class="expl small mut">Пояснения в исходной базе нет.</div>`) + lawBlock(t)
    + (t.br ? breakdownHtml(t.br, loadedTickets().mc) : "");
}

function head(t, opts, tx, toggle) {
  if (t.own) {
    return `${opts.index != null ? `<b>${opts.index + 1}${opts.total ? " / " + opts.total : ""}</b>` : ""}
      <span class="badge own" title="Вопрос составлен нами по тексту закона; в официальной базе билетов его нет">наш вопрос</span><span class="badge grey">${esc(t.typeLabel)}</span>`;
  }
  const topic = loadedTickets().meta.topics[t.t] || "";
  return `${opts.index != null ? `<b>${opts.index + 1}${opts.total ? " / " + opts.total : ""}</b>` : ""}
      <span>Билет № ${t.id}</span><span class="badge grey">${esc(topic)}</span>
      ${tx.untranslated ? `<span class="badge warn" title="В исходной базе этот вопрос не переведён">нет перевода на русский — текст на грузинском</span>` : ""}
      ${toggle ? `<button type="button" class="katoggle" aria-pressed="false" title="Показать грузинский текст вопроса и ответов">оригинал (KA)</button>` : ""}
      ${opts.mode !== "exam" ? `<a class="small" href="${esc(t.src)}" target="_blank" rel="noopener">источник</a>` : ""}`;
}

/**
 * opts: mode "instant" (answer checked at once) | "exam" (choice only), selected, reveal,
 *       onAnswer(idx, ok), index, total, noRecord (the caller records the answer itself)
 * Sets el._pick(i) (keyboard answering) and el._state {answered, choice}.
 */
export function renderQuestion(el, t, opts = {}) {
  const tx = questionText(t), ka = opts.mode !== "exam" ? tx.ka : null;  // no original during a running mock exam
  el.innerHTML = `<div class="q card" data-id="${esc(t.id)}">
    <div class="qhead">${head(t, opts, tx, !!ka)}</div>
    <div class="qtext" lang="${tx.lang}">${esc(tx.q)}</div>
    ${ka ? `<div class="qka" lang="ka" hidden>${esc(ka.q)}</div>` : ""}
    ${t.fig ? `<div class="qfig">${figureSvg(t.fig)}</div>` : ""}
    ${t.img ? `<img class="qimg" src="${esc(t.img)}" alt="Иллюстрация к билету ${esc(t.id)}" loading="lazy">` : ""}
    <div class="answers">${tx.a.map((a, i) => `<button class="ans" data-i="${i}"><span class="k">${i + 1}</span><span>${esc(a)}${ka ? `<span class="aka" lang="ka" hidden>${esc(ka.a[i])}</span>` : ""}</span></button>`).join("")}</div>
    <div class="fb"></div></div>`;
  const tg = el.querySelector(".katoggle");
  if (tg) tg.onclick = () => {
    const on = tg.getAttribute("aria-pressed") !== "true";
    tg.setAttribute("aria-pressed", String(on));
    el.querySelectorAll(".qka, .aka").forEach(x => { x.hidden = !on; });
  };
  const img = el.querySelector(".qimg");
  if (img) img.onclick = () => zoom(img.src);
  const btns = [...el.querySelectorAll(".ans")];
  const state = { answered: false, choice: opts.selected ?? null };
  function reveal(choice) {
    state.answered = true; state.choice = choice;
    btns.forEach((b, i) => { b.disabled = true; if (i === t.c) b.classList.add("ok"); if (i === choice && choice !== t.c) b.classList.add("bad"); });
    const ok = choice === t.c;
    el.querySelector(".fb").innerHTML = `<div class="verdict ${ok ? "ok" : "bad"}">${choice == null ? "Нет ответа." : ok ? "Верно." : "Неверно."} Правильный ответ: ${t.c + 1}.</div>${ok ? "" : mcNote(t, choice)}${explanation(t)}`;
    return ok;
  }
  if (opts.mode === "exam") {
    if (state.choice != null) btns[state.choice].classList.add("sel");
    btns.forEach((b, i) => b.onclick = () => { btns.forEach(x => x.classList.remove("sel")); b.classList.add("sel"); state.choice = i; opts.onAnswer && opts.onAnswer(i, i === t.c); });
  } else if (opts.reveal) {
    reveal(opts.selected ?? null);
  } else {
    btns.forEach((b, i) => b.onclick = () => {
      if (state.answered) return;
      const ok = reveal(i);
      if (!opts.noRecord) record(t.id, ok, i);
      opts.onAnswer && opts.onAnswer(i, ok);
    });
  }
  el._pick = i => { if (i < btns.length && !btns[i].disabled) btns[i].click(); };
  el._state = state;
  return el;
}
