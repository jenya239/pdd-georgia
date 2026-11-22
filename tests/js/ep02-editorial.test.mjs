import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const source = read("content/lessons/ep02/plain.mjs");
const match = source.match(/return ("[\s\S]*");\s*\}/);
assert.ok(match, "source must render a literal HTML fragment");
const html = JSON.parse(match[1]);

test("episode 2 published HTML equals the canonical source and retains exact law section", () => {
  assert.equal(read("site/lessons/ep02-plain.html"), html);
  assert.ok(html.includes("<!--AFTER-TICKETS-->"));
  assert.ok(html.includes("Формулировки закона и уточнения"));
  assert.ok(html.includes("В русской цитате пункта 14 статьи 31"));
  assert.ok(html.includes("გარდა მსვლელობით სიარულის შემთხვევებისა"));
  for (const name of ["st5-p9", "st5-p12", "st5-p45", "st31-p18"]) {
    assert.ok(html.includes(`data-norm="${name}"`), name);
  }
});

test("narrative forms a justified sequence and integrates both tickets", () => {
  const markers = ["Улица шире проезжей части", "Одна линия меняется на разделитель",
    "билетами №390 и №391", "Полосы не исчезают вместе с разметкой",
    "У края дороги меняется назначение пространства", "Когда тротуар заканчивается",
    "Одна дорога — несколько разных границ"];
  const places = markers.map(s => html.indexOf(s));
  assert.ok(places.every((n,i) => n >= 0 && (i === 0 || n > places[i-1])));
  assert.equal((html.match(/<figure\b/g) || []).length, 8);
  assert.equal((html.match(/<figcaption>/g) || []).length, 8);
  assert.equal((html.match(/<picture>/g) || []).length, 1);
  assert.ok(html.indexOf('data-editorial-role="recap"') < html.indexOf('<h2 id="law">'));
});

test("pedestrian statistic is verifiable and does not claim causation from shoulder rules", () => {
  const pos = html.indexOf("164 пешехода");
  const pedestrian = html.slice(html.indexOf('<h2 id="pedestrian">'),html.indexOf('<h2 id="recap">'));
  assert.ok(pos > html.indexOf('<h2 id="pedestrian">'));
  assert.ok(pedestrian.includes("2025 году"));
  assert.ok(pedestrian.includes("35% всех погибших"));
  assert.ok(pedestrian.includes("matsne.gov.ge/ka/document/view/6970519"));
  assert.match(pedestrian, /нельзя узнать, сколько людей шли именно по обочине/);
  assert.doesNotMatch(pedestrian, /164 (?:пешехода|человека) погибли из-за|35% (?:ДТП|аварий) произошло/);
});

test("recap has two different screen-specific SVGs and readable text", () => {
  for (const [file,width] of [["ep02-recap.svg", 760],["ep02-recap-mobile.svg",374]]) {
    const site = read(`site/assets/${file}`), web = read(`web/assets/${file}`);
    assert.equal(site,web,file);
    assert.ok(site.includes(`viewBox="0 0 ${width} `),file);
    assert.ok(site.includes('role="img"'),file);
    const fonts = [...site.matchAll(/font-size="([\d.]+)"/g)].map(m => Number(m[1]));
    assert.ok(fonts.length >= 12 && fonts.every(n => n >= 12),file);
  }
  assert.ok(html.includes("ep02-recap-mobile.svg") && html.includes("ep02-recap.svg"));
});
