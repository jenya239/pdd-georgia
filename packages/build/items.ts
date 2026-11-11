import type { Json } from "./pyjson.ts";
import { coversId } from "../domain/ontology.ts";

const TYPES = ["ticket", "diagram", "priority", "max-error", "flashcard", "cloze"];
const TYPE_LABEL: Record<string, string> = {
  ticket: "в формате билета",
  diagram: "схема",
  priority: "очерёдность проезда",
  "max-error": "найдите ошибку в рассуждении",
  flashcard: "число из закона",
  cloze: "вставьте слово из закона",
};
const REQUIRED = ["id", "lesson", "type", "q", "options", "answer", "norms", "concepts", "quote", "explain", "distractors"];
const FIG_KINDS = ["crossing", "section", "approach"];
const ANNEX_KIND: Record<string, string> = { "1": "знак", "2": "разметка" };
const ID = /^o-(ep\d\d)-\d\d$/;

export type CheckWorld = {
  normText: Map<string, string>;
  lessonOrder: string[];
  concepts: { [id: string]: unknown };
  misconceptions: { [id: string]: { belief: string; truth: string } };
  quoted(lesson: string): string[];
  availableConcepts(lesson: string): Set<string>;
  doc: { tickets: { [id: string]: { distractors?: { [index: string]: string | null } } } };
};

type Item = {
  id?: string;
  lesson?: string;
  type?: string;
  q?: string;
  options?: string[];
  answer?: unknown;
  norms?: string[];
  concepts?: string[];
  quote?: { norm?: string; text?: string };
  explain?: string;
  distractors?: { [index: string]: string | null };
  fig?: { kind?: string };
};

export function normText(text: string): string {
  return text.replace(/[\u2010-\u2015\u2212]/g, "-").replaceAll("\u00a0", " ").replace(/\s+/g, " ").trim();
}

export function ruleFor(normId: string): Map<string, string> {
  if (normId.includes(":")) return annexRule(normId);
  const parts = normId.split(".");
  if (parts.length === 1) return new Map([["key", parts[0]], ["label", `ст. ${parts[0]}`]]);
  const sub = parts.slice(2).join(".");
  return new Map([
    ["key", `${parts[0]}.${parts[1]}`],
    ["label", `ст. ${parts[0]}, п. ${parts[1]}${sub ? ` «${sub}»` : ""}`],
  ]);
}

export function validateItems(items: Item[], world: CheckWorld): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.id ?? "?";
    const missing = REQUIRED.filter((field) => !(field in item));
    if (missing.length) {
      errors.push(`${key}: missing ${pyRepr(missing)}`);
      continue;
    }
    const id = ID.exec(item.id ?? "");
    if (!id || id[1] !== item.lesson) errors.push(`${key}: id must be o-${item.lesson}-NN`);
    if (seen.has(item.id ?? "")) errors.push(`${key}: duplicate id`);
    seen.add(item.id ?? "");
    if (!world.lessonOrder.includes(item.lesson ?? "")) {
      errors.push(`${key}: unknown lesson ${item.lesson}`);
      continue;
    }
    if ((item.options ?? []).length < 2 || (item.options ?? []).length > 4) errors.push(`${key}: needs 2–4 options`);
    for (const error of [...typeErrors(item), ...quoteErrors(item.quote ?? {}, world.normText)]) errors.push(`${key}: ${error}`);
    errors.push(...normErrors(item, world, key), ...conceptErrors(item, world, key), ...distractorErrors(item, world, key));
    if ([...(item.explain ?? "")].length < 20) errors.push(`${key}: explanation too short`);
  }
  return errors;
}

export function exportItems(items: Item[], world: CheckWorld): Map<string, Json> {
  const used = new Set<string>();
  for (const item of items) for (const name of Object.values(item.distractors ?? {})) if (name) used.add(name);
  const tickets = Object.entries(world.doc.tickets)
    .filter(([, row]) => row.distractors && Object.keys(row.distractors).length > 0)
    .sort(([left], [right]) => Number(left) - Number(right));
  const ticketDistractors = new Map<string, Json>();
  for (const [id, row] of tickets) {
    for (const name of Object.values(row.distractors ?? {})) if (name) used.add(name);
    ticketDistractors.set(id, asJson(row.distractors));
  }
  const misconceptions = new Map<string, Json>();
  for (const id of [...used].sort()) {
    const row = world.misconceptions[id];
    misconceptions.set(id, new Map<string, Json>([["belief", row.belief], ["truth", row.truth]]));
  }
  return new Map<string, Json>([
    ["items", items.map((item) => exportItem(item))],
    ["misconceptions", misconceptions],
    ["ticket_distractors", ticketDistractors],
  ]);
}

function exportItem(item: Item): Map<string, Json> {
  const rule = ruleFor(item.quote?.norm ?? "");
  const rec = new Map<string, Json>([
    ["id", item.id ?? ""],
    ["lesson", item.lesson ?? ""],
    ["type", item.type ?? ""],
    ["q", item.q ?? ""],
    ["options", item.options ?? []],
    ["answer", typeof item.answer === "number" ? item.answer : 0],
    ["explain", item.explain ?? ""],
    ["distractors", asJson(item.distractors ?? {})],
    ["type_label", TYPE_LABEL[item.type ?? ""] ?? ""],
    ["rule", rule],
    ["quote", new Map<string, Json>([["ref", rule.get("label") ?? ""], ["text", item.quote?.text ?? ""]])],
  ]);
  if (item.fig) rec.set("fig", asJson(item.fig));
  return rec;
}

