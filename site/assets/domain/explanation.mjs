/** The ticket bank's own explanation. It exists only in Georgian; the build attaches a Russian machine
 *  translation (t.ex_ru, see tools/pdd/mt.py), shown first, with the Georgian original collapsed under it. */
import { lk } from "./normlinks.mjs";

export function baseExplanationHtml(t) {
  if (!t.ex) return `<div class="expl small mut">Пояснения в исходной базе нет.</div>`;
  const ka = `<div class="ka" lang="ka">${lk(t, "ex")}</div>`;
  if (!t.ex_ru) return `<div class="expl"><div class="small mut">Пояснение из базы (только на грузинском):</div>${ka}</div>`;
  return `<div class="expl"><div class="small mut">Пояснение из базы — <span class="badge warn" title="Автоматический перевод с грузинского; ссылки на нормы восстановлены по оригиналу. Смысл сверяйте с текстом закона.">машинный перевод</span></div>`
    + `<div class="exru" lang="ru">${lk(t, "ex_ru")}</div>`
    + `<details class="exka"><summary>оригинал (KA)</summary>${ka}</details></div>`;
}
