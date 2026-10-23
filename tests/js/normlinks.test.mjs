import { test } from "node:test";
import assert from "node:assert/strict";
import { linkify, lk, chunkOf, placePanel, clip, lawDetails, normMatches } from "../../packages/domain/normlinks.mjs";

test("linkify escapes text and wraps annotated spans (UTF-16 offsets = JS indices)", () => {
  const t = "<b> ст. 5, п. 87 & знак 5.26";
  const out = linkify(t, [[4, 16, "st5-p87"], [19, 28, "sign-5.26"]], "../");
  assert.equal(out, '&lt;b&gt; <a class="nref" href="../norm/st5-p87.html" data-norm="st5-p87">ст. 5, п. 87</a> &amp; '
    + '<a class="nref" href="../norm/sign-5.26.html" data-norm="sign-5.26">знак 5.26</a>');
  const astral = "🚗 знак 5.26";
  assert.equal(linkify(astral, [[3, 12, "sign-5.26"]]), '🚗 <a class="nref" href="norm/sign-5.26.html" data-norm="sign-5.26">знак 5.26</a>');
});

test("linkify without annotations is plain escaping; bad spans are ignored", () => {
  assert.equal(linkify("a < b"), "a &lt; b");
  assert.equal(linkify(null), "");
  assert.equal(linkify("abc", [[2, 1, "x"], [0, 9, "y"], [0, 1, "../evil"]]), "abc");
});

test("lk reads the field's annotation from obj._r", () => {
  const o = { t: "см. ст. 39", _r: { t: [[4, 10, "st39"]] } };
  assert.match(lk(o, "t"), /href="norm\/st39\.html"/);
  assert.equal(lk({ t: "x" }, "t"), "x");
  assert.equal(lk(undefined, "t"), "");
});

test("chunkOf mirrors pdd.normids.chunk_of", () => {
  assert.equal(chunkOf("st37-p6-a-a"), "st37");
  assert.equal(chunkOf("st11_1-p2"), "st11_1");
  assert.equal(chunkOf("st5"), "st5");
  assert.equal(chunkOf("sign-5.19.1"), "sign-5");
  assert.equal(chunkOf("sign-3-notes2-zh-v"), "sign-3");
  assert.equal(chunkOf("mark-1.14.1"), "mark-1");
});

test("clip keeps short texts and cuts long ones at a word boundary", () => {
  assert.deepEqual(clip("короткий", 600), { text: "короткий", cut: false });
  const long = "слово ".repeat(200);
  const c = clip(long, 600);
  assert.ok(c.cut && c.text.length <= 601 && c.text.endsWith("…") && !c.text.endsWith(" …"));
});

const base = { vw: 1280, vh: 900, colLeft: 136, colRight: 916, anchorTop: 300, anchorBottom: 320, anchorLeft: 500, minW: 260, maxW: 340 };

test("placePanel: right margin beside the text column when there is room", () => {
  const p = placePanel(base);
  assert.equal(p.side, "right");
  assert.equal(p.left, 916 + 12);              // lesson column (780 px) in a 1280 px window
  assert.equal(p.width, 340);
  assert.equal(p.top, 300);
});

test("placePanel: left margin when the right one is too narrow", () => {
  const p = placePanel({ ...base, colLeft: 400, colRight: 1200 });
  assert.equal(p.side, "left");
  assert.equal(p.width, 340);
  assert.equal(p.left, 400 - 12 - 340);
});

test("placePanel: below (or above) the line when neither margin fits; clamped to the viewport", () => {
  const p = placePanel({ ...base, colLeft: 120, colRight: 1160, anchorLeft: 1100 });
  assert.equal(p.side, "below");
  assert.equal(p.top, 320 + 8);
  assert.ok(p.left + p.width <= 1280 - 8);
  const q = placePanel({ ...base, colLeft: 120, colRight: 1160, anchorTop: 800, anchorBottom: 820, panelH: 300 });
  assert.equal(q.side, "above");
  assert.equal(q.top, 800 - 8 - 300);
});

test("placePanel: side panel is kept inside the viewport vertically", () => {
  const p = placePanel({ ...base, anchorTop: 880, anchorBottom: 898, panelH: 400 });
  assert.equal(p.top, 900 - 400 - 8);
});

test("lawDetails: quote with links inside and the permalink of the quoted norm", () => {
  const h = lawDetails({ ref: "ст. 24, п. 6", text: "пунктами 2 и <5>", n: "st24-p6", _r: { text: [[0, 10, "st24-p2"]] } });
  assert.match(h, /^<details class="law"><summary>ст\. 24, п\. 6<\/summary>/);
  assert.match(h, /<a class="nref" href="norm\/st24-p2\.html" data-norm="st24-p2">пунктами 2<\/a> и &lt;5&gt;/);
  assert.match(h, /href="norm\/st24-p6\.html">Постоянная ссылка/);
  assert.doesNotMatch(lawDetails({ ref: "x", text: "y" }), /Постоянная/);
});

test("normMatches: citations as prefixes, numbers as whole numbers, words anywhere", () => {
  assert.ok(normMatches("ст. 37, п. 6", "ст. 37, п. 6"));
  assert.ok(normMatches("ст. 37, п. 6", "ст. 37, п. 6 «а.а»"));
  assert.ok(!normMatches("ст. 37, п. 6", "ст. 37, п. 16"));
  assert.ok(!normMatches("ст. 37, п. 6", "ст. 3, п. 76"));
  assert.ok(normMatches("5.19", "знак 5.19.1"));
  assert.ok(!normMatches("5.1", "знак 5.19.1"));
  assert.ok(normMatches("5.19.1", "знак 5.19.1"));
  assert.ok(normMatches("Остановка", "ст. 37, п. 1", "Остановка и стоянка запрещаются"));
  assert.ok(normMatches("пешеход", "ст. 5, п. 87", "Пешеход – участник"));
  assert.ok(normMatches("  ", "что угодно"));
  assert.ok(!normMatches("самолёт", "ст. 5, п. 87", "Пешеход – участник"));
});
