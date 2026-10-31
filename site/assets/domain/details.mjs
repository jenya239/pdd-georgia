/**
 * The one post-answer panel of every ticket view (practice, lesson, cumulative check, errors + drill, exam review;
 * own items get the tabs that apply). Pure: ticketDetails() builds the view model, detailsHtml() renders it;
 * web/assets/app/details.mjs only wires it (tab switching, the note, lazy norm texts).
 *
 * Tabs, always in this order, empty ones hidden (the note is always there):
 *   ex     Пояснение        bank: Russian machine translation + Georgian original; own item: our explanation
 *   br     Разбор           our written breakdown (bank tickets that have one)
 *   norms  Нормы            checked + context norms (permalinks, verbatim text loaded lazily), quotes, concepts, lesson
 *   hist   Моя история      the learner's attempts on this ticket, streak / mastery, error rate
 *   mc     Типичная ошибка  misconceptions behind the chosen (and earlier picked) wrong options + the lesson's note
 *   note   Заметка          the learner's own note
 */
import { misconceptionFor } from "./items.mjs";
import { anchor, lk, lawDetails } from "./normlinks.mjs";
import { breakdownHtml } from "./breakdown.mjs";
import { baseExplanationHtml } from "./explanation.mjs";
import { MASTERY_STREAK, WHERE, isMastered } from "./progress.mjs";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);

export const TAB_ORDER = ["ex", "br", "norms", "hist", "mc", "note"];
const LABEL = { ex: "Пояснение", br: "Разбор", norms: "Нормы", hist: "Моя история", mc: "Типичная ошибка", note: "Заметка" };

const refs = list => (list || []).map(([slug, label]) => ({ slug, label }));

function exTab(t) {
  if (t.own) return t.explain ? { own: t.explain } : null;
  return t.ex ? { ru: t.ex_ru || null, ka: t.ex, mt: !!t.ex_ru } : null;
}

function normsTab(t, ont) {
  const tab = {
    main: refs(t.nm?.m), context: refs(t.nm?.x),
    quotes: (t.law || []).map(k => (ont.laws || {})[k]).filter(Boolean),
    ownQuote: t.own && t.quote ? t.quote : null,
    concepts: (t.cn || []).map(c => (ont.concepts || {})[c]).filter(Boolean),
    lesson: t.lesson && (ont.lessons || {})[t.lesson] ? { id: t.lesson, name: ont.lessons[t.lesson] } : null,
  };
  return tab.main.length || tab.context.length || tab.quotes.length || tab.ownQuote || tab.concepts.length || tab.lesson ? tab : null;
}

function histTab(rec) {
  if (!rec || !rec.s) return null;
  const h = rec.h || [];
  const known = h.length, knownWrong = h.filter(a => !a.ok).length;
  return {
    attempts: [...h].reverse().map(a => ({ t: a.t, c: a.c, ok: !!a.ok, where: WHERE[a.w] || null })),
    earlier: rec.s > known ? { s: rec.s - known, w: Math.max(0, rec.w - knownWrong) } : null,
    s: rec.s, w: rec.w, rate: rec.w / rec.s, k: rec.k || 0, mastered: isMastered(rec), need: MASTERY_STREAK,
  };
}

function mcTab(t, choice, rec, ont) {
  const picked = Object.entries(rec?.p || {}).sort((a, b) => b[1] - a[1]).map(([i]) => +i);
  const seen = new Set(), items = [];
  for (const i of [choice, ...picked]) {
    const m = misconceptionFor(t, i, ont.mc, ont.ticketDistractors);
    if (m && !seen.has(m.id)) { seen.add(m.id); items.push({ ...m, current: i === choice }); }
  }
  return items.length || t.why ? { items, why: t.why || null } : null;
}

/** View model of the panel: { id, tabs: [{id, label, …data}] }. state = { choice, record, note }. */
export function ticketDetails(t, state = {}, ont = {}) {
  const { choice = null, record = null, note = "" } = state;
  const data = {
    ex: exTab(t),
    br: !t.own && t.br ? { br: t.br } : null,
    norms: normsTab(t, ont),
    hist: histTab(record),
    mc: mcTab(t, choice, record, ont),
    note: { text: note || "" },
  };
  return { id: t.id, t, ont, tabs: TAB_ORDER.filter(id => data[id]).map(id => ({ id, label: LABEL[id], ...data[id] })) };
}

/** The tab to open: the one the learner opened last if this ticket has it, otherwise the first. */
export const pickTab = (vm, remembered) => (vm.tabs.some(t => t.id === remembered) ? remembered : vm.tabs[0]?.id);

const when = ms => new Date(ms).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const pct = x => Math.round(100 * x) + "%";
const QUOTE_NOTE = "дословно, рус. перевод Matsne, ред. 25.06.2026";

