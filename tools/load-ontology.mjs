import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { World } from "../packages/domain/ontology.mjs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

export function loadItems(repo) {
  const dir = path.join(repo, "content/checkitems");
  const out = [];
  for (const file of readdirSync(dir).filter((name) => /^ep.*\.json$/.test(name)).sort()) {
    const lesson = file.slice(0, -".json".length);
    for (const item of readJson(path.join(dir, file))) out.push({ lesson, ...item });
  }
  return out;
}

export function loadWorld(repo) {
  const ontology = path.join(repo, "content/ontology");
  const doc = {};
  for (const name of ["concepts", "misconceptions", "lessons", "tickets"]) {
    doc[name] = readJson(path.join(ontology, `${name}.json`));
  }
  return new World(
    doc,
    readJson(path.join(ontology, "generated/norms.json")).norms,
    readJson(path.join(repo, "data/tickets/tickets_ru.json")).questions,
    readJson(path.join(repo, "content/episodes.json")),
  );
}

export function reportText(repo) {
  return `${JSON.stringify(loadWorld(repo).report(loadItems(repo)), null, 1)}\n`;
}

export function assignmentText(repo) {
  const { assigned } = loadWorld(repo).deriveAssignment();
  const ordered = Object.fromEntries(Object.entries(assigned).sort((a, b) => Number(a[0]) - Number(b[0])));
  return `${JSON.stringify(ordered)}\n`;
}
