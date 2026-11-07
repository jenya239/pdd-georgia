import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { citedNorms } from "../packages/domain/ontology.ts";
import { lessonBundle } from "../packages/lesson/files.ts";
import { parseAnnex, parseLaw } from "../packages/build/law-ru.ts";
import { exportItems, ruleFor } from "../packages/build/items.ts";
import { applyTranslations } from "../packages/build/mt-apply.ts";
import { linkCourse } from "../packages/build/normlink.ts";
import { buildTicketRecords } from "../packages/build/ticket-record.ts";
import { dumps } from "../packages/build/pyjson.ts";
import { loadItems, loadWorld } from "./load-ontology.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANNEX_NAME = { 1: "Приложение 1 (знаки)", 2: "Приложение 2 (разметка)" };

export function buildLinks() {
  const world = loadWorld(root);
  const questions = readJson("data/tickets/tickets_ru.json").questions;
  const episodes = readJson("content/episodes.json");
  const ru = parseLaw(readText("data/sources/law_ru_matsne_pub36_2026-06-25.txt"));
  const annexRu = parseAnnex(readText("data/sources/annexes_ru_matsne_pub36.txt"));
  const pitfalls = {};
  for (const episode of episodes) pitfalls[episode.id] = episode.pitfalls ?? {};
  const records = buildTicketRecords({
    questions,
    ru,
    ka: parseLaw(readText("data/sources/law_ka_matsne_pub36_2026-06-25.txt")),
    annexRu,
    annexKa: parseAnnex(readText("data/sources/annexes_ka_matsne_pub36_2026.txt")),
    assigned: world.deriveAssignment().assigned,
    pitfalls,
  });
  applyTranslations(records, questions, readJson("content/translations/explanations_ru.json").items);
  const cache = readJson("content/translations/explanations_ru.json").items;
  const breakdowns = new Map(loadBreakdowns().map((item) => [item.ticket, breakdownRecord(item, world)]));
  const tickets = records.map((record) => {
    const row = plain(record);
    return {
      id: row.id,
      lesson: row.lesson,
      ex: row.ex,
      ex_ru: row.ex_ru,
      why: row.why,
      br: breakdowns.get(row.id),
    };
  });
  const skipExRu = new Set(tickets.filter((ticket) => cache[`${ticket.id}:ex`]?.masked === false).map((ticket) => ticket.id));
  const banks = questions.map((question) => citedNorms(question, world.normIds, world.normText, world.annotation(question.id).norms || []));
  const raw = lessonBundle().raw;
  const lessons = {};
  const plains = {};
  for (const episode of episodes) {
    if (raw[episode.id]) lessons[episode.id] = raw[episode.id];
    if (raw[`${episode.id}-plain`]) plains[episode.id] = raw[`${episode.id}-plain`];
    episode.law_quotes = [
      ...(episode.quote_refs ?? []).map(([art, par]) => lawQuote(ru, art, par)),
      ...(episode.annex_quotes ?? []).map(([annex, item]) => annexQuote(annexRu, annex, item)),
    ];
  }
  const published = JSON.parse(readText("site/data/tickets.json"));
  const laws = Object.entries(published.laws).map(([key, quote]) => [key, copyQuote(quote)]);
  const itemsDoc = JSON.parse(dumps(exportItems(loadItems(root), world)));
  const report = linkCourse({
    norms: readJson("content/ontology/generated/norms.json").norms,
    episodes,
    lessons,
    plains,
    laws,
    tickets,
    banks,
    items: itemsDoc.items,
    misconceptions: itemsDoc.misconceptions,
    skipExRu,
  });
  return { report, tickets, laws: new Map(laws.map(([key, quote]) => [key, asMap(quote)])) };
}

function lawQuote(ru, art, par) {
  const article = ru.get(String(art));
  const text = par == null ? article?.body : article?.paras.get(String(par));
  return { ref: par == null ? `ст. ${art}` : `ст. ${art}, п. ${par}`, title: article?.title ?? "", text };
}

function annexQuote(annexRu, annex, item) {
  return {
    ref: `${ANNEX_NAME[annex] ?? `Приложение ${annex}`}, п. ${item}`,
    title: "",
    text: annexRu.get(String(annex))?.get(String(item)),
  };
}

function copyQuote(quote) {
  const copy = {};
  for (const [field, value] of Object.entries(quote)) {
    if (field !== "n" && field !== "_r") copy[field] = value;
  }
  return copy;
}

function loadBreakdowns() {
  const dir = path.join(root, "content/breakdowns");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => Number(left.slice(0, -".json".length)) - Number(right.slice(0, -".json".length)))
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), "utf8")));
}

function breakdownRecord(item, world) {
  const lesson = world.deriveAssignment().assigned[item.ticket];
  const episode = world.episode(lesson);
  const rec = {
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

function plain(value) {
  if (value instanceof Map) {
    const out = {};
    for (const [key, item] of value) out[key] = plain(item);
    return out;
  }
  if (Array.isArray(value)) return value.map(plain);
  return value;
}

function asMap(value) {
  if (Array.isArray(value)) return value.map(asMap);
  if (value && typeof value === "object") {
    const map = new Map();
    for (const [key, item] of Object.entries(value)) map.set(key, asMap(item));
    return map;
  }
  return value;
}

function readText(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(readText(rel));
}
