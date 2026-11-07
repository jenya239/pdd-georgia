import type { Json } from "./pyjson.ts";

const LAW_VERSION = "matsne pub36 2026-06-25";
const EN_VERSION = "2019-06-28";
const SUBPOINT = /^((?:[а-яa-zა-ჰ])(?:\.[а-яa-zა-ჰ])?)\)\s/;
const ANNEX_HEAD = /^\s*(?:Приложение|დანართი)\s*№\s*(\d)/;
const NOTE = /^\s*(Примечани[ея]|შენიშვნა)\s*[.:]/;
const SECTION = /^\s*(\d)\.\s+[^\d\s]/;
const NOTE_SUB = /^\s*((?:[а-яა-ჰ])(?:\.[а-яა-ჰ])?)\)\s/;

export type ParsedArticle = {
  title: string;
  paras: Map<string, string>;
  order: string[];
};

export type ParsedEn = {
  paras: Map<string, string>;
};

export type Note = {
  id: string;
  head: string;
  subs: { letters: string; line: string }[];
};

export type NormSources = {
  ru: Map<string, ParsedArticle>;
  ka: Map<string, ParsedArticle>;
  en: Map<string, ParsedEn>;
  annexRu: Map<string, Map<string, string>>;
  annexKa: Map<string, Map<string, string>>;
  notesRu: Map<number, Note[]>;
  notesKa: Map<number, Note[]>;
};

export function splitSubpoints(text: string | null | undefined): { letters: string; line: string }[] {
  const out: { letters: string; line: string }[] = [];
  for (const line of (text ?? "").split("\n").slice(1)) {
    const match = SUBPOINT.exec(line);
    if (match) out.push({ letters: match[1], line });
  }
  return out;
}

export function parseAnnexNotes(text: string): Map<number, Note[]> {
  const notes = new Map<number, Note[]>();
  let annex: number | null = null;
  let section: string | null = null;
  let current: Note | null = null;
  for (const line of splitLines(text.replaceAll("\ufeff", ""))) {
    const head = ANNEX_HEAD.exec(line);
    if (head) {
      annex = Number(head[1]);
      section = null;
      current = null;
      if (!notes.has(annex)) notes.set(annex, []);
      continue;
    }
    if (annex === null) continue;
    if (NOTE.test(line) && section) {
      const list = notes.get(annex) ?? [];
      const seen = list.filter((note) => note.id.split(".")[0] === section).length;
      current = { id: `${section}.прим${seen ? String(seen + 1) : ""}`, head: line.trim(), subs: [] };
      list.push(current);
      notes.set(annex, list);
      continue;
    }
    const sectionMatch = SECTION.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      current = null;
      continue;
    }
    const sub = NOTE_SUB.exec(line);
    if (current && sub) current.subs.push({ letters: sub[1], line: line.trim() });
    else current = null;
  }
  return notes;
}

export function generateNorms(source: NormSources): Map<string, Json>[] {
  const out: Map<string, Json>[] = [];
  for (const [articleId, article] of source.ru) {
    const ka = source.ka.get(articleId);
    out.push(articleRecord(articleId, article.title, ka?.title ?? null));
    for (const paragraph of article.order) {
      const text = article.paras.get(paragraph) ?? "";
      const textKa = ka?.paras.get(paragraph) ?? null;
      const paragraphId = `${articleId}.${paragraph}`;
      const english = source.en.get(articleId)?.paras.get(paragraph);
      out.push(lawRecord({
        id: paragraphId,
        parent: articleId,
        article: articleId,
        paragraph,
        sub: null,
        ru: text,
        ka: textKa,
        en: english && enMatches(text, english) ? english : undefined,
      }));
      const ruSubs = splitSubpoints(text);
      const kaSubs = splitSubpoints(textKa);
      const aligned = sameShape(ruSubs, kaSubs);
      for (let i = 0; i < ruSubs.length; i += 1) {
        const sub = ruSubs[i];
        out.push(lawRecord({
          id: `${paragraphId}.${sub.letters}`,
          parent: nestedParent(paragraphId, sub.letters),
          article: articleId,
          paragraph,
          sub: sub.letters,
          ru: sub.line,
          ka: aligned ? kaSubs[i].line : null,
        }));
      }
    }
  }
  for (const annex of numericKeys(source.annexRu)) {
    const ruItems = source.annexRu.get(String(annex)) ?? new Map<string, string>();
    const kaItems = source.annexKa.get(String(annex));
    const ids = new Set<string>([...ruItems.keys(), ...(kaItems?.keys() ?? [])]);
    for (const item of [...ids].sort(compareDotted)) {
      out.push(annexRecord(
        annex,
        item,
        annexParent(annex, item, ids),
        ruItems.has(item) ? ruItems.get(item) ?? "" : null,
        kaItems?.has(item) ? kaItems.get(item) ?? "" : null,
      ));
    }
  }
  for (const annex of [...source.notesRu.keys()].sort((left, right) => left - right)) {
    const kaNotes = new Map((source.notesKa.get(annex) ?? []).map((note) => [note.id, note]));
    for (const note of source.notesRu.get(annex) ?? []) {
      const ka = kaNotes.get(note.id);
      const groupId = `A${annex}:${note.id}`;
      out.push(annexRecord(annex, note.id, null, note.head, ka?.head ?? null));
      const kaSubs = ka?.subs ?? [];
      const aligned = sameShape(note.subs, kaSubs);
      for (let i = 0; i < note.subs.length; i += 1) {
        const sub = note.subs[i];
        out.push(annexRecord(
          annex,
          `${note.id}.${sub.letters}`,
          nestedParent(groupId, sub.letters),
          sub.line,
          aligned ? kaSubs[i].line : null,
        ));
      }
    }
  }
  return out;
}

