import { test } from "node:test";
import assert from "node:assert/strict";
import { breakdownHtml } from "../../packages/domain/breakdown.mjs";

const BR = {
  steps: [{ t: "Вопрос — ст. 5, п. 9.", _r: { t: [[9, 20, "st5-p9"]] } }, { t: "Ответ <3>." }],
  quotes: [{ ref: "ст. 5, п. 9", n: "st5-p9", text: "Разделительная полоса – элемент" }],
  why_not: [{ i: 0, t: "Это проезжая часть.", mc: "mc-x" }, { i: 1, t: "Это полоса.", mc: null }],
  trap: { t: "Слово «конструктивно»." },
  lesson: { id: "ep02", num: 2, title: "Дорога" }, concepts: ["Разделительная полоса"],
};

test("breakdown (the «Разбор» tab body) has steps, linked quote, wrong options, trap and links", () => {
  const h = breakdownHtml(BR, { "mc-x": { belief: "Любая часть дороги" } });
  assert.match(h, /^<div class="br"><ol class="steps">/);
  assert.doesNotMatch(h, /<details|<summary/);
  assert.match(h, /<ol class="steps"><li>Вопрос — <a class="nref" href="norm\/st5-p9.html" data-norm="st5-p9">ст. 5, п. 9<\/a>.<\/li><li>Ответ &lt;3&gt;.<\/li><\/ol>/);
  assert.match(h, /<blockquote class="lawquote"><div class="small mut"><a class="nref" href="norm\/st5-p9.html" data-norm="st5-p9">ст. 5, п. 9<\/a> — дословно/);
  assert.match(h, /<li><b>1\.<\/b> Это проезжая часть\. <span class="small mut">Типичная ошибка: «Любая часть дороги»<\/span><\/li>/);
  assert.match(h, /<li><b>2\.<\/b> Это полоса\.<\/li>/);
  assert.match(h, /<b>Ловушка:<\/b> Слово «конструктивно»\./);
  assert.match(h, /<a href="episode.html\?id=ep02">Выпуск 2. Дорога<\/a> · Разделительная полоса/);
});

test("no trap → no trap line; unknown misconception id → no hint", () => {
  const h = breakdownHtml({ ...BR, trap: undefined }, {});
  assert.doesNotMatch(h, /Ловушка|Типичная ошибка/);
});
