import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { critiqueErrors } from "../../packages/lesson/critique.ts";
import { lessonFiles } from "../../packages/lesson/files.ts";

function squash(text) {
  return text.replace(/-\n/g, "-").replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();
}

function statute(path) {
  const footer = /\s*http:\/\/www\.matsne\.gov\.ge\s+\d+\s*/g;
  return squash(readFileSync(path, "utf8").replace(footer, " "));
}

const ru = statute("data/sources/law_ru_matsne_pub36_2026-06-25.txt") + " " + statute("data/sources/annexes_ru_matsne_pub36.txt");
const ka = statute("data/sources/law_ka_matsne_pub36_2026-06-25.txt");

function quotes(html, src) {
  return [...html.matchAll(new RegExp(`<blockquote class="lq" data-src="${src}"[^>]*><p>(.*?)</p>`, "gs"))].map((match) => (
    squash(match[1].replace(/<[^>]+>/g, "")).replace(/^«|»$/g, "")
  ));
}

test("published lesson quotes are verbatim, and ep07 has no characters", () => {
  for (const [rel, html] of Object.entries(lessonFiles())) {
    const missing = quotes(html, "law").filter((quote) => quote && !ru.includes(quote));
    assert.deepEqual(missing, [], rel);
    const georgian = quotes(html, "ka").filter((quote) => quote && !ka.includes(quote));
    assert.deepEqual(georgian, [], rel);
  }
  const ep07 = lessonFiles()["lessons/ep07.html"];
  assert.equal((ep07.match(/<aside class="ask"/g) || []).length, 5);
  assert.equal((ep07.match(/<figure class="fig">/g) || []).length, 3);
  assert.equal(ep07.includes("Аня") || ep07.includes("Макс") || ep07.includes("Сергей"), false);
  assert.ok(ep07.includes("<!--AFTER-TICKETS-->"));
});

test("ep07 critiques name a norm and do not store it as the norm text", () => {
  const records = JSON.parse(readFileSync("content/critiques/ep07.json", "utf8"));
  assert.deepEqual(critiqueErrors(records), []);
  const html = lessonFiles()["lessons/ep07.html"];
  const kinds = new Set(records.map((record) => record.kind));
  for (const kind of ["translation", "boundary", "silence", "variation", "naive"]) assert.ok(kinds.has(kind));
  for (const record of records) {
    assert.match(html, new RegExp(`id="${record.anchor}"`));
    if (record.kind === "translation") {
      assert.ok(ru.includes(record.ru));
      assert.ok(ka.includes(record.ka));
      assert.ok(record.ka.includes("თუ ეს აუცილებელი არ არის"));
      assert.ok(html.includes(record.ru));
      assert.ok(html.includes("თუ ეს აუცილებელი არ არის"));
    }
  }
});
