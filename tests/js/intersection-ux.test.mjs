import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { SOLVED_CASES } from "../../packages/intersection/cases.ts";
import { decide } from "../../packages/intersection/solver.ts";
import { explainWrong } from "../../packages/intersection/explain.ts";

const read = (path) => readFileSync(path, "utf8");

test("road and question appear before developer settings", () => {
  const page = read("web/assets/pages/intersection.mjs");
  const shell = page.slice(page.indexOf("export function trainerShell"), page.indexOf("/** Draw one checked scene"));
  assert.ok(shell.indexOf('id="ix-scene"') < shell.indexOf('id="ix-question"'));
  assert.ok(shell.includes('id="ix-flash"'));
  assert.ok(shell.includes('id="explain"'));
  assert.ok(shell.includes('class="ix-mobile-prompt"'));
  assert.ok(shell.includes('<details class="ix-details">'));
  assert.ok(shell.indexOf('<details class="ix-details">') > shell.indexOf('id="ix-scene"'));
  assert.ok(page.includes("Сначала автомобиль"));
  assert.ok(!page.includes("const letters = { N:"));
});

test("feedback and comparison remain until a deliberate next action", () => {
  const page = read("web/assets/pages/intersection.mjs");
  assert.ok(page.includes('armNext("Следующая ситуация"'));
  assert.ok(page.includes('armNext("Сравнить ситуацию"'));
  assert.ok(page.includes('q("next").textContent = label'));
  assert.ok(!page.includes("setTimeout(goNext"));
  assert.ok(!page.includes("timer = setTimeout"));
  assert.ok(page.includes('event.key === "Enter"'));
});

test("each common mistake has a brief explanation with a norm", () => {
  for (const item of SOLVED_CASES) {
    const decision = decide(item.scene);
    for (const vehicle of item.scene.vehicles) {
      if (decision.admissible.includes(vehicle.id)) continue;
      const explanation = explainWrong(item.scene, decision, vehicle.id);
      assert.ok(explanation, item.id);
      assert.ok(explanation.text.includes(vehicle.id), item.id);
      assert.ok(explanation.norms.length > 0, item.id);
      assert.ok(explanation.text.length < 230, `${item.id}: ${explanation.text.length}`);
      assert.doesNotMatch(explanation.text, /решатель|проверенный срез|сходятся|север|восток|запад|юг|само по себе|очерёдность держит/, item.id);
      assert.ok(explanation.highlight.yieldTo.length > 0, item.id);
    }
  }
});

test("published page sources and responsive stylesheet stay in sync", () => {
  for (const path of ["assets/pages/intersection.mjs", "assets/pages/episode.mjs", "assets/intersection.css"]) {
    assert.equal(read(`site/${path}`), read(`web/${path}`), path);
  }
  const css = read("web/assets/intersection.css");
  assert.ok(css.includes(".ix-layout"));
  assert.ok(css.includes(".ix-flash"));
  assert.ok(css.includes(".ix-mobile-prompt"));
  assert.ok(css.includes("@media(max-width:720px)"));
  const episode = read("web/assets/pages/episode.mjs");
  assert.ok(episode.includes("Теперь попробуй сам"));
  assert.ok(!episode.includes("не прячет его под снегом"));
});
