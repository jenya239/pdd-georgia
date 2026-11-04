import { slug } from "./slug.ts";
import { explicitCites, findRu, resolveRu, type NormRef } from "./normref.ts";

const BLOCKS = new Set(["p", "li", "blockquote", "figcaption", "td", "th", "h1", "h2", "h3", "h4", "dd", "dt", "div", "section", "article"]);
const SKIP = new Set(["a", "svg", "summary", "script", "style", "button", "code", "title"]);
const INLINE = new Set(["a", "b", "i", "em", "strong", "span", "small", "sup", "sub", "mark", "abbr", "u", "s", "kbd", "q"]);
const VOID = new Set(["img", "br", "hr", "input", "source", "meta", "link", "wbr", "col", "area", "track"]);
const SEP = "\u0000";
const TOKEN = /<!--.*?-->|<[^>]*>|[^<]+/gsu;

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function unescapeText(value: string): string {
  return value.replaceAll(/&#(\d+);|&#x([0-9a-fA-F]+);|&quot;|&lt;|&gt;|&amp;/g, (all, dec, hex) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    if (all === "&quot;") return "\"";
    if (all === "&lt;") return "<";
    if (all === "&gt;") return ">";
    return "&";
  });
}

function anchor(text: string, id: string, hrefPrefix: string): string {
  return `<a class="nref" href="${hrefPrefix}${id}.html" data-norm="${id}">${escapeText(text)}</a>`;
}

function renderLinked(text: string, spans: [number, number, string][], hrefPrefix: string): string {
  let out = "";
  let pos = 0;
  for (const [start, end, id] of [...spans].sort((a, b) => a[0] - b[0])) {
    out += escapeText(text.slice(pos, start));
    out += anchor(text.slice(start, end), id, hrefPrefix);
    pos = end;
  }
  return out + escapeText(text.slice(pos));
}

function breaks(tag: string): boolean {
  if (!tag.startsWith("<") || tag.startsWith("<!--")) return false;
  const name = tag.match(/^<\/?\s*([a-zA-Z][\w-]*)/)?.[1]?.toLowerCase();
  return !name || !INLINE.has(name);
}

export function lessonHtml(html: string, ids: Set<string>, scopes: [string, string | null][][] = [], hrefPrefix = "norm/"): string {
  const tokens = html.match(TOKEN) ?? [];
  const stack: [string, number][] = [];
  const texts: [number, string, number, number, boolean][] = [];
  let section = 0;
  tokens.forEach((token, index) => {
    if (token.startsWith("<!--")) return;
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim().toLowerCase();
      for (let at = stack.length - 1; at >= 0; at -= 1) {
        if (stack[at][0] === name) {
          stack.splice(at);
          break;
        }
      }
      return;
    }
    if (token.startsWith("<")) {
      const name = token.match(/^<\s*([a-zA-Z][\w-]*)/)?.[1]?.toLowerCase();
      if (!name) return;
      if (name === "h2") section += 1;
      if (!VOID.has(name) && !token.endsWith("/>")) stack.push([name, index]);
      return;
    }
    const names = stack.map(([tag]) => tag);
    const quote = stack.find(([tag]) => tag === "blockquote");
    const block = quote ? quote[1] : [...stack].reverse().find(([tag]) => BLOCKS.has(tag))?.[1] ?? -1;
    texts.push([index, unescapeText(token), block, section, !names.some((tag) => SKIP.has(tag))]);
  });
  const blocks = new Map<number, [number, string, number, boolean][]>();
  for (const [index, text, block, sec, ok] of texts) {
    const parts = blocks.get(block) ?? [];
    parts.push([index, text, sec, ok]);
    blocks.set(block, parts);
  }
  const found: [number, number, string, [number, number, string, boolean][], NormRef[]][] = [];
  for (const [block, parts] of blocks) {
    let joined = "";
    let previous: number | null = null;
    const offsets: [number, number, string, boolean][] = [];
    for (const [index, text, , ok] of parts) {
      if (previous !== null && tokens.slice(previous + 1, index).some(breaks)) joined += SEP;
      offsets.push([joined.length, index, text, ok]);
      joined += text;
      previous = index;
    }
    found.push([block, parts[0][2], joined, offsets, findRu(joined)]);
  }
  const sectionCites = new Map<number, [string, string | null][]>();
  const doc: [string, string | null][] = [];
  for (const [, sec, , , refs] of found) {
    const cites = explicitCites(refs);
    sectionCites.set(sec, [...(sectionCites.get(sec) ?? []), ...cites]);
    doc.push(...cites);
  }
  const edits = new Map<number, [number, number, string][]>();
  for (const [, sec, , offsets, refs] of found) {
    resolveRu(refs, ids, [explicitCites(refs), sectionCites.get(sec) ?? [], doc, ...scopes]);
    for (const item of refs) {
      if (item.status !== "linked" || !item.norm) continue;
      const host = offsets.find(([offset, , text, ]) => offset <= item.start && item.end <= offset + text.length);
      if (!host || !host[3]) {
        item.status = host ? "unlinkable" : "split";
        continue;
      }
      const [offset, index] = host;
      const spans = edits.get(index) ?? [];
      spans.push([item.start - offset, item.end - offset, slug(item.norm)]);
      edits.set(index, spans);
    }
  }
  for (const [index, spans] of edits) tokens[index] = renderLinked(unescapeText(tokens[index]), spans, hrefPrefix);
  return tokens.join("");
}
