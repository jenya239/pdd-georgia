import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dumps, parse } from "../packages/build/pyjson.ts";
import { parsePlan, withCounts } from "../packages/build/plan.ts";
import {
  coreTicketIds,
  episodeKind,
  lessonTicketIds,
  linkedTicketIds,
} from "../packages/build/episodes.ts";
import { loadWorld } from "./load-ontology.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(rel) {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8"));
}

function ownItems() {
  const dir = path.join(root, "content/checkitems");
  const out = [];
  for (const file of readdirSync(dir).filter((name) => /^ep.*\.json$/.test(name)).sort()) {
    const lesson = file.slice(0, -".json".length);
    for (const item of readJson(path.join("content/checkitems", file))) out.push({ lesson, id: item.id });
  }
  return out;
}

function edition(id, label, href) {
  return new Map([
    ["id", id],
    ["label", label],
    ["href", href],
  ]);
}

export function episodesJson() {
  const questions = readJson("data/tickets/tickets_ru.json").questions;
  const source = readJson("content/episodes.json");
  const assigned = loadWorld(root).deriveAssignment().assigned;
  const plan = withCounts(
    parsePlan(readFileSync(path.join(root, "content/plan/structure.md"), "utf8")),
    questions.map((question) => question.episodes),
  );
  const doc = parse(readFileSync(path.join(root, "site/data/episodes.json"), "utf8"));
  doc.set("plan", plan.map((row) => new Map([
    ["e", row.e],
    ["block", row.block],
    ["title", row.title],
    ["src", row.src],
    ["n", row.n],
  ])));
  const items = ownItems();
  for (const ep of source) {
    const built = doc.get("released").find((item) => item.get("id") === ep.id);
    const kind = episodeKind(ep);
    built.set("kind", kind);
    const own = items.filter((item) => item.lesson === ep.id).map((item) => item.id);
    if (own.length) built.set("own_items", own);
    const lessonIds = lessonTicketIds(ep.id, assigned);
    const core = coreTicketIds(ep, questions);
    built.set("tickets_lesson", lessonIds);
    built.set("tickets_core", core);
    built.set("tickets_linked", linkedTicketIds(ep, questions, core, lessonIds));
    const plain = existsSync(path.join(root, "content/lessons", ep.id, "plain.mjs"));
    if (plain && kind !== "text") {
      built.set("editions", [
        edition("dialogue", "Ролик", ep.video),
        edition("plain", "Без персонажей", `lessons/${ep.id}-plain.html`),
      ]);
    }
    if (kind === "text" && plain) {
      built.set("editions", [
        edition("dialogue", "С диалогом", ep.lesson),
        edition("plain", "Без персонажей", `lessons/${ep.id}-plain.html`),
      ]);
    }
  }
  return dumps(doc, { indent: 1 });
}
