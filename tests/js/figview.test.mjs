import { test } from "node:test";
import assert from "node:assert/strict";
import { overflowsX, fitBox, FIG_HINT } from "../../packages/domain/figview.mjs";

test("a figure overflows only when it is wider than its box by more than rounding", () => {
  assert.equal(overflowsX(520, 358), true);
  assert.equal(overflowsX(359, 358), false);
  assert.equal(overflowsX(358, 358), false);
});

test("fullscreen view keeps the aspect ratio and fits the screen", () => {
  // a 900×300 figure on a 390×844 portrait phone: limited by width
  assert.deepEqual(fitBox(900, 300, 390, 844), { width: 358, height: 119 });
  // on a landscape phone (844×390) it grows, limited by height minus the bar
  const b = fitBox(900, 300, 844, 390);
  assert.ok(b.width <= 844 - 32 && b.height <= 390 - 32 - 48, JSON.stringify(b));
  assert.ok(Math.abs(b.width / b.height - 3) < 0.05);
  // never upscale beyond 2×
  assert.deepEqual(fitBox(100, 50, 1280, 900), { width: 200, height: 100 });
});

test("hint text tells how to see the whole figure", () => {
  assert.match(FIG_HINT, /листайте/);
  assert.match(FIG_HINT, /весь экран/);
});
