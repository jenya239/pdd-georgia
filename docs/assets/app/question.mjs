/** Renders one exam question (a bank ticket or an own check item) with instant or exam-mode answering.
 *  After an answer the verdict is followed by the one post-answer panel (./details.mjs); nothing during a running exam. */
import { esc } from "./dom.mjs";
import { loadedTickets } from "./data.mjs";
import { record, store } from "./progress.mjs";
import { zoom } from "./layout.mjs";
import { renderDetails } from "./details.mjs";
import { figureSvg } from "../domain/figure.mjs";
import { questionText } from "../domain/items.mjs";

const noteMark = (t, opts) => (opts.mode === "exam" ? ""
  : `<span class="badge note notemark" title="У этого билета есть ваша заметка (вкладка «Заметка» после ответа)"${store.notes()[t.id] ? "" : " hidden"}>заметка</span>`);

function head(t, opts, tx, toggle) {
  if (t.own) {
    return `${opts.index != null ? `<b>${opts.index + 1}${opts.total ? " / " + opts.total : ""}</b>` : ""}
      <span class="badge own" title="Вопрос составлен нами по тексту закона; в официальной базе билетов его нет">наш вопрос</span><span class="badge grey">${esc(t.typeLabel)}</span>${noteMark(t, opts)}`;
  }
  const topic = loadedTickets().meta.topics[t.t] || "";
  return `${opts.index != null ? `<b>${opts.index + 1}${opts.total ? " / " + opts.total : ""}</b>` : ""}
      <span>Билет № ${t.id}</span><span class="badge grey">${esc(topic)}</span>${noteMark(t, opts)}
      ${tx.mt ? `<span class="badge warn" title="В исходной базе этот вопрос не переведён; русский текст — автоматический перевод с грузинского, оригинал — кнопка «оригинал (KA)»">машинный перевод</span>`
        : tx.untranslated ? `<span class="badge warn" title="В исходной базе этот вопрос не переведён">нет перевода на русский — текст на грузинском</span>` : ""}
      ${toggle ? `<button type="button" class="katoggle" aria-pressed="false" title="Показать грузинский текст вопроса и ответов">оригинал (KA)</button>` : ""}
      ${opts.mode !== "exam" ? `<a class="small" href="${esc(t.src)}" target="_blank" rel="noopener">источник</a>` : ""}`;
}

/**
 * opts: mode "instant" (answer checked at once) | "exam" (choice only), selected, reveal,
 *       onAnswer(idx, ok), index, total, noRecord (the caller records the answer itself),
 *       where — the place the answer is recorded under (progress WHERE: practice, lesson, …; default practice)
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
    el.querySelector(".fb").innerHTML = `<div class="verdict ${ok ? "ok" : "bad"}">${choice == null ? "Нет ответа." : ok ? "Верно." : "Неверно."} Правильный ответ: ${t.c + 1}.</div>`;
    return ok;
  }
  const details = choice => renderDetails(el.querySelector(".fb"), t, choice);
  if (opts.mode === "exam") {
    if (state.choice != null) btns[state.choice].classList.add("sel");
    btns.forEach((b, i) => b.onclick = () => { btns.forEach(x => x.classList.remove("sel")); b.classList.add("sel"); state.choice = i; opts.onAnswer && opts.onAnswer(i, i === t.c); });
  } else if (opts.reveal) {
    reveal(opts.selected ?? null);
    details(opts.selected ?? null);
  } else {
    btns.forEach((b, i) => b.onclick = () => {
      if (state.answered) return;
      const ok = reveal(i);
      if (!opts.noRecord) record(t.id, ok, i, opts.where || "practice");
      opts.onAnswer && opts.onAnswer(i, ok);   // callers with noRecord record synchronously here, before the panel reads history
      details(i);
    });
  }
  el._pick = i => { if (i < btns.length && !btns[i].disabled) btns[i].click(); };
  el._state = state;
  return el;
}
