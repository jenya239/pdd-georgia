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
  assert.ok(html.includes("Сначала разберёмся с дорогами") === false); // Heading is editorial, not a numbered card.
  const moments = ["Дороги прежде автомобилей", "Несколько метров асфальта",
    "Когда главная дорога поворачивает", "Перекрёсток или выезд со двора?"];
  const at = moments.map(x => html.indexOf(x));
  assert.ok(at.every(x => x >= 0));
  assert.ok(at.every((x, i) => i === 0 || x > at[i - 1]));
  for (const ticket of [54, 81, 503]) assert.ok(html.includes(`№${ticket}`));
  for (const norm of ["st5-p13", "st5-p37", "st36-p4-v", "st36-p8"])
    assert.ok(html.includes(`norm/${norm}.html`));
  const script = readFileSync("site/assets/pages/episode.mjs", "utf8");
  assert.ok(script.includes('id === "ep03" && !showFilm && chosen?.id === "plain"'));
  assert.ok(script.includes("lesson-appendix"));
});
