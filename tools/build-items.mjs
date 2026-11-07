import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportItems, validateItems } from "../packages/build/items.ts";
import { dumps } from "../packages/build/pyjson.ts";
import { loadItems, loadWorld } from "./load-ontology.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function buildItemsJson() {
  return dumps(exportItems(loadItems(root), loadWorld(root)));
}

export function itemErrors(mutate) {
  const items = loadItems(root);
  return validateItems(mutate ? mutate(items) : items, loadWorld(root));
}
