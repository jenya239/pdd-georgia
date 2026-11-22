import { test } from "node:test";
import assert from "node:assert/strict";
import { auditVisualEditorial } from "../../tools/visual-editorial-audit.mjs";

test("published visual lessons preserve normative links and ontology-assigned ticket examples", () => {
  const { problems, covered, rewritten } = auditVisualEditorial();
  assert.equal(covered, 8);
  assert.equal(rewritten, 8);
  assert.deepEqual(problems, []);
});

import { readFileSync } from "node:fs";

test("episode 3 is a continuous illustrated explanation, not a legacy lesson", () => {
  const html = readFileSync("site/lessons/ep03-plain.html", "utf8");
  assert.equal((html.match(/<figure\b/g) || []).length, 10);
  const moments = ["Дороги прежде автомобилей", "Несколько метров асфальта",
    "Когда главная дорога поворачивает", "Перекрёсток или выезд со двора?"];
  const at = moments.map(x => html.indexOf(x));
  assert.ok(at.every(x => x >= 0));
  assert.ok(at.every((x, i) => i === 0 || x > at[i - 1]));
  for (const ticket of [54, 81, 503]) assert.ok(html.includes(`№${ticket}`));
  for (const norm of ["st5-p13", "st5-p37", "st36-p4-v", "st36-p8"])
    assert.ok(html.includes(`norm/${norm}.html`));
  const script = readFileSync("site/assets/pages/episode.mjs", "utf8");
  assert.ok(script.includes('!showFilm && (chosen?.id === "plain" || (isText && !editions.length))'));
  assert.ok(script.includes("lesson-appendix"));
});

test("episode 2 is a continuous road-space narrative with grounded pedestrian evidence", () => {
  const html = readFileSync("site/lessons/ep02-plain.html", "utf8");
  assert.equal((html.match(/<figure\b/g) || []).length, 8);
  const moments = ["Улица шире проезжей части", "Одна линия меняется на разделитель",
    "Полосы не исчезают вместе с разметкой", "У края дороги меняется назначение пространства",
    "Когда тротуар заканчивается", "Одна дорога — несколько разных границ"];
  const positions = moments.map(text => html.indexOf(text));
  assert.ok(positions.every((x, i) => x >= 0 && (i === 0 || x > positions[i - 1])));
  for (const ticket of [390, 391]) assert.ok(html.includes(`№${ticket}`));
  for (const norm of ["st5-p9", "st5-p12", "st5-p45", "st31-p18"])
    assert.ok(html.includes(`norm/${norm}.html`));
  assert.ok(html.includes("164 пешехода") && html.includes("35% всех погибших"));
});
test("first episode develops one source-checking argument with contextual crash data", () => {
  const html = readFileSync("site/lessons/ep01-plain.html", "utf8");
  assert.equal((html.match(/<figure/g) || []).length, 7);
  const steps = ["Один знак — несколько вопросов", "Правило и наказание — разные сведения",
    "Правильный источник тоже может устареть", "Почему в старом пособии может быть неверный ответ",
    "Карта источников"];
  const index = steps.map(s => html.indexOf(s));
  assert.ok(index.every((x, i) => x >= 0 && (i === 0 || x > index[i - 1])));
  assert.ok(html.includes("norm/st2-p1.html") && html.includes("norm/st2-p2.html"));
  assert.ok(html.includes("890 ДТП") && html.includes("82 человека"));
});

test("every released episode has a continuous visual-reading edition", () => {
  const manifest = JSON.parse(readFileSync("content/plan/visual-editorial-review.json", "utf8"));
  assert.equal(manifest.episodes.length, 8);
  for (const episode of manifest.episodes) {
    assert.equal(episode.formatMigrated, true, episode.id);
    const page = readFileSync(episode.published, "utf8");
    assert.ok(page.includes("<!--AFTER-TICKETS-->"), episode.id);
    assert.ok((page.match(/<figure\b/g) || []).length >= episode.minFigures, episode.id);
    assert.ok(episode.integratedTickets.every(ticket => page.includes(`№${ticket}`)), episode.id);
  }
  const renderer = readFileSync("site/assets/pages/episode.mjs", "utf8");
  assert.ok(renderer.includes('!showFilm && (chosen?.id === "plain" || (isText && !editions.length))'));
  assert.ok(renderer.includes('${lesson.before}${lesson.after}'));
  assert.ok(renderer.includes('class="lesson-appendix"'));
});

test("episode 3 ends with a legible responsive synthesis of the eight rule decisions", () => {
  const html = readFileSync("site/lessons/ep03-plain.html", "utf8");
  const tail = html.slice(html.indexOf("<!--AFTER-TICKETS-->"));
  assert.ok(tail.includes('data-editorial-role="recap"'));
  assert.match(tail, /<picture>[\s\S]*?<source[^>]+ep03-recap-mobile\.svg[\s\S]*?<img[^>]+ep03-recap\.svg/);
  assert.ok(tail.indexOf('data-editorial-role="recap"') > tail.indexOf("Перед перекрёстком легко"));
  for (const [path, width, phrases] of [
    ["site/assets/ep03-recap.svg", 760, ["Сначала определи место", "Если дороги равнозначны", "Остановка и стоянка"]],
    ["site/assets/ep03-recap-mobile.svg", 374, ["Если покрытие не видно", "Если главная поворачивает", "Остановка и стоянка"]],
  ]) {
    const svg = readFileSync(path, "utf8");
    assert.ok(svg.includes(`viewBox="0 0 ${width} `), path);
    assert.equal((svg.match(/<g>\s*<rect /g) || []).length, 8, path);
    for (const phrase of phrases) assert.ok(svg.includes(phrase), path);
    const fonts = [...svg.matchAll(/font-size="([\d.]+)"/g)].map(x => Number(x[1]));
    assert.ok(fonts.every(n => n >= 13), path);
  }
});
