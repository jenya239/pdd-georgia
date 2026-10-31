/** Wires the post-answer panel (packages/domain/details.mjs) under a ticket: tabs, the note, lazy norm texts. */
import { loadedTickets } from "./data.mjs";
import { store } from "./progress.mjs";
import { normEntry } from "./normpop.mjs";
import { ticketDetails, detailsHtml } from "../domain/details.mjs";
import { clip } from "../domain/normlinks.mjs";

let seq = 0;
const CLIP = 700;

function loadNorms(panel) {
  panel.querySelectorAll("[data-load]").forEach(async el => {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    el.textContent = "Загрузка…";
    const e = await normEntry(el.dataset.load);
    const txt = e ? e.ru || e.ka || "" : "";
    if (!txt) { el.textContent = "Текст не загрузился — откройте норму по ссылке."; return; }
    el.lang = e.ru ? "ru" : "ka";
    const { text, cut } = clip(txt, CLIP);
    el.textContent = text;
    if (!e.ru) el.insertAdjacentHTML("beforeend", `<div class="small mut">Русского перевода этого пункта нет в Matsne — официальный грузинский текст.</div>`);
    if (cut) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "linkbtn"; b.textContent = "показать полностью";
      b.onclick = () => { el.textContent = txt; };
      el.append(b);
    }
  });
}

/** Appends the panel to `host` for ticket `t` answered with `choice` (reads the current progress and note). */
export function renderDetails(host, t, choice) {
  const D = loadedTickets();
  const vm = ticketDetails(t, { choice, record: store.progress()[t.id], note: store.notes()[t.id]?.x || "" },
    { mc: D.mc, ticketDistractors: D.ticketDistractors, laws: D.laws, concepts: D.meta.concepts, lessons: D.meta.lessons });
  const pid = `td${++seq}`;
  host.insertAdjacentHTML("beforeend", detailsHtml(vm, store.settings().tab, pid));
  const box = host.lastElementChild, tabs = [...box.querySelectorAll('[role="tab"]')];
  function select(id, focus = false) {
    for (const b of tabs) {
      const on = b.dataset.tab === id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    box.querySelectorAll(".dpanel").forEach(p => { p.hidden = p.dataset.panel !== id; });
    if (id === "norms") loadNorms(box.querySelector('[data-panel="norms"]'));
  }
  tabs.forEach(b => b.addEventListener("click", () => { select(b.dataset.tab); store.saveSettings({ tab: b.dataset.tab }); }));
  box.querySelector('[role="tablist"]').addEventListener("keydown", e => {
    const i = tabs.indexOf(document.activeElement);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (i < 0 || to === undefined) return;
    e.preventDefault(); e.stopPropagation();
    const b = tabs[(to + tabs.length) % tabs.length];
    select(b.dataset.tab, true);
    store.saveSettings({ tab: b.dataset.tab });
  });
  const cur = tabs.find(b => b.getAttribute("aria-selected") === "true");
  if (cur) select(cur.dataset.tab);

  const ta = box.querySelector(".dnote"), status = box.querySelector("[data-status]"), noteTab = tabs.find(b => b.dataset.tab === "note");
  const save = () => {
    const n = store.saveNote(t.id, ta.value, Date.now());
    status.textContent = n ? "Заметка сохранена." : "Заметка удалена.";
    noteTab.textContent = "Заметка" + (n ? " •" : "");
    host.closest(".q")?.querySelector(".notemark")?.toggleAttribute("hidden", !n);
  };
  box.querySelector("[data-save]").addEventListener("click", save);
  ta.addEventListener("change", save);
  ta.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save(); });
  return box;
}
