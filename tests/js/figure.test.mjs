import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { figureSvg } from "../../packages/domain/figure.ts";

const count = (s, re) => (s.match(re) || []).length;

test("crossing: arms, cars with letters, main road and yard marks", () => {
  const svg = figureSvg({ kind: "crossing", arms: ["n", "e", "s", "w"], main: ["n", "s"],
    cars: [{ id: "А", from: "s", to: "n" }, { id: "Б", from: "e", to: "w" }] });
  assert.match(svg, /^<svg[^>]*viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /role="img"/);
  assert.equal(count(svg, /class="car"/g), 2);
  assert.match(svg, />А</);
  assert.match(svg, />Б</);
  assert.match(svg, /главная/);
  const yard = figureSvg({ kind: "crossing", arms: ["w", "e", "s"], yard: "s", cars: [{ id: "А", from: "s", to: "e" }] });
  assert.match(yard, /двор/);
  assert.equal(count(yard, /class="arm"/g), 3);
  assert.match(figureSvg({ kind: "crossing", arms: ["n", "e", "s", "w"], unpaved: ["w", "e"], cars: [] }), /грунт/);
});

test("section: a center line is not a dividing strip", () => {
  const svg = figureSvg({ kind: "section", strips: [{ k: "lane" }, { k: "line" }, { k: "lane" }] });
  assert.match(svg, /class="strip k-line"/);
  assert.match(svg, /<line /);
  assert.equal(count(svg, /<rect /g), 2);
  assert.doesNotMatch(svg, /k-strip/);
  assert.doesNotMatch(svg, /\sid="/);
});

test("section: one rect per strip and the letters", () => {
  const svg = figureSvg({ kind: "section", strips: [{ k: "shoulder", label: "А" }, { k: "lane" }, { k: "strip", label: "В" }, { k: "lane" }] });
  assert.equal(count(svg, /class="strip /g), 4);
  // kind classes are prefixed: a bare "strip" kind would collide with the base class in CSS
  assert.match(svg, /class="strip k-strip"/);
  assert.match(svg, /class="strip k-shoulder"/);
  assert.match(svg, />А</);
  assert.match(svg, />В</);
});

test("approach: object and distance marks", () => {
  const svg = figureSvg({ kind: "approach", object: "barrier", light: 8, marks: [{ label: "А", m: 10 }, { label: "Б", m: 3 }] });
  assert.equal(count(svg, /class="mark"/g), 2);
  assert.match(svg, /10 м/);
  assert.match(svg, /шлагбаум/);
  assert.match(svg, /светофор/);
  assert.match(figureSvg({ kind: "approach", object: "zebra", marks: [] }), /переход/);
  assert.match(figureSvg({ kind: "approach", object: "rails", marks: [] }), /рельс/);
});

test("figures define no element ids (many share one page)", () => {
  for (const f of [{ kind: "crossing", arms: ["n", "s"], cars: [{ id: "А", from: "s", to: "n" }] },
    { kind: "section", strips: [{ k: "lane" }] }, { kind: "approach", object: "zebra", marks: [] }]) {
    assert.doesNotMatch(figureSvg(f), /\sid="/);
  }
});

test("labels are escaped and unknown kinds fail loudly", () => {
  assert.doesNotMatch(figureSvg({ kind: "section", strips: [{ k: "lane", label: "<b>" }] }), /<b>/);
  assert.throws(() => figureSvg({ kind: "nope" }));
});

test("a route that leaves the drawn road is rejected", () => {
  assert.throws(() => figureSvg({ kind: "crossing", arms: ["w", "e", "s"], yard: "s",
    cars: [{ id: "А", from: "s", to: "n" }] }));
});

test("published crossing tasks keep every route on a drawn arm", () => {
  for (const name of readdirSync("content/checkitems").filter((item) => item.endsWith(".json"))) {
    const items = JSON.parse(readFileSync(`content/checkitems/${name}`, "utf8"));
    for (const item of items) {
      if (!item.fig || item.fig.kind !== "crossing") continue;
      assert.doesNotThrow(() => figureSvg(item.fig), item.id);
    }
  }
});

test("a turning tram has rails on the arm it turns into", () => {
  const svg = figureSvg({ kind: "crossing", arms: ["n", "e", "s", "w"],
    cars: [{ id: "Т", from: "w", to: "s", rail: true }] });
  const rails = svg.match(/<line [^>]*class="rail"[^>]*>/g) || [];
  assert.ok(rails.some((line) => /y2="300"/.test(line)), rails.join("\n"));
});

test("a priority sign is drawn as a sign, not as the word that gives the answer", () => {
  const svg = figureSvg({ kind: "crossing", arms: ["n", "e", "s", "w"], unpaved: ["n", "s"],
    signs: [{ arm: "s", code: "2.1" }], cars: [{ id: "А", from: "s", to: "n" }] });
  assert.match(svg, /class="sign"/);
  assert.match(svg, />2\.1</);
  assert.match(svg, /грунт/);
  assert.doesNotMatch(svg, /главная/);
});

test("a flashing yellow is drawn, not only named", () => {
  const svg = figureSvg({ kind: "crossing", arms: ["n", "e", "s", "w"], signal: "flash", cars: [] });
  assert.match(svg, /class="lamp"/);
  assert.match(svg, /мигающий жёлтый/);
});

test("crossing: a rail vehicle is drawn as a tram, not as a car", () => {
  const svg = figureSvg({ kind: "crossing", arms: ["n", "e", "s", "w"],
    cars: [{ id: "Т", from: "n", to: "s", rail: true }, { id: "А", from: "s", to: "n" }] });
  assert.equal(count(svg, /class="car tram"/g), 1);
  assert.equal(count(svg, /class="car"/g), 1);
  assert.match(svg, /class="rail"/);
  assert.match(svg, />Т</);
  assert.doesNotMatch(svg, /\sid="/);
});
