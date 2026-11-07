import { citation } from "../norm/cite.ts";
import { slug } from "../lesson/slug.ts";
import { ruleFor } from "./items.ts";
import { score } from "./ticket-record.ts";

const ANNEX_NAME: Record<string, string> = { "1": "Приложение 1 (знаки)", "2": "Приложение 2 (разметка)" };

export type CopySpec = { dest: string; source: string };

export function lessonAssetRefs(html: string, prefix: string): string[] {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const refs = html.matchAll(new RegExp(`(?:src|href)="${escaped}([^"/]+)"`, "g"));
  return [...new Set([...refs].map((match) => match[1]))].sort();
}

export function signImage(id: string): string | null {
  if (!id.startsWith("A")) return null;
  const colon = id.indexOf(":");
  const annex = id.slice(1, colon);
  const item = id.slice(colon + 1);
  if (item.includes("прим")) return null;
  const kind = annex === "1" ? "sign" : "mark";
  return `${kind}_${item.replaceAll(".", "_")}.png`;
}

export function lessonAssetSource(lessonId: string, name: string, inLesson: boolean): string {
  return inLesson ? `content/lessons/${lessonId}/${name}` : `content/assets/signs/${name}`;
}

export function mediaSource(rel: string): string | null {
  if (rel.startsWith("lessons/")) return `content/lessons/${rel.slice("lessons/".length)}`;
  if (rel.startsWith("media/")) return `content/${rel}`;
  return null;
}

export function ticketImageSource(img: string): string {
  const name = img.split("/").pop() ?? img;
  return `data/tickets/images/${name}`;
}

export function planCopies(input: {
  lessonAssets: CopySpec[];
  media: CopySpec[];
  ticketImages: CopySpec[];
  webFiles: string[];
  signs: string[];
}): CopySpec[] {
  return [
    ...input.lessonAssets,
    ...input.media,
    ...input.ticketImages,
    ...input.webFiles.map((rel) => ({ dest: rel, source: `web/${rel}` })),
    ...input.signs.map((name) => ({ dest: `norm/img/${name}`, source: `content/assets/signs/${name}` })),
  ];
}

export function lawQuotes(records: Map<string, unknown>[], ru: ArticleIndex, annexRu: AnnexIndex): Map<string, LawQuote> {
  const laws = new Map<string, LawQuote>();
  for (const record of records) {
    const keys = record.get("law");
    if (!Array.isArray(keys)) continue;
    for (const key of keys) {
      if (typeof key === "string" && !laws.has(key)) laws.set(key, quoteForKey(key, ru, annexRu));
    }
  }
  return laws;
}

export function episodeQuotes(episode: { quote_refs?: [unknown, unknown][]; annex_quotes?: [unknown, unknown][] }, ru: ArticleIndex, annexRu: AnnexIndex): LawQuote[] {
  return [
    ...(episode.quote_refs ?? []).map(([article, paragraph]) => lawQuote(ru, article, paragraph)),
    ...(episode.annex_quotes ?? []).map(([annex, item]) => annexQuote(annexRu, annex, item)),
  ];
}

export function unlinkedBreakdown(item: BreakdownSource | undefined, world: BreakdownWorld, assigned: Record<string, string>): BreakdownBody | undefined {
  if (!item) return undefined;
  const lesson = assigned[item.ticket];
  const episode = world.episode(lesson);
  const rec: BreakdownBody = {
    steps: item.steps.map((text) => ({ t: text })),
    quotes: item.quotes.map((quote) => ({ norm: quote.norm, ref: ruleFor(quote.norm).get("label") ?? "", text: quote.text })),
    why_not: Object.entries(item.why_not)
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([index, row]) => ({ i: Number(index), t: row.text, mc: row.mc ?? null })),
    lesson: { id: lesson, title: episode.title ?? "", num: episode.num },
    concepts: item.concepts.map((id) => world.concepts[id].label),
  };
  if (item.trap) rec.trap = { t: item.trap };
  return rec;
}

