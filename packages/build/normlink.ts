import { explicitCites, findRu, lawId, resolveRu, type NormRef } from "../lesson/normref.ts";
import { slug } from "../lesson/slug.ts";
import type { Json } from "./pyjson.ts";
import { findKa, resolveKa } from "./normref-ka.ts";

type Cite = [string, string | null];
type Span = [number, number, string];
type Bag = Record<string, any>;
type Hit = { start: number; end: number; text: string; status: string; norm: string | null };

const BLOCKS = new Set(["p", "li", "blockquote", "figcaption", "td", "th", "h1", "h2", "h3", "h4", "dd", "dt", "div", "section", "article"]);
const SKIP = new Set(["a", "svg", "summary", "script", "style", "button", "code", "title"]);
const INLINE = new Set(["a", "b", "i", "em", "strong", "span", "small", "sup", "sub", "mark", "abbr", "u", "s", "kbd", "q"]);
const VOID = new Set(["img", "br", "hr", "input", "source", "meta", "link", "wbr", "col", "area", "track"]);
const SEP = "\u0000";
const TOKEN = /<!--[\s\S]*?-->|<[^>]*>|[^<]+/g;
const SUBPOINT = /^st\d+(_\d+)?-p\d+-/;

export type LinkNorm = { id: string; ka?: string; ru?: string; article?: string };

export type LinkCourse = {
  norms: LinkNorm[];
  episodes: Bag[];
  lessons: Record<string, string>;
  plains: Record<string, string>;
  laws: [string, Bag][];
  tickets: Bag[];
  banks: { norms: string[]; unresolved: string[] }[];
  items: Bag[];
  misconceptions: Record<string, Bag>;
  skipExRu: Set<number>;
};

export function linkCourse(input: LinkCourse): Map<string, Json> {
  const linker = new Linker(input.norms);
  const articles = new Map(input.norms.map((norm) => [norm.id, norm.article ?? null]));
  const lessons = { ...input.lessons };
  const scopeOf = new Map<string, Cite[]>();
  for (const episode of input.episodes) {
    const cited = linker.cites([
      episode.lead,
      ...(episode.points ?? []).map((point: Bag) => `${point.t} ${point.c}`),
      ...(episode.law_quotes ?? []).map((quote: Bag) => quote.ref),
      episode.core_note,
      episode.linked_note,
      episode.video_note,
    ]);
    if (lessons[episode.id] != null) lessons[episode.id] = linker.linkHtml("lessons", episode.id, lessons[episode.id], [cited]);
    if (input.plains[episode.id] != null) {
      input.plains[episode.id] = linker.linkHtml("lessons", `${episode.id}:plain`, input.plains[episode.id], [cited]);
    }
    const fromLesson = linker.cites([(lessons[episode.id] ?? "").replace(/<[^>]+>/g, SEP)]);
    scopeOf.set(episode.id, [...cited, ...fromLesson]);
    linker.ruFields("episodes", episode.id, episode, ["lead", "core_note", "linked_note", "video_note"], [cited, fromLesson]);
    for (const point of episode.points ?? []) linker.ruFields("episodes", episode.id, point, ["t", "c"], [cited, fromLesson]);
    for (const quote of episode.law_quotes ?? []) linkQuote(linker, "episodes", episode.id, quote, articles);
  }
  for (const [key, quote] of input.laws) linkLaw(linker, key, quote, articles);
  input.tickets.forEach((ticket, index) => linkTicket(linker, ticket, input.banks[index], input.skipExRu, scopeOf, articles));
  for (const item of input.items) {
    const norm = quoteNorm(item.quote.ref, linker.ids);
    if (norm) item.quote.n = slug(norm);
    const article = norm && !norm.startsWith("A") ? articles.get(norm) ?? null : null;
    linker.ruFields("own_items", item.id, item, ["explain"], [linker.cites([item.quote.ref]), scopeOf.get(item.lesson) ?? []]);
    linker.ruFields("own_items", item.id, item.quote, ["text"], [], article, norm);
  }
  for (const [id, row] of Object.entries(input.misconceptions)) linker.ruFields("misconceptions", id, row, ["belief", "truth"]);
  for (const norm of input.norms) {
    if (!norm.ru) continue;
    linker.ruSpans("norm_pages", norm.id, norm.ru, [], norm.id.startsWith("A") ? null : norm.article ?? null, norm.id);
  }
  return linker.report();
}

