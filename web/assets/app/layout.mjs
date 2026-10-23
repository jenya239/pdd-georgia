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
  h.innerHTML = `<div class="in"><a class="brand" href="${ROOT}index.html">ПДД Грузии <small>· категория B</small></a>
    <nav class="main">${NAV.map(([u, t, k]) => `<a href="${ROOT}${u}" class="${k === active ? "on" : ""}">${t}</a>`).join("")}</nav>
    <div class="tools"><button class="iconbtn" id="themebtn" title="Светлая / тёмная тема">◐ Тема</button></div></div>`;
  document.body.prepend(h);
  $("#themebtn", h).onclick = toggleTheme;
  mountProgressButtons($(".tools", h));
  const z = document.createElement("div");
  z.className = "zoom"; z.id = "zoom"; z.innerHTML = "<img alt=''>";
  z.onclick = () => z.classList.remove("on");
  document.body.append(z);
  const f = document.createElement("footer");
  f.innerHTML = `Учебный черновик. Вопросы, картинки и пояснения — база teoria.on.ge (кат. B/B1, выгрузка 20.10.2026). Закон — Matsne, ред. 25.06.2026; юридическую силу имеет грузинский текст. <a href="${ROOT}about.html">О данных и ограничениях</a>.`;
  document.body.append(f);
  mountNormPopups(ROOT);
}

export function zoom(src) {
  const z = $("#zoom");
  z.querySelector("img").src = src;
  z.classList.add("on");
}
