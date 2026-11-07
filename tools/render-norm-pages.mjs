import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pageModel } from "../packages/build/html-model.ts";
import { normFiles } from "../packages/norm/pages.ts";
import { loadWorld } from "./load-ontology.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function renderNormPages() {
  return normFiles(pageModel(courseInput()));
}

function courseInput() {
  const world = loadWorld(root);
  const norms = readJson("content/ontology/generated/norms.json").norms.map((norm) => norm.id);
  const items = readJson("site/data/items.json").items.map((item) => ({
    id: item.id,
    q: item.q,
    quoteSlug: item.quote.n ?? null,
  }));
  const mentions = [];
  for (const [type, lines] of Object.entries(readJson("content/ontology/generated/links.json").linked)) {
    for (const line of lines) {
      const bar = line.indexOf(" | ");
      const arrow = line.lastIndexOf(" → ");
      mentions.push({ type, key: line.slice(0, bar), norm: line.slice(arrow + " → ".length) });
    }
  }
  return {
    norms,
    lessons: world.lessonOrder.map((id) => ({
      id,
      num: world.episode(id).num,
      teaches: world.teaches(id),
      quoted: world.quoted(id),
    })),
    introduced: world.introducedIn(),
    concepts: Object.values(world.concepts).map((concept) => ({
      id: concept.id,
      label: concept.label,
      norms: concept.norms || [],
    })),
    misconceptions: Object.values(world.misconceptions).map((item) => ({
      belief: item.belief,
      truth: item.truth,
      norms: item.norms || [],
    })),
    tickets: [...world.questions.keys()].sort((left, right) => left - right).map((id) => ({
      id,
      norms: world.ticketNorms(id).norms,
    })),
    items,
    mentions,
  };
}

function readJson(rel) {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8"));
}

function isMain() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isMain()) {
  readFileSync(0);
  process.stdout.write(JSON.stringify(renderNormPages()));
}