function articleRecord(id: string, title: string, titleKa: string | null): Map<string, Json> {
  return new Map<string, Json>([
    ["id", id],
    ["kind", "article"],
    ["parent", null],
    ["article", id],
    ["title", title],
    ["title_ka", titleKa],
    ["version", LAW_VERSION],
  ]);
}

function lawRecord(fields: {
  id: string;
  parent: string;
  article: string;
  paragraph: string;
  sub: string | null;
  ru: string;
  ka: string | null;
  en?: string;
}): Map<string, Json> {
  const row = new Map<string, Json>([
    ["id", fields.id],
    ["kind", "law"],
    ["parent", fields.parent],
    ["article", fields.article],
    ["paragraph", fields.paragraph],
    ["sub", fields.sub],
    ["ru", fields.ru],
    ["ka", fields.ka],
    ["version", LAW_VERSION],
  ]);
  if (fields.en !== undefined) {
    row.set("en", fields.en);
    row.set("en_version", EN_VERSION);
  }
  return row;
}

function annexRecord(
  annex: number,
  item: string,
  parent: string | null,
  ru: string | null,
  ka: string | null,
): Map<string, Json> {
  const row = new Map<string, Json>([
    ["id", `A${annex}:${item}`],
    ["kind", "annex"],
    ["parent", parent],
    ["annex", annex],
    ["item", item],
    ["ru", ru],
    ["ka", ka],
    ["version", LAW_VERSION],
  ]);
  if (ru === null) row.set("ru_missing", true);
  return row;
}

function enMatches(ru: string, en: string): boolean {
  const left = digitRuns(ru);
  const right = digitRuns(en);
  if (left.length !== right.length || left.some((item, index) => item !== right[index])) return false;
  const ratio = en.length / Math.max(1, ru.length);
  return ratio >= 0.6 && ratio <= 1.7;
}

function digitRuns(text: string): string[] {
  return (text.match(/\d+/g) ?? []).sort();
}

function sameShape(left: { letters: string }[], right: { letters: string }[]): boolean {
  return left.length === right.length
    && left.every((item, index) => dotCount(item.letters) === dotCount(right[index].letters));
}

function dotCount(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; i += 1) if (value[i] === ".") count += 1;
  return count;
}

function nestedParent(prefix: string, letters: string): string {
  const dot = letters.lastIndexOf(".");
  return dot < 0 ? prefix : `${prefix}.${letters.slice(0, dot)}`;
}

function annexParent(annex: number, item: string, ids: Set<string>): string | null {
  const parts = item.split(".");
  for (let length = parts.length - 1; length >= 1; length -= 1) {
    const prefix = parts.slice(0, length).join(".");
    if (ids.has(prefix)) return `A${annex}:${prefix}`;
  }
  return null;
}

function numericKeys(map: Map<string, unknown>): number[] {
  return [...map.keys()].map(Number).sort((left, right) => left - right);
}

function compareDotted(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

function splitLines(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (!isLineBreak(code)) continue;
    lines.push(text.slice(start, i));
    if (code === 13 && text.charCodeAt(i + 1) === 10) i += 1;
    start = i + 1;
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

function isLineBreak(code: number): boolean {
  return code === 10 || code === 11 || code === 12 || code === 13
    || code === 0x1c || code === 0x1d || code === 0x1e
    || code === 0x85 || code === 0x2028 || code === 0x2029;
}
