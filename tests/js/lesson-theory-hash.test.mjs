import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const marker = Buffer.from("<!--AFTER-TICKETS-->");

function theoryHash(htmlPath) {
  const html = readFileSync(htmlPath);
  const at = html.indexOf(marker);
  assert.ok(at > 0, `${htmlPath} has no theory marker`);
  return createHash("sha256").update(html.subarray(0, at)).digest("hex");
}

test("ep04 theory hash matches the saved fixture", () => {
  const expected = readFileSync(new URL("./fixtures/ep04-theory.sha256", import.meta.url), "utf8").trim();
  assert.equal(theoryHash("site/lessons/ep04.html"), expected);
});

test("Node ep04 theory matches the saved fixture", async () => {
  const expected = readFileSync(new URL("./fixtures/ep04-theory.sha256", import.meta.url), "utf8").trim();
  const { ep04Theory } = await import("../../packages/lesson/ep04.ts");
  const hash = createHash("sha256").update(ep04Theory()).digest("hex");
  assert.equal(hash, expected);
});
