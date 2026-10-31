/** Norm references in site text: build-time annotations → links, chunk names, and where the hover panel goes.
 *  Annotations come from tools/pdd/normlink.py: obj._r[field] = [[start, end, slug], ...] in UTF-16 units (= JS string indices). */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);
const SLUG = /^(st[\d_]+|sign|mark)(-[\w.]+)*$/;

export function anchor(text, slug, root = "") {
  return `<a class="nref" href="${root}norm/${slug}.html" data-norm="${slug}">${esc(text)}</a>`;
}

/** Escaped HTML of `text` with its annotated spans as norm links (spans out of order, out of range or with odd slugs are skipped). */
export function linkify(text, spans, root = "") {
  const s = String(text ?? "");
  let out = "", pos = 0;
  for (const [a, b, slug] of [...(spans || [])].sort((x, y) => x[0] - y[0])) {
    if (!(a >= pos && b > a && b <= s.length && SLUG.test(slug))) continue;
    out += esc(s.slice(pos, a)) + anchor(s.slice(a, b), slug, root);
    pos = b;
  }
  return out + esc(s.slice(pos));
}

/** linkify(obj[field]) with the annotation stored next to it. */
export const lk = (obj, field, root = "") => linkify(obj?.[field], obj?._r?.[field], root);

/** The lazily loaded JSON chunk holding a norm (mirrors pdd.normids.chunk_of): its article or its annex section. */
export function chunkOf(slug) {
  if (slug.startsWith("st")) return slug.split("-")[0];
  const [head, rest] = [slug.slice(0, slug.indexOf("-")), slug.slice(slug.indexOf("-") + 1)];
  return `${head}-${rest.match(/^\d+/)[0]}`;
}

/** Long law texts are shortened in the panel (the full text is one click away). */
export function clip(text, max = 600) {
  const s = String(text ?? "");
  if (s.length <= max) return { text: s, cut: false };
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return { text: (sp > max * 0.7 ? cut.slice(0, sp) : cut).replace(/[\s,;:–—-]+$/, "") + "…", cut: true };
}

/** Where the panel goes, in viewport pixels: in the margin right of the text column, else left of it, else below/above the line.
 *  Returns {side, left, top, width}. */
export function placePanel({ vw, vh, colLeft, colRight, anchorTop, anchorBottom, anchorLeft, minW = 260, maxW = 340, panelH = 240, gap = 12, margin = 8 }) {
  const clampTop = t => Math.max(margin, Math.min(t, vh - panelH - margin));
  const right = vw - colRight - gap - margin;
  if (right >= minW) {
    const width = Math.min(maxW, right);
    return { side: "right", left: colRight + gap, top: clampTop(anchorTop), width };
  }
  const leftRoom = colLeft - gap - margin;
  if (leftRoom >= minW) {
    const width = Math.min(maxW, leftRoom);
    return { side: "left", left: colLeft - gap - width, top: clampTop(anchorTop), width };
  }
  const width = Math.min(maxW, vw - 2 * margin);
  const left = Math.max(margin, Math.min(anchorLeft, vw - width - margin));
  if (anchorBottom + 8 + panelH <= vh - margin || anchorTop - 8 - panelH < margin)
    return { side: "below", left, top: anchorBottom + 8, width };
  return { side: "above", left, top: anchorTop - 8 - panelH, width };
}

/** A collapsible law quote {ref, title?, text, n?, _r?}: auto-linked text plus the permanent page of the quoted norm (n = slug). */
export function lawDetails(q, root = "") {
  const perma = q.n && SLUG.test(q.n) ? `<a class="small nperma" href="${root}norm/${q.n}.html">Постоянная ссылка на норму →</a>` : "";
  return `<details class="law"><summary>${esc(q.ref)}${q.title ? " — " + esc(q.title) : ""}</summary><div class="lawtext">${lk(q, "text", root)}</div>${perma}</details>`;
}

const fold = s => String(s ?? "").toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}.]+/gu, " ").replace(/\.(?=\s|$)/g, "").replace(/\s+/g, " ").trim();

/** Norm index search: a citation prefix («ст. 37, п. 6», «5.19») or words of the text («остановка»). */
export function normMatches(query, label, text = "") {
  const q = fold(query);
  if (!q) return true;
  const L = fold(label);
  if ((" " + L + " ").includes(" " + q + " ") || (" " + L).includes(" " + q + ".") || L.startsWith(q + " ")) return true;
  const hay = " " + L + " " + fold(text) + " ";
  return q.split(" ").every(w => (/^[\d.]+$/.test(w) ? hay.includes(" " + w + " ") || hay.includes(" " + w + ".") : hay.includes(w)));
}