export function matchStats(questions: QuestionStat[], ru: ArticleIndex, ka: ArticleIndex, annexRu: AnnexIndex, annexKa: AnnexIndex): Map<string, number> {
  const stats = new Map<string, number>();
  const bump = (key: string) => stats.set(key, (stats.get(key) ?? 0) + 1);
  for (const question of questions) {
    const explanation = question.explanation_ka || "";
    if (!explanation) continue;
    for (const ref of question.law_refs) {
      const article = String(ref.article);
      const ruArt = ru.get(article);
      const kaArt = ka.get(article);
      if (ref.paragraph == null || !ruArt || !kaArt) { bump("law_skip_noparagraph"); continue; }
      if (ruArt.order.length !== kaArt.order.length) { bump("law_skip_parse_mismatch"); continue; }
      const kaText = kaArt.paras.get(String(ref.paragraph));
      const ruText = ruArt.paras.get(String(ref.paragraph));
      if (!kaText || !ruText) { bump("law_skip_missing"); continue; }
      bump(score(explanation, kaText) >= 0.6 ? "law_ok" : "law_skip_lowmatch");
    }
    for (const ref of question.annex_refs) {
      for (const item of ref.items) {
        const annex = String(ref.annex);
        const kaText = annexKa.get(annex)?.get(item);
        const ruText = annexRu.get(annex)?.get(item);
        if (!kaText || !ruText) { bump("annex_skip_missing"); continue; }
        bump(score(explanation, kaText) >= 0.45 ? "annex_ok" : "annex_skip_lowmatch");
      }
    }
  }
  return stats;
}

export function normPairs(ids: string[], byNorm: { has(id: string): boolean }): [string, string][] {
  const out: [string, string][] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!byNorm.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push([slug(id), citation({ id, kind: "" })]);
  }
  return out;
}

export function linkedTotal(report: Map<string, unknown>): number {
  const stats = report.get("stats");
  if (!(stats instanceof Map)) return 0;
  let total = 0;
  for (const counts of stats.values()) {
    if (counts instanceof Map) total += Number(counts.get("linked") ?? 0);
  }
  return total;
}

export function plain(value: unknown): unknown {
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of value) out[key] = plain(item);
    return out;
  }
  if (Array.isArray(value)) return value.map(plain);
  return value;
}

export function asMap(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(asMap);
  if (value && typeof value === "object" && !(value instanceof Map)) {
    return new Map(Object.entries(value).map(([key, item]) => [key, asMap(item)]));
  }
  return value;
}

type Article = { title: string; paras: Map<string, string>; order: string[]; body?: string };
type ArticleIndex = Map<string, Article>;
type AnnexIndex = Map<string, Map<string, string>>;
type LawQuote = { ref: string; title: string; text: string | null };
type BreakdownSource = {
  ticket: number;
  steps: string[];
  quotes: { norm: string; text: string }[];
  why_not: Record<string, { text: string; mc?: string | null }>;
  concepts: string[];
  trap?: string;
};
type BreakdownBody = {
  steps: { t: string }[];
  quotes: { norm: string; ref: string; text: string }[];
  why_not: { i: number; t: string; mc: string | null }[];
  lesson: { id: string; title: string; num: number };
  concepts: string[];
  trap?: { t: string };
};
type BreakdownWorld = {
  episode(lesson: string): { title?: string; num: number };
  concepts: Record<string, { label: string }>;
};
type QuestionStat = {
  explanation_ka?: string | null;
  law_refs: { article: string | number; paragraph: number | null }[];
  annex_refs: { annex: number; items: string[] }[];
};

function quoteForKey(key: string, ru: ArticleIndex, annexRu: AnnexIndex): LawQuote {
  const body = key.slice(1);
  const dot = body.indexOf(".");
  if (key.startsWith("L")) {
    const article = dot < 0 ? body : body.slice(0, dot);
    const paragraph = dot < 0 ? null : body.slice(dot + 1);
    return lawQuote(ru, article, paragraph);
  }
  return annexQuote(annexRu, body.slice(0, dot), body.slice(dot + 1));
}

function lawQuote(ru: ArticleIndex, article: unknown, paragraph: unknown): LawQuote {
  const found = ru.get(String(article));
  const text = paragraph == null ? found?.body ?? null : found?.paras.get(String(paragraph)) ?? null;
  return {
    ref: paragraph == null ? `ст. ${article}` : `ст. ${article}, п. ${paragraph}`,
    title: found?.title ?? "",
    text,
  };
}

function annexQuote(annexRu: AnnexIndex, annex: unknown, item: unknown): LawQuote {
  const key = String(annex);
  const name = ANNEX_NAME[key] ?? `Приложение ${annex}`;
  return { ref: `${name}, п. ${item}`, title: "", text: annexRu.get(key)?.get(String(item)) ?? null };
}
