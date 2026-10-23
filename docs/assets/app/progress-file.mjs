/** Кнопки «Сохранить прогресс в файл» / «Загрузить из файла» (DOM-обвязка над store.exportText / importText). */
export function mountProgressFile(el, store, { onImport = () => {} } = {}) {
  el.innerHTML = `<div class="row"><button class="btn ghost" data-act="export">Сохранить прогресс в файл</button>
    <label class="btn ghost">Загрузить из файла<input type="file" accept="application/json,.json" hidden data-act="import"></label></div>
    <p class="small mut" data-msg>Прогресс хранится только в этом браузере. Файл переносит его на другое устройство; при загрузке данные объединяются.</p>`;
  const msg = el.querySelector("[data-msg]");
  el.querySelector("[data-act=export]").onclick = () => {
    const now = Date.now(), blob = new Blob([store.exportText(now)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pddge-progress-${new Date(now).toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg.textContent = "Файл сохранён.";
  };
  el.querySelector("[data-act=import]").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const r = store.importText(await f.text());
      msg.textContent = `Загружено. Теперь в прогрессе ${r.tickets} билетов и ${r.runs} завершённых проверок.`;
      onImport(r);
    } catch (err) { msg.textContent = "Не удалось загрузить: " + err.message; }
    e.target.value = "";
  };
}
