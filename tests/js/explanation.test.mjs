import { test } from "node:test";
import assert from "node:assert/strict";
import { baseExplanationHtml } from "../../packages/domain/explanation.mjs";
import { questionText } from "../../packages/domain/items.mjs";

test("base explanation: Russian machine translation first (linked), Georgian original collapsed", () => {
  const t = { id: 1, ex: "36-ე მუხლი", ex_ru: "Согласно ст. 36 <Закона>", _r: { ex_ru: [[9, 15, "st36"]], ex: [[0, 10, "st36"]] } };
  const h = baseExplanationHtml(t);
  assert.ok(h.indexOf("машинный перевод") < h.indexOf("Согласно"));
  assert.match(h, /<a [^>]*href="norm\/st36\.html[^>]*>ст\. 36<\/a> &lt;Закона&gt;/);
  assert.match(h, /<details class="exka"><summary>оригинал \(KA\)<\/summary><div class="ka" lang="ka">.*36-ე მუხლი/);
  assert.ok(!/<details[^>]* open/.test(h), "collapsed by default");
});

test("base explanation: Georgian only when no translation; a note when the base has none", () => {
  assert.match(baseExplanationHtml({ ex: "ტექსტი" }), /только на грузинском.*<div class="ka" lang="ka">ტექსტი/s);
  assert.match(baseExplanationHtml({ ex: null }), /Пояснения в исходной базе нет/);
});

test("questionText: untranslated ticket with a machine translation is shown in Russian, Georgian as the original", () => {
  const eco = { id: 9, q: { ru: "ეკო?", ka: "ეკო?" }, a: { ru: ["ა", "ბ"], ka: ["ა", "ბ"] }, nu: ["ru", "en"], c: 1, mt: { q: "Эко?", a: ["А", "Б"] } };
  assert.deepEqual(questionText(eco), { q: "Эко?", a: ["А", "Б"], lang: "ru", untranslated: true, mt: true, ka: { q: "ეკო?", a: ["ა", "ბ"] } });
});
