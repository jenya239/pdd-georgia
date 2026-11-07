import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAnnex, parseLaw } from "../packages/build/law-ru.ts";
import { buildTicketRecords } from "../packages/build/ticket-record.ts";
import { dumps } from "../packages/build/pyjson.ts";
import { ticketHash } from "../packages/domain/ticket-hash.ts";
import { loadWorld } from "./load-ontology.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readText(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(readText(rel));
}

export function buildTicketsJson() {
  const questions = readJson("data/tickets/tickets_ru.json").questions;
  const episodes = readJson("content/episodes.json");
  const pitfalls = {};
  for (const episode of episodes) pitfalls[episode.id] = episode.pitfalls ?? {};
  const tickets = buildTicketRecords({
    questions,
    ru: parseLaw(readText("data/sources/law_ru_matsne_pub36_2026-06-25.txt")),
    ka: parseLaw(readText("data/sources/law_ka_matsne_pub36_2026-06-25.txt")),
    annexRu: parseAnnex(readText("data/sources/annexes_ru_matsne_pub36.txt")),
    annexKa: parseAnnex(readText("data/sources/annexes_ka_matsne_pub36_2026.txt")),
    assigned: loadWorld(root).deriveAssignment().assigned,
    pitfalls,
  });
  for (const ticket of tickets) {
    const question = ticket.get("q");
    const answers = ticket.get("a");
    ticket.set("hash", ticketHash({
      q: { ru: question.get("ru") },
      a: { ru: answers.get("ru") },
      c: ticket.get("c"),
    }));
  }
  return dumps(tickets);
}