class Linker {
  readonly ids: Set<string>;
  private readonly kaText: Map<string, string>;
  private readonly stats = new Map<string, Map<string, number>>();
  private readonly misses = new Map<string, [string, string, string][]>();
  private readonly linked = new Map<string, Set<string>>();

  constructor(norms: LinkNorm[]) {
    this.ids = new Set(norms.map((norm) => norm.id));
    this.kaText = new Map(norms.map((norm) => [norm.id, norm.ka ?? ""]));
  }

  cites(texts: (string | null | undefined)[]): Cite[] {
    const out: Cite[] = [];
    for (const text of texts) if (text) out.push(...explicitCites(findRu(text)));
    return out;
  }

  ruFields(ctype: string, key: string | number, obj: Bag, fields: string[], scopes: Cite[][] = [], ownArticle: string | null = null, selfId: string | null = null): void {
    const found = new Map<string, NormRef[]>();
    for (const field of fields) {
      const text = obj[field];
      if (typeof text === "string" && text) found.set(field, findRu(text));
    }
    const block: Cite[] = [];
    for (const refs of found.values()) block.push(...explicitCites(refs));
    const ann: Record<string, Span[]> = {};
    for (const [field, refs] of found) {
      resolveRu(refs, this.ids, [block, ...scopes], ownArticle);
      this.record(ctype, key, refs, selfId);
      const spans = linkedSpans(obj[field], refs);
      if (spans.length) ann[field] = spans;
    }
    if (Object.keys(ann).length) Object.assign(obj._r ??= {}, ann);
  }

  kaField(ctype: string, key: string | number, obj: Bag, field: string, confirmed: string[], strict: boolean): void {
    const text = obj[field];
    if (typeof text !== "string" || !text) return;
    const refs = resolveKa(findKa(text), this.ids, this.kaText, confirmed, strict);
    this.record(ctype, key, refs, null);
    const spans = linkedSpans(text, refs);
    if (spans.length) (obj._r ??= {})[field] = spans;
  }

  ruSpans(ctype: string, key: string, text: string, scopes: Cite[][] = [], ownArticle: string | null = null, selfId: string | null = null): Span[] {
    const refs = findRu(text);
    resolveRu(refs, this.ids, [explicitCites(refs), ...scopes], ownArticle);
    this.record(ctype, key, refs, selfId);
    return linkedSpans(text, refs);
  }

  linkHtml(ctype: string, key: string, html: string, scopes: Cite[][] = []): string {
    const tokens = html.match(TOKEN) ?? [];
    TOKEN.lastIndex = 0;
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
    const found: [number, string, [number, number, string, boolean][], NormRef[]][] = [];
    for (const parts of blocks.values()) {
      let joined = "";
      let previous: number | null = null;
      const offsets: [number, number, string, boolean][] = [];
      for (const [index, text, , ok] of parts) {
        if (previous !== null && tokens.slice(previous + 1, index).some(breaks)) joined += SEP;
        offsets.push([joined.length, index, text, ok]);
        joined += text;
        previous = index;
      }
      found.push([parts[0][2], joined, offsets, findRu(joined)]);
    }
    const sectionCites = new Map<number, Cite[]>();
    const doc: Cite[] = [];
    for (const [sec, , , refs] of found) {
      const cites = explicitCites(refs);
      sectionCites.set(sec, [...(sectionCites.get(sec) ?? []), ...cites]);
      doc.push(...cites);
    }
    const edits = new Map<number, Span[]>();
    for (const [sec, , offsets, refs] of found) {
      resolveRu(refs, this.ids, [explicitCites(refs), sectionCites.get(sec) ?? [], doc, ...scopes]);
      for (const item of refs) {
        if (item.status !== "linked") continue;
        const host = offsets.find(([offset, , text,]) => offset <= item.start && item.end <= offset + text.length);
        if (!host || !host[3]) {
          item.status = host ? "unlinkable" : "split";
          continue;
        }
        const spans = edits.get(host[1]) ?? [];
        spans.push([item.start - host[0], item.end - host[0], slug(item.norm ?? "")]);
        edits.set(host[1], spans);
      }
      this.record(ctype, key, refs, null);
    }
    for (const [index, spans] of edits) tokens[index] = renderLinked(unescapeText(tokens[index]), spans);
    return tokens.join("");
  }

