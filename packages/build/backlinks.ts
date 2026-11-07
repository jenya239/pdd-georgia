import { coversId } from "../domain/ontology.ts";
import { slug } from "../lesson/slug.ts";
import type { Json } from "./pyjson.ts";

export type Mention = { type: string; key: string; norm: string };

export type BacklinkInput = {
  norms: string[];
  lessons: { id: string; num: number; teaches: string[]; quoted: string[] }[];
  introduced: Record<string, string>;
  concepts: { id: string; label: string; norms: string[] }[];
  misconceptions: { belief: string; truth: string; norms: string[] }[];
  tickets: { id: number; norms: string[] }[];
  items: { id: string; q: string; quoteSlug: string | null }[];
  mentions: Mention[];
};

export function backlinkModel(input: BacklinkInput): Map<string, Json> {
  const bySlug = new Map(input.norms.map((id) => [slug(id), id]));
  const order = new Map(input.norms.map((id, index) => [id, index]));
  const packed = new Map<string, Json>();
  for (const nid of input.norms) packed.set(nid, record(nid, input, bySlug, order));
  return new Map<string, Json>([["backlinks", packed]]);
}

function record(nid: string, input: BacklinkInput, bySlug: Map<string, string>, order: Map<string, number>): Map<string, Json> {
  const rel = (spec: string) => coversId(spec, nid) || coversId(nid, spec);
  const mentioned = input.mentions.filter((mention) => coversId(nid, mention.norm));
  const lessons: Json[] = [];
  for (const lesson of input.lessons) {
    const how: string[] = [];
    if (lesson.teaches.some(rel)) how.push("разбирает");
    else if (lesson.quoted.some(rel)) how.push("цитирует");
    if (mentioned.some((mention) => (mention.type === "lessons" || mention.type === "episodes") && mention.key === lesson.id)) {
      how.push("ссылается");
    }
    if (how.length) lessons.push([lesson.id, how]);
  }
  const concepts = input.concepts.filter((concept) => concept.norms.some(rel)).map((concept) => {
    const lesson = input.introduced[concept.id];
    const episode = input.lessons.find((item) => item.id === lesson);
    return new Map<string, Json>([["label", concept.label], ["intro", lesson && episode ? episode.num : null]]);
  });
  const misconceptions = input.misconceptions.filter((item) => item.norms.some(rel)).map((item) => (
    new Map<string, Json>([["belief", item.belief], ["truth", item.truth]])
  ));
  const tickets = input.tickets.filter((ticket) => ticket.norms.some((norm) => coversId(nid, norm))).map((ticket) => ticket.id);
  const mentionedItems = new Set(mentioned.filter((mention) => mention.type === "own_items").map((mention) => mention.key));
  const items = input.items.filter((item) => mentionedItems.has(item.id) || coversQuote(nid, item.quoteSlug, bySlug)).map((item) => (
    new Map<string, Json>([["id", item.id], ["q", item.q]])
  ));
  const cited = [...new Set(mentioned.filter((mention) => mention.type === "norm_pages" && !coversId(nid, mention.key)).map((mention) => mention.key))]
    .sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
  return new Map<string, Json>([
    ["lessons", lessons],
    ["concepts", concepts],
    ["misconceptions", misconceptions],
    ["tickets", tickets],
    ["items", items],
    ["cited", cited],
  ]);
}

function coversQuote(nid: string, quoteSlug: string | null, bySlug: Map<string, string>): boolean {
  if (!quoteSlug) return false;
  const norm = bySlug.get(quoteSlug);
  return norm != null && coversId(nid, norm);
}
