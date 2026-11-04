import { readFileSync } from "node:fs";
import { explicitCites, findRu, resolveRu, type NormRef } from "../lesson/normref.ts";
import { slug } from "../lesson/slug.ts";

export type Norm = {
  id: string;
  kind: string;
  parent?: string | null;
  article?: string;
  title?: string;
  title_ka?: string;
  annex?: number;
  ru?: string;
  ka?: string;
  en?: string;
};

const MISSING_ON_ARTICLE = "<i>текст отсутствует</i>";
const MISSING_ON_PAGE = "<i>Русского текста этой нормы в переводе Matsne нет.</i>";

const loaded = JSON.parse(readFileSync("content/ontology/generated/norms.json", "utf8")) as { norms: Norm[] };
const norms = loaded.norms;
const ids = new Set(norms.map((item) => item.id));
const children = new Map<string, Norm[]>();
const bySlug = new Map<string, Norm>();
for (const item of norms) {
  bySlug.set(slug(item.id), item);
  if (!item.parent) continue;
  const kids = children.get(item.parent) ?? [];
  kids.push(item);
  children.set(item.parent, kids);
}

function escapeQuoted(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function escapePlain(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderLinked(text: string, spans: [number, number, string][]): string {
  let out = "";
  let pos = 0;
  for (const [start, end, id] of spans) {
    if (start < pos) continue;
    out += escapePlain(text.slice(pos, start));
    out += `<a class="nref" href="${id}.html" data-norm="${id}">${escapePlain(text.slice(start, end))}</a>`;
    pos = end;
  }
  return out + escapePlain(text.slice(pos));
}

export function allNorms(): Norm[] {
  return norms;
}

export function linkedRu(norm: Norm, missing: string): string {
  if (!norm.ru) return missing;
  const refs = findRu(norm.ru);
  const ownArticle = norm.id.startsWith("A") ? null : norm.article ?? null;
  resolveRu(refs, ids, [explicitCites(refs)], ownArticle);
  const spans = refs
    .filter((item): item is NormRef & { norm: string } => item.status === "linked" && item.norm !== null && item.norm !== norm.id)
    .map((item) => [item.start, item.end, slug(item.norm)] as [number, number, string])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return renderLinked(norm.ru, spans);
}

export function normPageIds(): string[] {
  return norms.map((item) => slug(item.id));
}

export function normTexts(pageId: string): string[] {
  const norm = bySlug.get(pageId);
  if (!norm) throw new Error(`no norm ${pageId}`);
  if (norm.kind === "article") return (children.get(norm.id) ?? []).map((child) => linkedRu(child, MISSING_ON_ARTICLE));
  const texts = [linkedRu(norm, MISSING_ON_PAGE)];
  if (norm.ka) texts.push(escapeQuoted(norm.ka));
  if (norm.en) texts.push(escapeQuoted(norm.en));
  return texts;
}