function annexRule(normId: string): Map<string, string> {
  const colon = normId.indexOf(":");
  const annex = normId.slice(1, colon);
  const item = normId.slice(colon + 1);
  const note = item.indexOf(".прим");
  if (note >= 0) {
    const section = item.slice(0, note);
    const letter = item.slice(note + ".прим".length).replace(/^[0-9.]+/, "");
    return new Map([
      ["key", normId],
      ["label", `прил. ${annex}, примечание к разделу ${section}${letter ? ` «${letter}»` : ""}`],
    ]);
  }
  return new Map([
    ["key", normId],
    ["label", `прил. ${annex}, ${ANNEX_KIND[annex] ?? "пункт"} ${item}`],
  ]);
}

function quoteErrors(quote: { norm?: string; text?: string }, law: Map<string, string>): string[] {
  if (!law.has(quote.norm ?? "")) return [`quote norm ${pyRepr(quote.norm)} does not exist`];
  const text = law.get(quote.norm ?? "") ?? "";
  if (!quote.text || !normText(text).includes(normText(quote.text))) {
    return [`quote is not verbatim in ${quote.norm}: ${pyRepr(quote.text)}`];
  }
  return [];
}

function typeErrors(item: Item): string[] {
  const options = item.options ?? [];
  const answer = item.answer;
  if (!TYPES.includes(item.type ?? "")) return [`unknown type ${pyRepr(item.type)}`];
  if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    return [`answer ${pyRepr(answer)} out of range`];
  }
  const quote = normText(item.quote?.text ?? "");
  if (item.type === "flashcard") return flashcardErrors(options[answer] ?? "", quote);
  if (item.type === "cloze") return clozeErrors(item.q ?? "", options[answer] ?? "", quote);
  if (item.type === "diagram" && !item.fig) return ["diagram needs fig"];
  if (item.fig && !FIG_KINDS.includes(item.fig.kind ?? "")) return [`unknown fig kind ${pyRepr(item.fig.kind)}`];
  return [];
}

function flashcardErrors(answer: string, quote: string): string[] {
  const nums = [...answer.matchAll(/\p{Nd}+/gu)].map((match) => match[0]);
  const present = nums.every((num) => new RegExp(`(?<!\\p{Nd})${num}(?!\\p{Nd})`, "u").test(quote));
  return nums.length && present ? [] : [`flashcard answer ${pyRepr(answer)} is not a number from the quote`];
}

function clozeErrors(question: string, answer: string, quote: string): string[] {
  if (question.split("___").length - 1 !== 1) return ["cloze needs exactly one ___"];
  if (!quote.includes(normText(answer))) return [`cloze answer ${pyRepr(answer)} is not in the quote`];
  const blank = question.match(/«([^»]*___[^»]*)»/);
  const filled = blank ? normText(stripEnds(blank[1].replace("___", answer), "… ")) : "";
  return filled && quote.includes(filled) ? [] : ["cloze text with the answer filled in is not the quote"];
}

function normErrors(item: Item, world: CheckWorld, key: string): string[] {
  const errors: string[] = [];
  const stated = world.lessonOrder.slice(0, world.lessonOrder.indexOf(item.lesson ?? "") + 1).flatMap((lesson) => world.quoted(lesson));
  if (!item.norms?.includes(item.quote?.norm ?? "")) errors.push(`${key}: quote norm ${item.quote?.norm} is not among the item norms`);
  for (const norm of item.norms ?? []) {
    if (!world.normText.has(norm)) errors.push(`${key}: unknown norm ${norm}`);
    else if (!stated.some((spec) => coversId(spec, norm))) errors.push(`${key}: norm ${norm} is not taught by ${item.lesson} or earlier`);
  }
  return errors;
}

function conceptErrors(item: Item, world: CheckWorld, key: string): string[] {
  const available = world.availableConcepts(item.lesson ?? "");
  return (item.concepts ?? []).flatMap((concept) => {
    if (!(concept in world.concepts)) return [`${key}: unknown concept ${concept}`];
    if (!available.has(concept)) return [`${key}: concept ${concept} is not introduced by ${item.lesson}`];
    return [];
  });
}

function distractorErrors(item: Item, world: CheckWorld, key: string): string[] {
  const errors: string[] = [];
  const wrong = (item.options ?? []).map((_, index) => String(index)).filter((index) => Number(index) !== item.answer);
  const given = Object.keys(item.distractors ?? {});
  if (given.length !== wrong.length || wrong.some((index) => !given.includes(index))) {
    errors.push(`${key}: distractors must map exactly the wrong options ${pyRepr([...wrong].sort())}`);
  }
  for (const name of Object.values(item.distractors ?? {})) {
    if (name != null && !(name in world.misconceptions)) errors.push(`${key}: unknown misconception ${name}`);
  }
  return errors;
}

function stripEnds(text: string, chars: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start])) start += 1;
  while (end > start && chars.includes(text[end - 1])) end -= 1;
  return text.slice(start, end);
}

function asJson(value: unknown): Json {
  if (value == null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(asJson);
  const out = new Map<string, Json>();
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) out.set(key, asJson(item));
  return out;
}

function pyRepr(value: unknown): string {
  if (value == null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(", ")}]`;
  if (typeof value !== "string") return String(value);
  const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === quote) out += `\\${quote}`;
    else if (code < 32 || code === 0x7f) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return `${out}${quote}`;
}
