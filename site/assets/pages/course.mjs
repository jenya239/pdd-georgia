/** Page script: course.html. The released sequence, then series that still have no lesson. */
import { loadEpisodes } from "../app/data.mjs";
import { $, esc, plural } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { store } from "../app/progress.mjs";
import { lessonStatus } from "../domain/flow.mjs";
import { releasedLessons } from "../domain/scope.mjs";

const BLOCKS = {
  0: "Вступление", 1: "Термины (ст. 5)", 2: "Участники движения", 3: "Светофор и регулировщик",
  4: "Знаки и разметка", 5: "Манёвры, скорость, обгон", 6: "Перекрёстки", 7: "Остановка и стоянка",
  8: "Особые места и участники", 9: "Буксировка, перевозка", 10: "Свет и сигналы",
  11: "Техсостояние, регистрация", 12: "Права, категории, баллы", 13: "Штрафы (КоАП)",
  14: "Вне закона: первая помощь, безопасность, эко",
};

header("course");
const [E, st] = await Promise.all([loadEpisodes(), store]);
const own = st.settings().own !== false;
const progress = st.progress();
$("#lessons").innerHTML = releasedLessons(E.released).map(lesson => `<a class="card lessonlink" href="episode.html?id=${esc(lesson.id)}">
  <div class="small mut">${lesson.num}. ${esc(lessonStatus(lesson, progress, { own }))}</div>
  <h3>${esc(lesson.title)}</h3>
  <p>${esc(lesson.lead || "")}</p></a>`).join("");

const covered = new Set(E.released.flatMap(lesson => lesson.plan));
const byBlock = new Map();
for (const series of E.plan) {
  if (covered.has(series.e)) continue;
  if (!byBlock.has(series.block)) byBlock.set(series.block, []);
  byBlock.get(series.block).push(series);
}
if (!byBlock.size) $("#gaphead").hidden = true;
$("#gaps").innerHTML = [...byBlock].map(([block, rows]) => {
  const tickets = rows.reduce((sum, series) => sum + (series.n || 0), 0);
  const word = plural(rows.length, ["серия", "серии", "серий"]);
  const items = rows.map(series => `<li>${esc(series.title)}.${series.n
    ? ` <a href="practice.html?ep=${esc(series.e)}">Билеты: ${series.n}</a>`
    : " Билетов в базе нет."}</li>`).join("");
  return `<details><summary>${esc(BLOCKS[block] || "Блок " + block)}. ${rows.length} ${word}, урока нет${tickets ? ` · билетов ${tickets}` : ""}.</summary><ul>${items}</ul></details>`;
}).join("");
