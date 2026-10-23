import { test } from "node:test";
import assert from "node:assert/strict";
import { figureSvg } from "../../packages/domain/figure.mjs";

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
