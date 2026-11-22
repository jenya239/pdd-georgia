import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const source = read("content/lessons/ep01/plain.mjs");
const match = source.match(/return ("[\s\S]*");\s*\}/);
assert.ok(match, "Episode 1 source exports a literal HTML string");
const html = JSON.parse(match[1]);

test("ep01 follows the canonical source and preserves its legal appendix", () => {
  assert.equal(read("site/lessons/ep01-plain.html"), html);
  assert.ok(html.includes("<!--AFTER-TICKETS-->"));
  for (const norm of ["st2-p1", "st2-p2", "st4", "st58", "st1-p2", "st55-p1", "st57"]) {
    assert.ok(html.includes(`data-norm="${norm}"`), norm);
  }
  assert.ok(html.includes("Дословно об ответственности"));
  assert.ok(html.includes("Дословно об экзамене и возрасте"));
});

test("statistics have year, specific category, source, and limitation", () => {
  const section = html.slice(html.indexOf('<h2 id="sign">'), html.indexOf('<h2 id="liability">'));
  assert.ok(section.includes("2022 год"));
  assert.ok(section.includes("<strong>890 ДТП</strong>"));
  assert.ok(section.includes("82 человека"));
  assert.ok(section.includes("unece.org/sites/default/files/2025-08/2503619E_PDF_WEB.pdf"));
  assert.match(section, /общая категория/);
  assert.match(section, /не показывает, сколько происшествий связано именно/);
  assert.doesNotMatch(section, /890 ДТП из-за (?:неправильного понимания|незнания)/);
});

test("narrative has explanatory figures, timely exam comparison and a final source map", () => {
  const figures = [...html.matchAll(/<figure\b[\s\S]*?<\/figure>/g)].map(m => m[0]);
  assert.equal(figures.length, 7);
  for (const [i, f] of figures.entries()) {
    assert.match(f, /<svg\b[^>]*role="img"/, `figure ${i + 1}`);
    assert.match(f, /aria-label="/, `figure ${i + 1}`);
    assert.match(f, /<figcaption>/, `figure ${i + 1}`);
  }
  assert.ok(html.includes("viewBox=\"0 0 700 280\""));
  assert.ok(html.includes("new.matsne.gov.ge/ka/document/view/6867586"));
  assert.match(html, /27 верных ответов/);
  assert.match(html, /25/);
  assert.ok(html.indexOf("Пять частей одного закона") < html.indexOf('<h2 id="liability">'));
  assert.ok(html.indexOf('<h2 id="recap">') < html.indexOf('<h2 id="sources">'));
  assert.ok(html.indexOf('<h2 id="sources">') < html.indexOf("<!--AFTER-TICKETS-->"));
});
