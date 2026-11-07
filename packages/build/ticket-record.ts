import type { Json } from "./pyjson.ts";
import { primaryRef } from "../domain/ontology.ts";

const LAW_MATCH = 0.6;
const ANNEX_MATCH = 0.45;
const ANNEX_NAME: Record<string, string> = { "1": "Приложение 1 (знаки)", "2": "Приложение 2 (разметка)" };
const ANNEX_KIND: Record<string, string> = { "1": "знак", "2": "разметка" };
const STOP = tokens(
  "საგზაო მოძრაობის შესახებ საქართველოს კანონის მუხლის პუნქტის ქვეპუნქტის ქვეპუნქტების თანახმად დანართის პირველი მეორე ამავე თავის ნიშანი საგზაო",
);

type Article = {
  title: string;
  paras: Map<string, string>;
  order: string[];
  body?: string;
};

type Ref = {
  kind: string;
  major: string;
  minor: number | string | null;
  sub: string | null;
};

type Question = {
  id: number;
  topic_id: number;
  question: string;
  answers: { n: number; text: string }[];
  correct: number;
  image?: string | null;
  explanation_ka?: string | null;
  law_refs: { article: string | number; paragraph: number | null }[];
  annex_refs: { annex: number; items: string[] }[];
  episodes: string[];
  source_url: string;
  flags: string[];
  ka: { question: string; answers: { text: string }[] };
  en: { question: string; answers: { text: string }[] };
};

export type TicketSources = {
  questions: Question[];
  ru: Map<string, Article>;
  ka: Map<string, Article>;
  annexRu: Map<string, Map<string, string>>;
  annexKa: Map<string, Map<string, string>>;
  assigned: { [id: string]: string };
  pitfalls: { [lesson: string]: { [spec: string]: string } };
};

export function buildTicketRecords(source: TicketSources): Map<string, Json>[] {
  const quotes = new Map<string, Json>();
  return source.questions.map((question) => record(question, source, quotes));
}

function record(question: Question, source: TicketSources, quotes: Map<string, Json>): Map<string, Json> {
  const explanation = question.explanation_ka || "";
  const ruAnswers = question.answers.map((answer) => answer.text);
  let kaAnswers = question.ka.answers.map((answer) => answer.text);
  let enAnswers = question.en.answers.map((answer) => answer.text);
  if (kaAnswers.length !== ruAnswers.length) kaAnswers = ruAnswers;
  if (enAnswers.length !== ruAnswers.length) enAnswers = ruAnswers;
  const untranslated = [
    ["ru", question.flags.includes("ru_text_is_georgian_untranslated")],
    ["en", /[ა-ჰ]/.test(question.en?.question || "")],
  ].filter(([, bad]) => bad).map(([lang]) => lang);
  const row = new Map<string, Json>([
    ["id", question.id],
    ["t", question.topic_id],
    ["q", new Map<string, Json>([
      ["ru", question.question],
      ["ka", question.ka.question],
      ["en", question.en.question],
    ])],
    ["a", new Map<string, Json>([
      ["ru", ruAnswers],
      ["ka", kaAnswers],
      ["en", enAnswers],
    ])],
    ["c", question.answers.map((answer) => answer.n).indexOf(question.correct)],
    ["img", question.image ? `img/${basename(question.image)}` : null],
    ["ex", explanation || null],
    ["law", matchedRefs(question, source, quotes)],
    ["ep", question.episodes],
    ["src", question.source_url],
  ]);
  if (untranslated.length) row.set("nu", untranslated);
  const lesson = source.assigned[question.id] ?? null;
  row.set("lesson", lesson);
  const ref = primaryRef(question as never) as Ref | null;
  if (ref) {
    row.set("rule", new Map<string, Json>([
      ["key", ruleKey(ref)],
      ["label", ruleLabel(ref)],
    ]));
  }
  if (lesson) {
    const why = pitfallFor(ref, source.pitfalls[lesson] ?? {});
    if (why) row.set("why", why);
  }
  return row;
}

function matchedRefs(question: Question, source: TicketSources, quotes: Map<string, Json>): string[] {
  const explanation = question.explanation_ka || "";
  if (!explanation) return [];
  const keys: string[] = [];
  for (const ref of question.law_refs) {
    const article = String(ref.article);
    const paragraph = ref.paragraph;
    const ru = source.ru.get(article);
    const ka = source.ka.get(article);
    if (paragraph == null || !ru || !ka) continue;
    if (ru.order.length !== ka.order.length) continue;
    const kaText = ka.paras.get(String(paragraph));
    const ruText = lawText(source.ru, article, paragraph);
    if (!kaText || !ruText) continue;
    if (score(explanation, kaText) >= LAW_MATCH) keys.push(addLaw(quotes, source.ru, article, paragraph));
  }
  for (const ref of question.annex_refs) {
    for (const item of ref.items) {
      const annex = String(ref.annex);
      const kaText = source.annexKa.get(annex)?.get(item);
      const ruText = source.annexRu.get(annex)?.get(item);
      if (!kaText || !ruText) continue;
      if (score(explanation, kaText) >= ANNEX_MATCH) keys.push(addAnnex(quotes, source.annexRu, annex, item));
    }
  }
  return [...new Set(keys)];
}

