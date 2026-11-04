import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const marker = Buffer.from("<!--AFTER-TICKETS-->");
const pages = {
  ep01: "site/lessons/ep01-plain.html",
  ep02: "site/lessons/ep02-plain.html",
  ep03: "site/lessons/ep03-plain.html",
  ep04: "site/lessons/ep04.html",
  ep05: "site/lessons/ep05.html",
  ep06: "site/lessons/ep06.html",
};

function theoryHash(htmlPath) {
  const html = readFileSync(htmlPath);
  const at = html.indexOf(marker);
  assert.ok(at > 0, `${htmlPath} has no theory marker`);
  return createHash("sha256").update(html.subarray(0, at)).digest("hex");
}

for (const [id, page] of Object.entries(pages)) {
  test(`${id} theory hash matches the saved fixture`, () => {
    const expected = readFileSync(new URL(`./fixtures/${id}-theory.sha256`, import.meta.url), "utf8").trim();
    assert.equal(theoryHash(page), expected);
  });

  test(`Node ${id} theory matches the saved fixture`, async () => {
    const expected = readFileSync(new URL(`./fixtures/${id}-theory.sha256`, import.meta.url), "utf8").trim();
    const { lessonTheory } = await import("../../packages/lesson/theory.ts");
    const hash = createHash("sha256").update(lessonTheory(id)).digest("hex");
    assert.equal(hash, expected);
  });
}
