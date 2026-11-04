import { readFileSync } from "node:fs";
import { slug } from "../lesson/slug.ts";

type Norm = { id: string; ru?: string; ka?: string; en?: string };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function norms(): Norm[] {
  const file = JSON.parse(readFileSync("content/ontology/generated/norms.json", "utf8")) as { norms: Norm[] };
  return file.norms;
}

export function normTexts(pageId: string): string[] {
  const norm = norms().find((item) => slug(item.id) === pageId);
  if (!norm) throw new Error(`no norm ${pageId}`);
  const texts = [norm.ru ? escapeHtml(norm.ru) : "<i>Русского текста этой нормы в переводе Matsne нет.</i>"];
  if (norm.ka) texts.push(escapeHtml(norm.ka));
  if (norm.en) texts.push(escapeHtml(norm.en));
  return texts;
}
