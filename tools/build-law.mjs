import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dumps } from "../packages/build/pyjson.ts";
import { parseAnnex, parseLaw } from "../packages/build/law-ru.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readText(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function articleJson(article) {
  const out = new Map([
    ["title", article.title],
    ["paras", article.paras],
    ["order", article.order],
  ]);
  if (article.body !== undefined) out.set("body", article.body);
  return out;
}

export function lawRuJson() {
  const law = parseLaw(readText("data/sources/law_ru_matsne_pub36_2026-06-25.txt"));
  const annex = parseAnnex(readText("data/sources/annexes_ru_matsne_pub36.txt"));
  const articles = new Map();
  for (const [id, article] of law) articles.set(id, articleJson(article));
  return dumps(new Map([
    ["law", articles],
    ["annex", annex],
  ]));
}
