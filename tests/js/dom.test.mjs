import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, plural, nq } from "../../web/assets/app/dom.mjs";

test("esc escapes HTML special characters", () => {
  assert.equal(esc(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assert.equal(esc(null), "");
});

test("Russian plural forms", () => {
  assert.deepEqual([1, 2, 5, 11, 21, 22, 25, 112].map(n => nq(n)),
    ["1 вопрос", "2 вопроса", "5 вопросов", "11 вопросов", "21 вопрос", "22 вопроса", "25 вопросов", "112 вопросов"]);
  assert.equal(plural(3, ["a", "b", "c"]), "b");
});
