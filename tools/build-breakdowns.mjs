import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { breakdownRecords } from "../packages/build/breakdowns.ts";
import { loadWorld } from "./load-ontology.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadBreakdowns() {
  const dir = path.join(root, "content/breakdowns");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => Number(left.slice(0, -".json".length)) - Number(right.slice(0, -".json".length)))
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), "utf8")));
}

export function buildBreakdowns() {
  return breakdownRecords(loadBreakdowns(), loadWorld(root));
}
