/** Page chrome: header with navigation, theme switch, progress save/load, image zoom overlay, footer. */
import { $ } from "./dom.mjs";
import { applyTheme, toggleTheme } from "./prefs.mjs";
import { mountProgressButtons } from "./progress-file.mjs";
import { mountNormPopups } from "./normpop.mjs";

const NAV = [["index.html", "Выпуски", "eps"], ["practice.html", "Самопроверка", "practice"], ["exam.html", "Экзамен", "exam"],
  ["errors.html", "Ошибки", "errors"], ["norm/index.html", "Закон", "law"], ["about.html", "О данных", "about"]];
/** Path from the current page to the site root ("../" on docs/norm/*.html). */
export const ROOT = document.documentElement.dataset.root || "";

applyTheme();

export function header(active) {
  const h = document.createElement("header");
  h.className = "top";
  h.innerHTML = `<div class="in"><a class="brand" href="${ROOT}index.html" title="ПДД Грузии · категория B">ПДД Грузии</a>
    <button type="button" class="menubtn" aria-expanded="false" aria-controls="mainnav" aria-label="Меню" title="Меню">☰</button>
    <nav class="main" id="mainnav" aria-label="Разделы">${NAV.map(([u, t, k]) =>
      `<a href="${ROOT}${u}" data-k="${k}"${k === active ? ' class="on" aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
    <div class="tools"></div></div>`;
  document.body.prepend(h);
  const tools = $(".tools", h);
  mountProgressButtons(tools);
  tools.insertAdjacentHTML("beforeend", `<button type="button" class="iconbtn" id="themebtn" aria-label="Светлая / тёмная тема" title="Светлая / тёмная тема">◐</button>`);
  $("#themebtn", h).onclick = toggleTheme;
  mountMenu(h);
  const z = document.createElement("div");
  z.className = "zoom"; z.id = "zoom"; z.innerHTML = "<img alt=''>";
  z.onclick = () => z.classList.remove("on");
  document.body.append(z);
  const f = document.createElement("footer");
  f.innerHTML = `Учебный черновик. Вопросы, картинки и пояснения — база teoria.on.ge (кат. B/B1, выгрузка 20.10.2026). Закон — Matsne, ред. 25.06.2026; юридическую силу имеет грузинский текст. <a href="${ROOT}about.html">О данных и ограничениях</a>.`;
  document.body.append(f);
  mountNormPopups(ROOT);
}

/** Collapsed navigation (narrow screens): the menu button toggles a dropdown; Esc / outside click / link click close it. */
function mountMenu(h) {
  const btn = $(".menubtn", h), nav = $("nav.main", h);
  const set = open => { nav.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); };
  btn.onclick = () => set(!nav.classList.contains("open"));
  nav.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && nav.classList.contains("open")) { set(false); btn.focus(); }
  });
  document.addEventListener("click", e => { if (nav.classList.contains("open") && !h.contains(e.target)) set(false); });
  h.addEventListener("focusout", e => { if (nav.classList.contains("open") && e.relatedTarget && !h.contains(e.relatedTarget)) set(false); });
}

export function zoom(src) {
  const z = $("#zoom");
  z.querySelector("img").src = src;
  z.classList.add("on");
}
