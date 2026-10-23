/** «Разбор»: the written breakdown of a bank ticket (built by tools/pdd/breakdowns.py) — the body of the «Разбор» tab under the answer. */
import { anchor, lk } from "./normlinks.mjs";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);

/** HTML of the breakdown; `mc` maps misconception ids to {belief}. */
export function breakdownHtml(br, mc = {}) {
  const quotes = br.quotes.map(q => `<blockquote class="lawquote"><div class="small mut">${anchor(q.ref, q.n)} — дословно, рус. перевод Matsne, ред. 25.06.2026</div>«${lk(q, "text")}»</blockquote>`).join("");
  const wrong = br.why_not.map(w => {
    const m = w.mc && mc[w.mc];
    return `<li><b>${w.i + 1}.</b> ${lk(w, "t")}${m ? ` <span class="small mut">Типичная ошибка: «${lk(m, "belief")}»</span>` : ""}</li>`;
  }).join("");
  const L = br.lesson;
  return `<div class="br">`
    + `<ol class="steps">${br.steps.map(s => `<li>${lk(s, "t")}</li>`).join("")}</ol>${quotes}`
    + `<div class="small"><b>Почему не:</b></div><ul class="whynot">${wrong}</ul>`
    + (br.trap ? `<div class="note"><b>Ловушка:</b> ${lk(br.trap, "t")}</div>` : "")
    + `<div class="small mut"><a href="episode.html?id=${esc(L.id)}">Выпуск ${esc(L.num)}. ${esc(L.title)}</a> · ${br.concepts.map(esc).join(", ")}</div></div>`;
}
