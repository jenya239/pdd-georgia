import { test } from "node:test";
import assert from "node:assert/strict";
import { auditVisualEditorial } from "../../tools/visual-editorial-audit.mjs";

test("published visual lessons preserve normative links and ontology-assigned ticket examples", () => {
  const { problems, covered, rewritten } = auditVisualEditorial();
  assert.equal(covered, 8);
  assert.ok(rewritten >= 3);
  assert.deepEqual(problems, []);
});

import { readFileSync } from "node:fs";

test("episode 3 is a continuous illustrated explanation, not a legacy lesson", () => {
  const html = readFileSync("site/lessons/ep03-plain.html", "utf8");
  assert.equal((html.match(/<figure\b/g) || []).length, 9);
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

test("episode 2 has a narrative sequence with verified illustrated ticket examples", () => {
  const html = readFileSync("site/lessons/ep02-plain.html", "utf8");
  assert.equal((html.match(/<figure\b/g) || []).length, 7);
  const moments = ["Дорога шире того места", "Что делает дорогу разделённой",
    "Полосы, которых не видно", "Как меняется правило для пешехода"];
  const positions = moments.map(text => html.indexOf(text));
  assert.ok(positions.every((x, i) => x >= 0 && (i === 0 || x > positions[i - 1])));
  for (const ticket of [390, 391]) assert.ok(html.includes(`№${ticket}`));
  for (const norm of ["st5-p9", "st5-p12", "st5-p45"])
    assert.ok(html.includes(`norm/${norm}.html`));
});

test("first episode follows the illustrated legal-source narrative", () => {
  const html = readFileSync("site/lessons/ep01-plain.html", "utf8");
  assert.equal((html.match(/<figure\b/g) || []).length, 5);
  const steps = ["От дорожного знака к закону", "Почему штраф ищут в другом документе",
    "Как убедиться, что правило ещё действует", "Где установлены правила экзамена"];
  const index = steps.map(s => html.indexOf(s));
  assert.ok(index.every((x, i) => x >= 0 && (i === 0 || x > index[i - 1])));
  assert.ok(html.includes("norm/st2-p1.html") && html.includes("norm/st2-p2.html"));
});