function addLaw(quotes: Map<string, Json>, ru: Map<string, Article>, article: string, paragraph: number): string {
  const key = `L${article}.${paragraph}`;
  if (!quotes.has(key)) {
    quotes.set(key, new Map<string, Json>([
      ["ref", `ст. ${article}, п. ${paragraph}`],
      ["title", ru.get(article)?.title ?? ""],
      ["text", lawText(ru, article, paragraph)],
    ]));
  }
  return key;
}

function addAnnex(quotes: Map<string, Json>, annexRu: Map<string, Map<string, string>>, annex: string, item: string): string {
  const key = `A${annex}.${item}`;
  if (!quotes.has(key)) {
    const name = ANNEX_NAME[annex] ?? `Приложение ${annex}`;
    quotes.set(key, new Map<string, Json>([
      ["ref", `${name}, п. ${item}`],
      ["title", ""],
      ["text", annexRu.get(annex)?.get(item) ?? null],
    ]));
  }
  return key;
}

function lawText(ru: Map<string, Article>, article: string, paragraph: number | null): string | null {
  const found = ru.get(article);
  if (!found) return null;
  if (paragraph == null) return found.body ?? null;
  return found.paras.get(String(paragraph)) ?? null;
}

export function score(explanation: string, paragraph: string): number {
  const parts = explanation.split("თანახმად").slice(1);
  const segments = (parts.length ? parts : [explanation]).map((part) => difference(tokens(part), STOP));
  const paragraphTokens = difference(tokens(paragraph), STOP);
  const explanationTokens = difference(tokens(explanation), STOP);
  const direct = Math.max(...segments.map((segment) => overlap(segment, paragraphTokens) / Math.max(1, segment.size)));
  const reverse = overlap(paragraphTokens, explanationTokens) / Math.max(1, paragraphTokens.size);
  return Math.max(direct, reverse);
}

function tokens(text: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const word of (text ?? "").match(/[ა-ჰ]+/g) ?? []) {
    if (word.length >= 4) out.add(word.slice(0, 5));
  }
  return out;
}

function difference(left: Set<string>, right: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const item of left) if (!right.has(item)) out.add(item);
  return out;
}

function overlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const item of left) if (right.has(item)) count += 1;
  return count;
}

function ruleKey(ref: Ref): string {
  return ref.kind === "annex" ? `A${ref.major}:${py(ref.minor)}` : `${ref.major}.${py(ref.minor)}`;
}

function ruleLabel(ref: Ref): string {
  if (ref.kind === "annex") return `прил. ${ref.major}, ${ANNEX_KIND[ref.major] ?? "пункт"} ${py(ref.minor)}`;
  return `ст. ${ref.major}, п. ${py(ref.minor)}${ref.sub ? ` «${ref.sub}»` : ""}`;
}

function pitfallFor(ref: Ref | null, pitfalls: { [spec: string]: string }): string | null {
  if (!ref) return null;
  let best: { spec: string; text: string } | null = null;
  for (const [spec, text] of Object.entries(pitfalls)) {
    if (!covers(parseSpec(spec), ref)) continue;
    if (!best || spec.length > best.spec.length) best = { spec, text };
  }
  return best?.text ?? null;
}

function parseSpec(spec: string): Ref {
  if (spec.startsWith("A")) {
    const colon = spec.indexOf(":");
    return { kind: "annex", major: spec.slice(1, colon), minor: spec.slice(colon + 1), sub: null };
  }
  const parts = spec.split(".");
  return {
    kind: "law",
    major: parts[0],
    minor: Number(parts[1]),
    sub: parts.length > 2 ? parts.slice(2).join(".") : null,
  };
}

function covers(spec: Ref, ref: Ref): boolean {
  if (spec.kind !== ref.kind || spec.major !== ref.major) return false;
  if (spec.kind === "annex") return nested(spec.minor, ref.minor);
  if (spec.minor !== ref.minor) return false;
  return spec.sub === null || nested(spec.sub, ref.sub);
}

function nested(spec: number | string | null, value: number | string | null): boolean {
  if (value == null || spec == null) return false;
  const text = String(value);
  const head = String(spec);
  return text === head || text.startsWith(`${head}.`);
}

function py(value: unknown): string {
  return value == null ? "None" : String(value);
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}
