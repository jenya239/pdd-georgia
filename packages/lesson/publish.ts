import { readFileSync } from "node:fs";
import { lessonHtml } from "./link-html.ts";
import { explicitCites, findRu } from "./normref.ts";

const MARKER = "<!--AFTER-TICKETS-->";

function episodeScope(id: string): [string, string | null][] {
  const episodes = JSON.parse(readFileSync("content/episodes.json", "utf8")) as {
    id: string;
    lead?: string;
    points?: { t: string; c: string }[];
    quote_refs?: [string, string | null][];
    annex_quotes?: [number, string][];
    core_note?: string;
    linked_note?: string;
  }[];
  const episode = episodes.find((item) => item.id === id);
  if (!episode) return [];
  const annex: Record<number, string> = { 1: "Приложение 1 (знаки)", 2: "Приложение 2 (разметка)" };
  const texts = [
    episode.lead,
    ...(episode.points ?? []).map((point) => `${point.t} ${point.c}`),
    ...(episode.quote_refs ?? []).map(([art, par]) => (par == null ? `ст. ${art}` : `ст. ${art}, п. ${par}`)),
    ...(episode.annex_quotes ?? []).map(([an, item]) => `${annex[an]}, п. ${item}`),
    episode.core_note,
    episode.linked_note,
  ].filter((text): text is string => Boolean(text));
  return texts.flatMap((text) => explicitCites(findRu(text)));
}

function normIds(): Set<string> {
  const norms = JSON.parse(readFileSync("content/ontology/generated/norms.json", "utf8")) as { norms: { id: string }[] };
  return new Set(norms.norms.map((item) => item.id));
}

export function publishedTheory(html: string, episodeId: string): string {
  const linked = lessonHtml(html, normIds(), [episodeScope(episodeId)]);
  const at = linked.indexOf(MARKER);
  return at < 0 ? linked : linked.slice(0, at);
}
