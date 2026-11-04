import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

function publishedTexts(html) {
  return [...html.matchAll(/<div class="lawtext(?: [^"]*)?" lang="(?:ru|ka|en)">(.*?)<\/div>/gsu)].map((match) => match[1]);
}

const pageIds = readdirSync("site/norm")
  .filter((name) => name.endsWith(".html") && name !== "index.html")
  .map((name) => name.slice(0, -5))
  .sort();

test("st36-p4-v norm text matches the published page", async () => {
  const html = readFileSync("site/norm/st36-p4-v.html", "utf8");
  const expected = publishedTexts(html);
  assert.ok(expected.length >= 2, "published page has Russian and Georgian text");
  const { normTexts } = await import("../../packages/norm/text.ts");
  assert.deepEqual(normTexts("st36-p4-v"), expected);
});

test(`norm_pages ids=${pageIds.length}`, async () => {
  const { normPageIds, normTexts } = await import("../../packages/norm/text.ts");
  assert.deepEqual(normPageIds().sort(), pageIds);
  const mismatches = pageIds.filter((id) => {
    const expected = publishedTexts(readFileSync(`site/norm/${id}.html`, "utf8"));
    return JSON.stringify(normTexts(id)) !== JSON.stringify(expected);
  });
  assert.deepEqual(mismatches, []);
});
