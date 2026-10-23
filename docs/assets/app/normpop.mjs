/**
 * Hover panel for norm links (a.nref): the referenced text beside the line, with the permanent link.
 * Desktop: opens after a short hover delay (or on keyboard focus) in the margin next to the text column and stays
 * open while the pointer is over it. Touch / narrow screens: a tap opens a bottom sheet. Esc closes.
 * Texts are fetched lazily, one small JSON chunk per article / annex section (docs/norm/chunks/*.json).
 */
import { esc, toast } from "./dom.mjs";
import { chunkOf, clip, placePanel } from "../domain/normlinks.mjs";

const OPEN_DELAY = 250, CLOSE_DELAY = 300, CLIP = 600;
const chunks = new Map();
let root = "", suppress = null, panel, backdrop, current = null, openTimer = 0, closeTimer = 0;

const sheetMode = () => matchMedia("(hover: none), (max-width: 640px)").matches;

function load(slug) {
  const c = chunkOf(slug);
  if (!chunks.has(c)) chunks.set(c, fetch(`${root}norm/chunks/${c}.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({})));
  return chunks.get(c).then(d => d[slug]);
}

/** The text of a norm ({c citation, t title, ru, ka, img}) from the same lazy chunks the panel uses. */
export const normEntry = slug => load(slug);

function build() {
  panel = document.createElement("div");
  panel.className = "npop"; panel.id = "npop"; panel.hidden = true;
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-labelledby", "npop-t"); panel.setAttribute("aria-describedby", "npop-x");
  backdrop = document.createElement("div");
  backdrop.className = "npop-back"; backdrop.hidden = true;
  backdrop.onclick = () => close();
  document.body.append(backdrop, panel);
  panel.addEventListener("pointerenter", () => clearTimeout(closeTimer));
  panel.addEventListener("pointerleave", e => { if (!isSheet()) scheduleClose(e.relatedTarget); });
  panel.addEventListener("focusout", e => { if (!panel.contains(e.relatedTarget) && e.relatedTarget !== current) scheduleClose(null); });
}

const isSheet = () => panel.classList.contains("sheet");

function body(slug, e, href) {
  if (!e) return `<p class="small mut" id="npop-x">Текст не загрузился. <a href="${esc(href)}">Открыть норму</a></p>`;
  const ru = e.ru || "", txt = ru || e.ka || "";
  const { text, cut } = clip(txt, CLIP);
  return `<div class="npop-h"><b id="npop-t">${esc(e.c)}</b>${e.t ? `<div class="small mut">${esc(e.t)}</div>` : ""}</div>
    ${e.img ? `<img class="npop-img" src="${esc(root + "norm/" + e.img)}" alt="${esc(e.c)}">` : ""}
    <div class="npop-x lawtext" id="npop-x" ${ru ? 'lang="ru"' : 'lang="ka"'}>${esc(text)}</div>
    ${!ru && e.ka ? `<div class="small mut">Русского перевода этого пункта нет в Matsne — показан официальный грузинский текст.</div>` : ""}
    ${cut ? `<button class="linkbtn" type="button" data-more>показать полностью</button>` : ""}
    <div class="npop-a"><a class="btn" href="${esc(href)}">Открыть норму</a><button class="iconbtn" type="button" data-copy>Копировать ссылку</button></div>`;
}

async function open(link) {
  clearTimeout(openTimer); clearTimeout(closeTimer);
  if (current && current !== link) current.setAttribute("aria-expanded", "false");
  current = link;
  const slug = link.dataset.norm, href = link.href, sheet = sheetMode();
  panel.classList.toggle("sheet", sheet);
  panel.dataset.norm = slug;
  panel.innerHTML = `<div class="npop-h"><b id="npop-t">${esc(link.textContent)}</b></div><div class="small mut" id="npop-x">Загрузка…</div>`;
  if (sheet) panel.insertAdjacentHTML("afterbegin", `<button class="npop-close iconbtn" type="button" aria-label="Закрыть">×</button>`);
  panel.hidden = false; backdrop.hidden = !sheet;
  link.setAttribute("aria-expanded", "true");
  position();
  const e = await load(slug);
  if (current !== link) return;
  panel.innerHTML = (sheet ? `<button class="npop-close iconbtn" type="button" aria-label="Закрыть">×</button>` : "") + body(slug, e, href);
  wire(e, href);
  position();
  panel.querySelector("img")?.addEventListener("load", position);
}

function wire(e, href) {
  panel.querySelector(".npop-close")?.addEventListener("click", () => close(true));
  panel.querySelector("[data-more]")?.addEventListener("click", ev => {
    panel.querySelector(".npop-x").textContent = e.ru || e.ka;
    ev.currentTarget.remove();
    position();
  });
  panel.querySelector("[data-copy]")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(href); toast("Ссылка скопирована: " + href); }
    catch { toast(href); }
  });
}

function position() {
  if (!current || panel.hidden) return;
  if (isSheet()) { panel.style.cssText = ""; return; }
  const r = current.getClientRects()[0] || current.getBoundingClientRect();
  const col = (current.closest(".lesson, .normpage, .card, main") || document.body).getBoundingClientRect();
  const p = placePanel({ vw: document.documentElement.clientWidth, vh: innerHeight, colLeft: col.left, colRight: col.right,
    anchorTop: r.top, anchorBottom: r.bottom, anchorLeft: r.left, panelH: panel.offsetHeight || 240 });
  panel.dataset.side = p.side;
  panel.style.cssText = `left:${Math.round(p.left)}px;top:${Math.round(p.top)}px;width:${Math.round(p.width)}px`;
}

function close(refocus = false) {
  clearTimeout(openTimer); clearTimeout(closeTimer);
  if (!current) return;
  const link = current;
  current = null;
  panel.hidden = true; backdrop.hidden = true;
  link.setAttribute("aria-expanded", "false");
  if (refocus) { suppress = link; link.focus(); suppress = null; }
}

function scheduleClose(to) {
  clearTimeout(closeTimer);
  if (to && (panel.contains(to) || to === current)) return;
  closeTimer = setTimeout(() => close(), CLOSE_DELAY);
}

const linkOf = t => (t instanceof Element ? t.closest("a.nref") : null);

export function mountNormPopups(r = "") {
  if (panel) return;
  root = r;
  build();
  const mark = el => { if (!el.hasAttribute("aria-haspopup")) { el.setAttribute("aria-haspopup", "dialog"); el.setAttribute("aria-controls", "npop"); el.setAttribute("aria-expanded", "false"); } };
  document.addEventListener("pointerover", e => {
    const a = linkOf(e.target);
    if (!a || e.pointerType !== "mouse" || sheetMode()) return;
    mark(a);
    clearTimeout(closeTimer);
    if (current === a) return;
    clearTimeout(openTimer);
    openTimer = setTimeout(() => open(a), OPEN_DELAY);
  });
  document.addEventListener("pointerout", e => {
    const a = linkOf(e.target);
    if (!a || e.pointerType !== "mouse" || isSheet()) return;
    if (a !== current) { clearTimeout(openTimer); return; }
    scheduleClose(e.relatedTarget);
  });
  document.addEventListener("focusin", e => {
    const a = linkOf(e.target);
    if (a && a !== suppress && !sheetMode()) { mark(a); open(a); }
  });
  document.addEventListener("focusout", e => {
    if (linkOf(e.target) === current && current && !isSheet() && !panel.contains(e.relatedTarget)) scheduleClose(null);
  });
  document.addEventListener("click", e => {
    const a = linkOf(e.target);
    if (!a || !sheetMode() || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (current === a && !panel.hidden) return;          // second tap follows the link
    e.preventDefault();
    mark(a);
    open(a);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && current) { const inPanel = panel.contains(document.activeElement); close(inPanel || isSheet() || document.activeElement === current); }
  });
  addEventListener("scroll", () => { if (current && !isSheet()) position(); }, { passive: true });
  addEventListener("resize", () => { if (current) position(); });
}
