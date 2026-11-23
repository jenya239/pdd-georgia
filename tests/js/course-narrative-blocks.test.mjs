import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = p => readFileSync(p, "utf8");
const episodes = [
  ["01", "plain", "ПДД легко принять", "одного правильного источника", 7, 6],
  ["02", "plain", "Закон помогает узнать", "самой дороги", 8, 7],
  ["03", "plain", "Когда едешь по прямой улице", "Позже тот же способ наблюдения", 10, 4],
  ["04", "plain", "После обычного перекрёстка", "Следующий шаг — понять", 8, 4],
  ["05", "plain", "У пешеходного перехода", "техническим характеристикам", 4, 4],
  ["06", "plain", "Мы увидели, что на дороге", "машина вообще перестаёт двигаться", 9, 5],
  ["07", "ts", "На дороге мы чаще замечаем", "когда после ожидания", 4, 4],
  ["08", "ts", "Мы уже разобрались", "Следующие дорожные ситуации", 3, 3],
];

function published(id, type) {
  return read(`site/lessons/ep${id}${type === "plain" ? "-plain" : ""}.html`);
}
function visibleText(fragment) {
  return fragment.replace(/<figure\b[\s\S]*?<\/figure>/g, "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

test("all eight main lessons open with a real situation, and answer an open question at the end", () => {
  const openingStarts = [];
  for (const [id, type, intro, end, figureCount, sectionCount] of episodes) {
    const html = published(id, type);
    assert.equal((html.match(/<!--AFTER-TICKETS-->/g) ?? []).length, 1, id);
    assert.equal((html.match(/<figure\b/g) ?? []).length, figureCount, id);
    assert.equal((html.match(/<h2\b/g) ?? []).length, sectionCount, id);
    const first = html.match(/^<h2\b[^>]*>[^<]+<\/h2>\s*<p data-editorial-role="course-context">([\s\S]*?)<\/p>/);
    assert.ok(first, `ep${id}: real contextual opening required before any figures`);
    const cleaned = visibleText(first[1]);
    assert.ok(cleaned.length > 260, `ep${id}: context too thin`);
    assert.ok(cleaned.includes(intro), `ep${id}: missing accepted narrative situation`);
    openingStarts.push(cleaned.slice(0, 48));
    assert.ok(html.includes(end), `ep${id}: missing next-question/resolution bridge`);
    if (id !== "03") {
      assert.equal((html.match(/data-editorial-role="course-bridge"/g) ?? []).length, 1, id);
      assert.ok(html.lastIndexOf('data-editorial-role="course-bridge"') > html.indexOf("<!--AFTER-TICKETS-->"), id);
    } else {
      assert.ok(html.indexOf('data-editorial-role="narrative-bridge"') > html.indexOf("<!--AFTER-TICKETS-->"), id);
      assert.ok(html.lastIndexOf('data-editorial-role="recap"') > html.indexOf("<!--AFTER-TICKETS-->"), id);
    }
  }
  assert.equal(new Set(openingStarts).size, 8, "one generic template repeated as eight prologues");
});

test("main ep01–ep06 literal sources reproduce the published reading editions exactly", () => {
  for (const [id] of episodes.slice(0, 6)) {
    const source = read(`content/lessons/ep${id}/plain.mjs`);
    const match = source.match(/return ("[\s\S]*");\s*}/);
    assert.ok(match, `ep${id} missing canonical literal renderer`);
    assert.equal(JSON.parse(match[1]), published(id, "plain"), `ep${id} source/site divergence`);
  }
});

test("bridges follow actual course concepts, while essential legal and evidence material remains", () => {
  const p = Object.fromEntries(episodes.map(([id, type]) => [id, published(id, type)]));
  for (const phrase of ["890 ДТП", "82 человека", "unece.org", "norm/st2-p1.html"]) assert.ok(p["01"].includes(phrase), phrase);
  for (const phrase of ["164 пешехода", "35% всех погибших", "№390", "№391", "matsne.gov.ge/ka/document/view/6970519"]) assert.ok(p["02"].includes(phrase), phrase);
  for (const phrase of ["№54", "№81", "№503", "norm/st36-p8.html", "ep03-recap-mobile.svg"]) assert.ok(p["03"].includes(phrase), phrase);
  for (const phrase of ["пешеходного перехода", "железнодорожный переезд", "населённого пункта"]) assert.ok(p["04"].includes(phrase), phrase);
  for (const phrase of ["№941", "№942", "велосипед"]) assert.ok(p["05"].includes(phrase), phrase);
  for (const phrase of ["№921", "№922", "трамвай"]) assert.ok(p["06"].includes(phrase), phrase);
  for (const phrase of ["№886", "№356", "вынужденной остановкой"]) assert.ok(p["07"].includes(phrase), phrase);
  for (const phrase of ["неожиданно", "преимущество", "манёвр"]) assert.ok(p["08"].includes(phrase), phrase);
  assert.ok(p["04"].includes('data-editorial-role="narrative-bridge"'));
  assert.ok(p["05"].includes('data-editorial-role="narrative-bridge"'));
  assert.ok(p["06"].includes('data-editorial-role="narrative-bridge"'));
  assert.ok(p["07"].includes('data-editorial-role="narrative-bridge"'));
  assert.ok(read("docs/course-narrative-blocks-0-1.md").includes("Сюжетная дуга выпуска за выпуском"));
});

test("source quote/citation panels and previous artwork are preserved", () => {
  for (const [id, type] of episodes) {
    const page = published(id, type);
    assert.ok(page.includes("<blockquote"), id);
    assert.ok(page.includes("<figcaption"), id);
    assert.ok(page.includes("<!--AFTER-TICKETS-->"), id);
    assert.doesNotMatch(page, /class="answers"|class="ansbtn"|class="scene-tabs"/, id);
  }
});
