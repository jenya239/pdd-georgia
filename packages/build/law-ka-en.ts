export type EnArticle = {
  title: string;
  paras: Map<string, string>;
};

const SUPERSCRIPT: Record<string, string> = { "1": "¹", "2": "²", "3": "³", "4": "⁴" };
const NOISE = /^\s*(https?:\/\/www\.matsne\.gov\.ge.*|\s*\d+\s*)$/;
const ARTICLE = /^Article (\d+) – (.*)$/;
const PARAGRAPH = /^(\d+)(¹|\d)?\. (.*)$/;
const SUBPOINT = /^[a-z](\.[a-z])?\)/;

export function parseLawEn(text: string): Map<string, EnArticle> {
  const articles = new Map<string, EnArticle>();
  let current: EnArticle | null = null;
  let paragraph: string | null = null;
  let previous = 0;
  for (const line of splitLines(text)) {
    if (NOISE.test(line)) continue;
    const header = ARTICLE.exec(line.trim());
    if (header) {
      const found = articleId(header[1], previous);
      if (found) {
        previous = found.base;
        paragraph = null;
        current = { title: header[2].trim(), paras: new Map() };
        articles.set(found.id, current);
        continue;
      }
    }
    if (!current) continue;
    const source = line.trim();
    const point = PARAGRAPH.exec(source);
    const next = point ? Number(point[1]) : NaN;
    if (
      point
      && !current.paras.has(String(next))
      && (paragraph === null || next === Number(paragraph.replace(/¹+$/u, "")) + 1)
    ) {
      paragraph = point[1];
      current.paras.set(paragraph, point[3]);
    } else if (paragraph && source) {
      const gap = SUBPOINT.test(source) ? "\n" : " ";
      current.paras.set(paragraph, `${current.paras.get(paragraph) ?? ""}${gap}${source}`);
    }
  }
  for (const article of articles.values()) {
    for (const [key, value] of article.paras) {
      article.paras.set(key, value.replace(/[ \t]+/g, " ").trim());
    }
  }
  return articles;
}

function articleId(raw: string, previous: number): { id: string; base: number } | null {
  const number = Number(raw);
  if (
    number === previous
    || number === previous + 1
    || (previous === 0 && number === 1)
    || (number > previous + 1 && number < previous + 4)
  ) {
    return { id: String(number), base: number };
  }
  const base = raw.length > 1 ? Number(raw.slice(0, -1)) : -1;
  if (base !== previous && base !== previous + 1) return null;
  const mark = SUPERSCRIPT[raw.slice(-1)];
  if (!mark) throw new Error(`unmapped English article suffix ${raw}`);
  return { id: raw.slice(0, -1) + mark, base };
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
