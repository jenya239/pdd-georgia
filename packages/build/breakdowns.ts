import type { Json } from "./pyjson.ts";
import { explicitCites, findRu, resolveRu } from "../lesson/normref.ts";
import { slug } from "../lesson/slug.ts";
import { ruleFor } from "./items.ts";

type Cite = [string, string | null];

export type Breakdown = {
  ticket: number;
  steps: string[];
  quotes: { norm: string; text: string }[];
  why_not: { [index: string]: { text: string; mc?: string | null } };
  concepts: string[];
  trap?: string;
};

export type BreakdownWorld = {
  deriveAssignment(): { assigned: { [id: number]: string } };
  episode(id: string): { title?: string; num: number };
  concepts: { [id: string]: { label: string } };
  normIds: Set<string>;
  norms: Map<string, { article?: string }>;
};

export function breakdownRecords(items: Breakdown[], world: BreakdownWorld): [number, Map<string, Json>][] {
  const assigned = world.deriveAssignment().assigned;
  return items.map((item) => [item.ticket, record(item, world, assigned[item.ticket])]);
}

function record(item: Breakdown, world: BreakdownWorld, lesson: string): Map<string, Json> {
  const episode = world.episode(lesson);
  const quotes = item.quotes.map((quote) => new Map<string, Json>([
    ["ref", ruleFor(quote.norm).get("label") ?? ""],
    ["text", quote.text],
    ["n", slug(quote.norm)],
  ]));
  const steps = item.steps.map((text) => new Map<string, Json>([["t", text]]));
  const whyNot = Object.entries(item.why_not)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([index, row]) => new Map<string, Json>([
      ["i", Number(index)],
      ["t", row.text],
      ["mc", row.mc ?? null],
    ]));
  const rec = new Map<string, Json>([
    ["steps", steps],
    ["quotes", quotes],
    ["why_not", whyNot],
    ["lesson", new Map<string, Json>([
      ["id", lesson],
      ["title", episode.title ?? ""],
      ["num", episode.num],
    ])],
    ["concepts", item.concepts.map((id) => world.concepts[id].label)],
  ]);
  if (item.trap) rec.set("trap", new Map<string, Json>([["t", item.trap]]));
  const scope = quotes.flatMap((quote) => explicitCites(findRu(String(quote.get("ref")))));
  quotes.forEach((quote, index) => linkQuote(quote, item.quotes[index].norm, world, scope));
  for (const part of [...steps, ...whyNot, ...(item.trap ? [rec.get("trap") as Map<string, Json>] : [])]) {
    linkField(part, "t", world.normIds, scope, null, null);
  }
  return rec;
}

function linkQuote(quote: Map<string, Json>, norm: string, world: BreakdownWorld, scope: Cite[]): void {
  const article = world.norms.get(norm)?.article ?? null;
  linkField(quote, "text", world.normIds, scope, article, norm);
}

function linkField(
  obj: Map<string, Json>,
  field: string,
  ids: Set<string>,
  scope: Cite[],
  ownArticle: string | null,
  selfId: string | null,
): void {
  const text = obj.get(field);
  if (typeof text !== "string" || !text) return;
  const refs = findRu(text);
  const block = explicitCites(refs);
  resolveRu(refs, ids, ownArticle === null && selfId === null ? [block, scope] : [block], ownArticle);
  if (selfId) for (const ref of refs) if (ref.status === "linked" && ref.norm === selfId) ref.status = "self";
  const spans = refs
    .filter((ref) => ref.status === "linked" && ref.norm)
    .map((ref) => [utf16(text, ref.start), utf16(text, ref.end), slug(ref.norm!)]);
  if (spans.length) obj.set("_r", new Map<string, Json>([[field, spans]]));
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