function normList(title, list, cls) {
  if (!list.length) return "";
  return `<div class="small mut">${title}</div><ul class="dnorms ${cls}">${list.map(n =>
    `<li>${anchor(n.label, n.slug)}<div class="lawtext dntext" data-load="${esc(n.slug)}"></div></li>`).join("")}</ul>`;
}

const BODY = {
  ex: (tab, vm) => (tab.own != null ? `<div class="expl own">${lk(vm.t, "explain")}</div>` : baseExplanationHtml(vm.t)),
  br: (tab, vm) => breakdownHtml(tab.br, vm.ont.mc || {}),
  norms: tab => normList("Что проверяет билет — текст нормы дословно (рус. перевод Matsne, ред. 25.06.2026):", tab.main, "main")
    + normList("Упомянуты в пояснении, но для ответа не нужны:", tab.context, "ctx")
    + (tab.ownQuote ? `<blockquote class="lawquote"><div class="small mut">${tab.ownQuote.n ? anchor(tab.ownQuote.ref, tab.ownQuote.n) : esc(tab.ownQuote.ref)} — ${QUOTE_NOTE}</div>«${lk(tab.ownQuote, "text")}»</blockquote>` : "")
    + (tab.quotes.length ? `<div class="small mut">Пункт целиком (подобран по ссылке в грузинском пояснении):</div>${tab.quotes.map(q => lawDetails(q)).join("")}` : "")
    + (tab.concepts.length ? `<p class="small"><b>Понятия курса:</b> ${tab.concepts.map(esc).join("; ")}</p>` : "")
    + (tab.lesson ? `<p class="small"><b>Урок:</b> <a href="episode.html?id=${esc(tab.lesson.id)}">${esc(tab.lesson.name)}</a></p>` : ""),
  hist: tab => `<p class="small">Ответов ${tab.s}, ошибок ${tab.w} (${pct(tab.rate)}). Серия верных подряд: ${tab.k}${tab.mastered
      ? ` — <span class="badge ok">освоено</span>` : ` из ${tab.need} для освоения`}.</p>`
    + (tab.attempts.length ? `<ol class="dhist">${tab.attempts.map(a => `<li class="${a.ok ? "ok" : "bad"}"><span class="dh-t">${esc(when(a.t))}</span>
        <span class="dh-c">${a.c == null ? "—" : "вариант " + (a.c + 1)}</span><span class="dh-v">${a.ok ? "верно" : "неверно"}</span>
        <span class="dh-w mut">${esc(a.where || "")}</span></li>`).join("")}</ol>` : "")
    + (tab.earlier ? `<p class="small mut">Ещё ${tab.earlier.s} ${tab.attempts.length ? "более ранних " : ""}ответов (ошибок ${tab.earlier.w}) учтены только в счётчиках — это ответы, данные до появления подробной истории.</p>` : ""),
  mc: (tab, vm) => tab.items.map(m => `<div class="note mc${m.current ? " cur" : ""}">${m.current ? "" : `<span class="small mut">Раньше вы выбирали вариант с такой ошибкой. </span>`}<b>Типичная ошибка:</b> «${lk(m, "belief")}». <b>Как правильно:</b> ${lk(m, "truth")}.</div>`).join("")
    + (tab.why ? `<div class="note why"><b>Почему здесь ошибаются.</b> ${lk(vm.t, "why")}</div>` : ""),
  note: (tab, vm, pid) => `<label class="small mut" for="${pid}-note">Ваша заметка к билету — хранится в этом браузере и в файле прогресса.</label>
    <textarea id="${pid}-note" class="dnote" rows="3" maxlength="4000">${esc(tab.text)}</textarea>
    <div class="row"><button type="button" class="btn ghost" data-save>Сохранить заметку</button><span class="small mut" data-status aria-live="polite"></span></div>`,
};

/** HTML of the panel; `active` = tab id to show, `pid` = unique id prefix on the page. */
export function detailsHtml(vm, active, pid) {
  const cur = pickTab(vm, active);
  const strip = vm.tabs.map(tab => `<button type="button" role="tab" data-tab="${tab.id}" id="${pid}-tab-${tab.id}" aria-selected="${tab.id === cur}" aria-controls="${pid}-p-${tab.id}" tabindex="${tab.id === cur ? 0 : -1}">${tab.label}${tab.id === "note" && tab.text ? " •" : ""}</button>`).join("");
  const panels = vm.tabs.map(tab => `<div role="tabpanel" class="dpanel" data-panel="${tab.id}" id="${pid}-p-${tab.id}" aria-labelledby="${pid}-tab-${tab.id}"${tab.id === cur ? "" : " hidden"} tabindex="0">${BODY[tab.id](tab, vm, pid)}</div>`).join("");
  return `<div class="tdet" data-id="${esc(vm.id)}"><div class="dtabs" role="tablist" aria-label="После ответа">${strip}</div>${panels}</div>`;
}
