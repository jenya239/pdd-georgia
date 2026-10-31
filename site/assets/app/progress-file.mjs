/**
 * «Сохранить прогресс» / «Загрузить прогресс» in the shared header (DOM glue over store.exportText /
 * previewText / importText; the rules live in ../domain/bundle.mjs and ../domain/registry.mjs).
 */
import { store } from "./progress.mjs";
import { toast } from "./dom.mjs";

const ROWS = [["tickets", "Билеты с ответами"], ["own", "Наши вопросы с ответами"], ["wrong", "Сейчас с ошибкой"],
  ["mastered", "Освоено (серия верных)"], ["runs", "Завершённые накопительные проверки"], ["active", "Незавершённые проверки"],
  ["exams", "Пробные экзамены"], ["notes", "Заметки к билетам"], ["settings", "Настройки проверки"], ["theme", "Тема"]];
const cell = v => (v === true ? "есть" : v === false || v === null ? "—" : String(v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);


export function exportProgress() {
  const now = Date.now(), blob = new Blob([store.exportText(now)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pddge-progress-${new Date(now).toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Файл с прогрессом сохранён.");
}

function dialog() {
  let d = document.getElementById("pfdlg");
  if (d) return d;
  d = document.createElement("dialog");
  d.id = "pfdlg"; d.className = "pfdlg";
  document.body.append(d);
  return d;
}

function showPreview(text) {
  const d = dialog();
  let pv;
  const draw = mode => {
    try { pv = store.previewText(text, mode); } catch (err) {
      d.innerHTML = `<h3>Загрузить прогресс</h3><p class="bad" data-err>Не удалось загрузить: ${esc(err.message)}</p>
        <p class="small mut">Данные в этом браузере не изменены.</p><div class="row end"><button class="btn" data-act="close">Закрыть</button></div>`;
      d.querySelector("[data-act=close]").onclick = () => d.close();
      return;
    }
    const when = pv.exportedAt ? new Date(pv.exportedAt).toLocaleString("ru-RU") : "дата неизвестна";
    d.innerHTML = `<h3>Загрузить прогресс</h3>
      <p class="small">Файл от ${esc(when)}${pv.app ? `, версия сайта ${esc(pv.app)}` : ""}, схема ${pv.schema}.
      ${pv.migratedFrom !== null ? "Файл старого формата — он будет преобразован." : ""}</p>
      <div class="pfmode"><label><input type="radio" name="pfmode" value="merge" ${mode === "merge" ? "checked" : ""}> Объединить с этим браузером <span class="mut">(ответы суммируются, истории объединяются; незавершённые проверки, настройки и тема — как здесь)</span></label>
      <label><input type="radio" name="pfmode" value="replace" ${mode === "replace" ? "checked" : ""}> Заменить <span class="mut">(всё в этом браузере станет как в файле; чего нет в файле — удалится)</span></label></div>
      <div class="pftable"><table class="topics" data-preview><tr><th></th><th>Сейчас</th><th>В файле</th><th>После</th></tr>
      ${ROWS.map(([k, t]) => `<tr data-k="${k}"><td>${t}</td><td>${cell(pv.before[k])}</td><td>${cell(pv.file[k])}</td><td><b>${cell(pv.after[k])}</b></td></tr>`).join("")}</table></div>
      <div class="row end"><button class="btn ghost" data-act="cancel">Отмена</button><button class="btn" data-act="apply">Применить</button></div>`;
    d.querySelectorAll("input[name=pfmode]").forEach(r => r.onchange = () => draw(r.value));
    d.querySelector("[data-act=cancel]").onclick = () => d.close();
    d.querySelector("[data-act=apply]").onclick = () => {
      try { store.importText(text, mode); } catch (err) { toast("Не удалось загрузить: " + err.message); d.close(); return; }
      d.close();
      sessionNote();
      location.reload();
    };
  };
  draw("merge");
  if (!d.open) d.showModal();
}

/** After reload, confirm the import (the flag lives in the URL hash, not in storage). */
function sessionNote() { history.replaceState(null, "", location.pathname + location.search + "#progress-loaded"); }
export function noteAfterReload() {
  if (location.hash !== "#progress-loaded") return;
  history.replaceState(null, "", location.pathname + location.search);
  toast("Прогресс загружен.");
}

/** Adds the two buttons (and the hidden file input) to the header's tool bar. */
export function mountProgressButtons(tools) {
  const wrap = document.createElement("span");
  wrap.className = "pfbtns";
  wrap.innerHTML = `<button type="button" class="iconbtn" data-act="export" aria-label="Сохранить прогресс" title="Сохранить прогресс: скачать весь прогресс одним файлом">⤓</button>
    <button type="button" class="iconbtn" data-act="pick" aria-label="Загрузить прогресс" title="Загрузить прогресс из файла: сначала покажем, что изменится">⤒</button>
    <input type="file" accept="application/json,.json" hidden data-act="import">`;
  tools.append(wrap);
  wrap.querySelector("[data-act=export]").onclick = exportProgress;
  wrap.querySelector("[data-act=pick]").onclick = () => wrap.querySelector("[data-act=import]").click();
  wrap.querySelector("[data-act=import]").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    showPreview(await f.text());
    e.target.value = "";
  };
  noteAfterReload();
}
