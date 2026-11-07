import { createHash } from "node:crypto";
import type { Json } from "./pyjson.ts";

const UNTRANSLATED = "ru_text_is_georgian_untranslated";
const PLACEHOLDER = /§\s*(\d+)\s*§/;

export type TranslationEntry = {
  h: string;
  ru: string;
  masked?: boolean;
};

export type TranslationQuestion = {
  id: number;
  explanation_ka?: string | null;
  flags: string[];
  ka: { question: string; answers: { text: string }[] };
};

export function sourceHash(text: string): string {
  return createHash("sha1").update(text, "utf8").digest("hex").slice(0, 12);
}

export function translationJobs(questions: TranslationQuestion[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const question of questions) {
    if (question.explanation_ka) out.set(`${question.id}:ex`, question.explanation_ka);
    if (question.flags.includes(UNTRANSLATED)) {
      out.set(`${question.id}:q`, question.ka.question);
      question.ka.answers.forEach((answer, index) => out.set(`${question.id}:a${index}`, answer.text));
    }
  }
  return out;
}

export function cacheErrors(jobs: Map<string, string>, cache: { [key: string]: TranslationEntry }): string[] {
  const errors: string[] = [];
  for (const [key, src] of jobs) {
    const entry = cache[key];
    if (!entry) errors.push(`${key}: no machine translation (run tools/translate_ka.py)`);
    else if (entry.h !== sourceHash(src)) errors.push(`${key}: machine translation is stale (run tools/translate_ka.py)`);
    else if (!entry.ru.trim() || PLACEHOLDER.test(entry.ru)) errors.push(`${key}: empty translation or an unrestored placeholder`);
  }
  return errors;
}

export function applyTranslations(
  tickets: Map<string, Json>[],
  questions: TranslationQuestion[],
  cache: { [key: string]: TranslationEntry },
): Map<string, Json>[] {
  const jobs = translationJobs(questions);
  const errors = cacheErrors(jobs, cache);
  if (errors.length) {
    throw new Error(`${errors.length} machine translations are missing or stale:\n${errors.slice(0, 20).join("\n")}`);
  }
  const byId = new Map(tickets.map((ticket) => [ticket.get("id"), ticket]));
  for (const key of jobs.keys()) {
    const colon = key.indexOf(":");
    const ticket = byId.get(Number(key.slice(0, colon)));
    if (!ticket) throw new Error(`missing ticket ${key}`);
    const ru = cache[key].ru;
    const field = key.slice(colon + 1);
    if (field === "ex") ticket.set("ex_ru", ru);
    else if (field === "q") machine(ticket).set("q", ru);
    else (machine(ticket).get("a") as Json[]).push(ru);
  }
  return tickets;
}

function machine(ticket: Map<string, Json>): Map<string, Json> {
  const found = ticket.get("mt");
  if (found instanceof Map) return found;
  const created = new Map<string, Json>([["q", ""], ["a", []]]);
  ticket.set("mt", created);
  return created;
}
