import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectVisualHtml } from "../../tools/editorial/visual-html-check.mjs";

test("visual article checks accessible SVG, caption, and valid hash link", () => {
  const good = '<figure><svg viewBox="0 0 30 10" role="img" aria-label="Дороги"><path d="M0 0"/></svg><figcaption>Схема</figcaption></figure><h2 id="rule">Правило</h2><a href="#rule">К правилу</a>';
  const found = inspectVisualHtml(good, { id: "demo", rewritten: true });
  assert.deepEqual(found.problems, []);
  assert.equal(found.figures, 1);
});

test("visual article detects inaccessible drawings and obsolete controls", () => {
  const bad = '<figure><svg><path d="M0 0"/></svg></figure><div class="scene-tabs"></div><a href="#missing">Далее</a>';
  const found = inspectVisualHtml(bad, { id: "demo", rewritten: true });
  assert.ok(found.problems.some(p => p.includes("caption")));
  assert.ok(found.problems.some(p => p.includes("accessible")));
  assert.ok(found.problems.some(p => p.includes("viewBox")));
  assert.ok(found.problems.some(p => p.includes("interactive")));
  assert.ok(found.problems.some(p => p.includes("unresolved fragment")));
});

test("visual article detects duplicate IDs", () => {
  const found = inspectVisualHtml('<p id="x"></p><g id="x"></g>', { id: "demo" });
  assert.ok(found.problems.some(p => p.includes("duplicate")));
});