  report(): Map<string, Json> {
    return new Map<string, Json>([
      ["stats", sortedMap(this.stats, (counts) => sortedMap(counts, (count) => count))],
      ["not_linked", sortedMap(this.misses, (rows) => unique(rows).sort(byTriple))],
      ["linked", sortedMap(this.linked, (lines) => [...lines].sort(byCodePoint))],
    ]);
  }

  private record(ctype: string, key: string | number, refs: Hit[], selfId: string | null): void {
    const id = String(key);
    for (const ref of refs) {
      if (ref.status === "linked" && ref.norm === selfId) ref.status = "self";
      if (ref.status === "self") continue;
      const counts = this.stats.get(ctype) ?? new Map<string, number>();
      counts.set(ref.status, (counts.get(ref.status) ?? 0) + 1);
      this.stats.set(ctype, counts);
      if (ref.status === "linked") {
        const lines = this.linked.get(ctype) ?? new Set<string>();
        lines.add(`${id} | ${ref.text} → ${ref.norm ?? "None"}`);
        this.linked.set(ctype, lines);
        continue;
      }
      const rows = this.misses.get(ctype) ?? [];
      rows.push([id, ref.text, ref.status]);
      this.misses.set(ctype, rows);
    }
  }
}

function linkTicket(linker: Linker, ticket: Bag, bank: { norms: string[]; unresolved: string[] }, skipExRu: Set<number>, scopeOf: Map<string, Cite[]>, articles: Map<string, string | null>): void {
  linker.kaField("tickets_ka", ticket.id, ticket, "ex", bank.norms, bank.unresolved.length > 0);
  if (ticket.ex_ru && !skipExRu.has(ticket.id)) {
    linker.ruFields("tickets_mt", ticket.id, ticket, ["ex_ru"]);
    trustMt(ticket);
  }
  if (ticket.why) linker.ruFields("typical_errors", ticket.id, ticket, ["why"], [scopeOf.get(ticket.lesson) ?? []]);
  if (ticket.br) linkBreakdown(linker, ticket, articles);
}

function linkBreakdown(linker: Linker, ticket: Bag, articles: Map<string, string | null>): void {
  const breakdown = ticket.br;
  const scope = linker.cites(breakdown.quotes.map((quote: Bag) => quote.ref));
  for (const quote of breakdown.quotes) {
    const norm = quote.norm as string;
    delete quote.norm;
    quote.n = slug(norm);
    linker.ruFields("breakdowns", ticket.id, quote, ["text"], [], articles.get(norm) ?? null, norm);
  }
  const parts = [...breakdown.steps, ...breakdown.why_not, ...(breakdown.trap ? [breakdown.trap] : [])];
  for (const part of parts) linker.ruFields("breakdowns", ticket.id, part, ["t"], [scope]);
}

function linkQuote(linker: Linker, ctype: string, key: string, quote: Bag, articles: Map<string, string | null>): void {
  const norm = quoteNorm(quote.ref, linker.ids);
  if (norm) quote.n = slug(norm);
  const article = norm && !norm.startsWith("A") ? articles.get(norm) ?? null : null;
  linker.ruFields(ctype, key, quote, ["text"], [], article, norm);
}

