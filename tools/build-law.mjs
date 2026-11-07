import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dumps } from "../packages/build/pyjson.ts";
import { parseLawEn } from "../packages/build/law-ka-en.ts";
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

function enJson(article) {
  return new Map([
    ["title", article.title],
    ["paras", article.paras],
  ]);
}

export function lawKaEnJson() {
  const ka = parseLaw(readText("data/sources/law_ka_matsne_pub36_2026-06-25.txt"));
  const kaAnnex = parseAnnex(readText("data/sources/annexes_ka_matsne_pub36_2026.txt"));
  const en = parseLawEn(readText("data/sources/law_en_official_matsne_2019-06-28.txt"));
  const kaArticles = new Map();
  const enArticles = new Map();
  for (const [id, article] of ka) kaArticles.set(id, articleJson(article));
  for (const [id, article] of en) enArticles.set(id, enJson(article));
  return dumps(new Map([
    ["ka", kaArticles],
    ["kaAnnex", kaAnnex],
    ["en", enArticles],
  ]));
}
