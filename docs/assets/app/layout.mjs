/** Page chrome: header with navigation, language and theme switches, progress save/load, image zoom overlay, footer. */
import { $ } from "./dom.mjs";
import { LANGS, getLang, setLang, applyTheme, toggleTheme } from "./prefs.mjs";
import { mountProgressButtons } from "./progress-file.mjs";

const NAV = [["index.html", "Выпуски", "eps"], ["practice.html", "Самопроверка", "practice"], ["exam.html", "Экзамен", "exam"],
  ["errors.html", "Ошибки", "errors"], ["about.html", "О данных", "about"]];

applyTheme();

export function header(active) {
  const h = document.createElement("header");
  h.className = "top";
  h.innerHTML = `<div class="in"><a class="brand" href="index.html">ПДД Грузии <small>· категория B</small></a>
    <nav class="main">${NAV.map(([u, t, k]) => `<a href="${u}" class="${k === active ? "on" : ""}">${t}</a>`).join("")}</nav>
    <div class="tools"><span class="seg" id="langseg" title="Язык текста вопросов">${Object.entries(LANGS).map(([k, v]) => `<button data-l="${k}">${v}</button>`).join("")}</span>
    <button class="iconbtn" id="themebtn" title="Светлая / тёмная тема">◐ Тема</button></div></div>`;
  document.body.prepend(h);
  h.querySelectorAll("#langseg button").forEach(b => b.onclick = () => { setLang(b.dataset.l); syncLang(); });
  $("#themebtn", h).onclick = toggleTheme;
  mountProgressButtons($(".tools", h));
  syncLang();
  const z = document.createElement("div");
  z.className = "zoom"; z.id = "zoom"; z.innerHTML = "<img alt=''>";
  z.onclick = () => z.classList.remove("on");
  document.body.append(z);
  const f = document.createElement("footer");
  f.innerHTML = `Учебный черновик. Вопросы, картинки и пояснения — база teoria.on.ge (кат. B/B1, выгрузка 20.10.2026). Закон — Matsne, ред. 25.06.2026; юридическую силу имеет грузинский текст. <a href="about.html">О данных и ограничениях</a>.`;
  document.body.append(f);
}

function syncLang() {
  document.querySelectorAll("#langseg button").forEach(b => b.classList.toggle("on", b.dataset.l === getLang()));
}

export function zoom(src) {
  const z = $("#zoom");
  z.querySelector("img").src = src;
  z.classList.add("on");
}