function linkLaw(linker: Linker, key: string, quote: Bag, articles: Map<string, string | null>): void {
  const norm = lawKeyNorm(key, linker.ids);
  if (norm) quote.n = slug(norm);
  const article = norm && !norm.startsWith("A") ? articles.get(norm) ?? null : null;
  linker.ruFields("ticket_laws", key, quote, ["text"], [], article, norm);
}

function quoteNorm(ref: string, ids: Set<string>): string | null {
  const law = /^ст\. (\S+?)(?:, п\. (\S+))?$/.exec(ref);
  if (law) return lawId(law[1], law[2] ?? null, null, ids);
  const annex = /^Приложение (\d) \([^)]+\), п\. (\S+)$/.exec(ref);
  if (!annex) return null;
  const id = `A${annex[1]}:${annex[2]}`;
  return ids.has(id) ? id : null;
}

function lawKeyNorm(key: string, ids: Set<string>): string | null {
  const rest = key.slice(1);
  const dot = rest.indexOf(".");
  if (key.startsWith("L")) return lawId(dot < 0 ? rest : rest.slice(0, dot), dot < 0 ? null : rest.slice(dot + 1), null, ids);
  const id = `A${dot < 0 ? rest : rest.slice(0, dot)}:${dot < 0 ? "" : rest.slice(dot + 1)}`;
  return ids.has(id) ? id : null;
}

function trustMt(ticket: Bag): void {
  const ann = ticket._r;
  if (!ann?.ex_ru) return;
  const known = new Set((ann.ex ?? []).map((span: Span) => span[2]));
  const keep = ann.ex_ru.filter((span: Span) => known.has(span[2]) || !SUBPOINT.test(span[2]));
  if (keep.length) ann.ex_ru = keep;
  else delete ann.ex_ru;
}

function linkedSpans(text: string, refs: Hit[]): Span[] {
  return refs.filter((ref) => ref.status === "linked" && ref.norm).map((ref) => [utf16(text, ref.start), utf16(text, ref.end), slug(ref.norm ?? "")]);
}

function utf16(text: string, index: number): number {
  let point = 0;
  let unit = 0;
  for (const char of text) {
    if (point === index) return unit;
    point += 1;
    unit += char.length;
  }
  return unit;
}

function renderLinked(text: string, spans: Span[]): string {
  let out = "";
  let pos = 0;
  for (const [start, end, id] of [...spans].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    out += escapeText(text.slice(pos, start));
    out += `<a class="nref" href="norm/${id}.html" data-norm="${id}">${escapeText(text.slice(start, end))}</a>`;
    pos = end;
  }
  return out + escapeText(text.slice(pos));
}

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

function breaks(tag: string): boolean {
  if (!tag.startsWith("<") || tag.startsWith("<!--")) return false;
  const name = tag.match(/^<\/?\s*([a-zA-Z][\w-]*)/)?.[1]?.toLowerCase();
  return !name || !INLINE.has(name);
}

function sortedMap<T>(source: Map<string, T>, value: (item: T) => Json): Map<string, Json> {
  const out = new Map<string, Json>();
  for (const key of [...source.keys()].sort(byCodePoint)) out.set(key, value(source.get(key) as T));
  return out;
}

function unique(rows: [string, string, string][]): [string, string, string][] {
  const seen = new Set<string>();
  const out: [string, string, string][] = [];
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function byTriple(left: string[], right: string[]): number {
  for (let i = 0; i < 3; i += 1) {
    const cmp = byCodePoint(left[i], right[i]);
    if (cmp) return cmp;
  }
  return 0;
}

function byCodePoint(left: string, right: string): number {
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const a = left.codePointAt(i) ?? 0;
    const b = right.codePointAt(j) ?? 0;
    if (a !== b) return a - b;
    i += a > 0xffff ? 2 : 1;
    j += b > 0xffff ? 2 : 1;
  }
  return left.length - right.length;
}
