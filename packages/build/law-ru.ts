export type Article = {
  title: string;
  paras: Map<string, string>;
  order: string[];
  body?: string;
};

const MAXART = 64;
const SUPERSCRIPT: Record<string, string> = { "1": "¹", "2": "²", "3": "³", "4": "⁴" };
const NOISE = /^\s*(https?:\/\/www\.matsne\.gov\.ge.*|\d+\s*$|.*–\s*веб-страница,.*|.*ვებგვერდი,.*|.*Закон Грузии №\d+.*от .*\d{4} года.*|.*საქართველოს \d{4} წლის .*კანონი №.*)$/;
const ARTICLE = /^\s*(?:Статья|მუხლი)\s+(\d+)\s*\.\s*(.*)$/;
const PARAGRAPH_START = /^\d+\s*\.\s/;
const PARAGRAPH = /^(\d+)\s*\.\s+(.*)$/;
const SUBPOINT = /^([а-яa-z]|[ა-ჰ])(\.[а-яa-zა-ჰ])?\)/;
const ANNEX_HEAD = /^\s*(?:Приложение|დანართი)\s*№\s*(\d)/;
const ANNEX_ITEM = /^\s*(\d+(?:\.\d+)+)\.?((?:\s*[,–-]\s*\d+(?:\.\d+)+\.?)*)\s*(.*)$/;
const ANNEX_RANGE = /^\s*[–-]\s*(\d+(?:\.\d+)+)/;
const LETTER = /\p{L}/u;

type Open = {
  article: Article;
  point: string | null;
  last: number;
  titleOpen: boolean;
};

export function parseLaw(text: string): Map<string, Article> {
  const articles = new Map<string, Article>();
  let current: Open | null = null;
  let previous = 0;
  for (const line of splitLines(stripBom(text))) {
    if (NOISE.test(line)) continue;
    const header = ARTICLE.exec(line);
    if (header) {
      const raw = header[1];
      const number = Number(raw);
      const base = number <= MAXART ? number : Number(raw.slice(0, -1));
      if (base === previous || base === previous + 1 || (previous === 0 && base === 1)) {
        previous = base;
        current = openArticle(header[2].trim());
        articles.set(articleId(raw), current.article);
        continue;
      }
    }
    if (!current) continue;
    const source = line.trim();
    if (current.titleOpen) {
      if (!source) current.titleOpen = false;
      else if (!PARAGRAPH_START.test(source)) {
        current.article.title += ` ${source}`;
        continue;
      } else current.titleOpen = false;
    }
    const paragraph = PARAGRAPH.exec(source);
    if (paragraph) {
      const rawNumber = paragraph[1];
      const number = Number(rawNumber);
      let point: string | null = null;
      if (number === current.last + 1) {
        point = String(number);
        current.last = number;
      } else if (
        current.last
        && rawNumber.startsWith(String(current.last))
        && rawNumber.length === String(current.last).length + 1
      ) {
        const mark = rawNumber.endsWith("1") ? "¹" : `^${rawNumber.slice(-1)}`;
        point = `${current.last}${mark}`;
      }
      if (point) {
        current.point = point;
        current.article.paras.set(point, paragraph[2]);
        current.article.order.push(point);
        continue;
      }
    }
    if (current.point === null && source && current.article.order.length === 0) {
      current.article.body = `${current.article.body ?? ""} ${source}`;
      continue;
    }
    if (current.point && source) {
      const previousText = current.article.paras.get(current.point) ?? "";
      const gap = SUBPOINT.test(source) ? "\n" : " ";
      current.article.paras.set(current.point, previousText + gap + source);
    }
  }
  for (const article of articles.values()) polish(article);
  return articles;
}

export function parseAnnex(text: string): Map<string, Map<string, string>> {
  const annexes = new Map<string, Map<string, string>>();
  let current: Map<string, string> | null = null;
  for (const line of splitLines(stripBom(text))) {
    const head = ANNEX_HEAD.exec(line);
    if (head) {
      const number = String(Number(head[1]));
      current = annexes.get(number) ?? new Map();
      annexes.set(number, current);
      continue;
    }
    if (!current || NOISE.test(line)) continue;
    const item = ANNEX_ITEM.exec(line);
    if (!item || item[3].length <= 3 || !LETTER.test(item[3])) continue;
    const stored = line.trim();
    for (const key of itemKeys(item[1], item[2])) {
      if (!current.has(key)) current.set(key, stored);
    }
  }
  return annexes;
}

function openArticle(title: string): Open {
  return {
    article: { title, paras: new Map(), order: [] },
    point: null,
    last: 0,
    titleOpen: true,
  };
}

function polish(article: Article): void {
  if (article.body !== undefined) article.body = article.body.replace(/\s+/g, " ").trim();
  for (const [key, value] of article.paras) {
    article.paras.set(key, value.replace(/[ \t]+/g, " ").trim());
  }
}

// Matsne writes a raised article number glued to the parent: "111" is 11¹.
function articleId(raw: string): string {
  if (Number(raw) <= MAXART) return String(Number(raw));
  return raw.slice(0, -1) + (SUPERSCRIPT[raw.slice(-1)] ?? raw.slice(-1));
}

function itemKeys(first: string, tail: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const add = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };
  add(first);
  for (const key of tail.match(/\d+(?:\.\d+)+/g) ?? []) add(key);
  const range = ANNEX_RANGE.exec(tail);
  const dot = first.lastIndexOf(".");
  if (!range || dot < 0) return keys;
  const prefix = first.slice(0, dot);
  const start = first.slice(dot + 1);
  const end = range[1].slice(range[1].lastIndexOf(".") + 1);
  const endPrefix = range[1].slice(0, range[1].lastIndexOf("."));
  if (prefix !== endPrefix || !/^\d+$/.test(start) || !/^\d+$/.test(end)) return keys;
  for (let i = Number(start); i <= Number(end); i += 1) add(`${prefix}.${i}`);
  return keys;
}

function stripBom(text: string): string {
  return text.replaceAll("\ufeff", "");
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
