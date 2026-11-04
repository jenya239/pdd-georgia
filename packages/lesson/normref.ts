const SP = "[\\s\\u00a0]*";
const SUPS = "¹²³⁴";
const NUM = `\\d{1,3}[${SUPS}]?`;
const WORD = "0-9A-Za-zА-Яа-яЁё_";
const UNITS = `(?:км|м(?![${WORD}])|метр|см|мм|кг|т(?![${WORD}])|тонн|%|°|мест|лет|год|сек|секунд|мин|час|кВт|чел|раз|колёс|колес|руб|лари|GEL)`;
const PNUM = `${NUM}(?![\\d${SUPS}]|[.,]\\d|${SP}${UNITS}|${SP}[–—-]${SP}\\d+${SP}${UNITS})`;
const LETTER = "[а-яё](?:\\.[а-яё])?";
const SUB = `«${LETTER}»`;
const SUBS = `${SUB}(?:${SP}(?:,|и|или)${SP}${SUB})*`;
const LSEP = `${SP}(?:,|и|или|–|—|-)${SP}`;
const PITEM = `${PNUM}(?:${SP}${SUBS})?`;
const PLIST = `${PITEM}(?:${LSEP}${PITEM})*`;
const DNUM = "\\d{1,2}(?:\\.\\d{1,2}){1,2}(?![.\\d])";
const DLIST = `${DNUM}(?:${LSEP}${DNUM})*`;
const NOT_WORD = "(?<![А-Яа-яЁёA-Za-z])";
const ART_KW = "(?:[Сс]т\\.|[Сс]тать(?:я|и|ю|ей|е|ёй|ях|ям|ями))";
const PAR_KW = "(?:[Пп]п?\\.|[Пп]ункт(?:а|у|ом|е|ы|ов|ам|ами|ах)?)";
const SUB_KW = "(?:[Пп]одпункт(?:а|у|ом|е|ы|ов|ам|ами|ах)?|[Пп]одп\\.)";
const THIS_ART = "(?:настоящей|этой|той же) статьи";
const FLAGS = "dgsu";

const RE_ART_FIRST = new RegExp(
  `${NOT_WORD}(?<akw>${ART_KW})${SP}(?<anum>${NUM})(?![\\d.${SUPS}])(?:${SP},?${SP}(?:(?<pkw>${PAR_KW})${SP}(?<plist>${PLIST})))?`,
  FLAGS,
);
const RE_PAR_FIRST = new RegExp(
  `${NOT_WORD}(?:(?<skw>${SUB_KW})${SP}(?<slist>${SUBS})${SP},?${SP})?(?<pkw>${PAR_KW})${SP}(?<plist>${PLIST})(?:${SP},?${SP}(?:(?<akw>${ART_KW})${SP}(?<anum>${NUM})(?![\\d.${SUPS}])|(?<this>${THIS_ART})))?`,
  FLAGS,
);
const RE_SIGN = new RegExp(`${NOT_WORD}(?<kw>[Зз]нак(?:а|у|ом|е|и|ов|ам|ами|ах)?)(?:${SP}«[^»]{1,60}»)?${SP}(?<list>${DLIST})`, FLAGS);
const RE_MARK = new RegExp(`${NOT_WORD}(?<kw>[Рр]азметк(?:а|и|у|ой|е|ам|ами|ах)|[Рр]азметок)(?:${SP}«[^»]{1,60}»)?${SP}(?<list>${DLIST})`, FLAGS);
const RE_ANNEX = new RegExp(
  `${NOT_WORD}(?<kw>[Пп]рил(?:\\.|ожени(?:е|я|и|ю|ем)))${SP}(?:№${SP})?(?<an>[12])(?!\\d)(?:${SP},?${SP}(?:${PAR_KW}${SP}(?<list>${DLIST})|[Пп]римечани[${WORD}]*${SP}(?<nsub>«${LETTER}»)?${SP}(?:к|в)${SP}(?:раздел[${WORD}]*|глав[${WORD}]*)${SP}(?<sec>\\d{1,2})))`,
  FLAGS,
);
const RE_BARE_DOTTED = new RegExp(`${NOT_WORD}${PAR_KW}${SP}(?<list>${DLIST})`, FLAGS);
const RE_EXTERNAL = new RegExp(`^[\\s\\u00a0,]*(?:\\S+\\s+){0,2}?(?:Кодекс[${WORD}]*|[Зз]акона Грузии(?![\\s\\u00a0]*«О дорожном движении»)|Конституц[${WORD}]*|[Пп]остановлени[${WORD}]*|[Пп]риказ[${WORD}]*|Конвенц[${WORD}]*)`, "su");
const RE_SUB = new RegExp(`«(${LETTER})»`, "dgu");
const RE_PITEM = new RegExp(`(?<n>${PNUM})(?:${SP}(?<subs>${SUBS}))?`, "dgu");
const SETTLEMENT = new RegExp(`(?:населе|населё|ненаселе)нн[${WORD}]*[\\s\\u00a0]*$`, "su");
const SUP_ID: Record<string, string[]> = { "¹": ["¹", "^1"], "²": ["^2", "²"], "³": ["^3", "³"], "⁴": ["^4", "⁴"] };

export type NormRef = {
  start: number;
  end: number;
  text: string;
  kind: "law" | "annex";
  art: string | null;
  par: string | null;
  sub: string | null;
  annex: string | null;
  item: string | null;
  thisArticle: boolean;
  status: string;
  norm: string | null;
  extra: Record<string, unknown>;
};

type Match = RegExpMatchArray & { indices?: { groups?: Record<string, [number, number] | undefined> } };

function span(match: Match, name: string): [number, number] | undefined {
  return match.indices?.groups?.[name];
}

function has(match: Match, name: string): boolean {
  return span(match, name) !== undefined;
}

function textOf(match: Match, name: string): string {
  const at = span(match, name);
  return at ? match.input!.slice(at[0], at[1]) : "";
}

function ref(start: number, end: number, kind: "law" | "annex", fields: Partial<NormRef> = {}): NormRef {
  return {
    start, end, text: "", kind,
    art: fields.art ?? null, par: fields.par ?? null, sub: fields.sub ?? null,
    annex: fields.annex ?? null, item: fields.item ?? null,
    thisArticle: fields.thisArticle ?? false, status: fields.status ?? "pending", norm: null,
    extra: fields.extra ?? {},
  };
}

function subLetters(value: string): [number, number, string][] {
  return [...value.matchAll(RE_SUB)].map((match) => [match.index!, match.index! + match[0].length, match[1]]);
}

function plistItems(value: string, offset: number): [number, number, string, [number, number, string][]][] {
  const out: [number, number, string, [number, number, string][]][] = [];
  for (const match of value.matchAll(RE_PITEM) as Iterable<Match>) {
    const subs = has(match, "subs")
      ? subLetters(textOf(match, "subs")).map(([a, b, letter]) => [offset + span(match, "subs")![0] + a, offset + span(match, "subs")![0] + b, letter] as [number, number, string])
      : [];
    out.push([offset + match.index!, offset + match.index! + match[0].length, textOf(match, "n"), subs]);
  }
  return out;
}

function lawRefs(text: string, match: Match, firstStart: number, art: string | null, thisArticle: boolean, tailEnd?: number, leadSubs?: [number, number, string][]): NormRef[] {
  const refs: NormRef[] = [];
  const items = plistItems(textOf(match, "plist"), span(match, "plist")![0]);
  for (const [index, [start, end, num, subs]] of items.entries()) {
    const at = index === 0 ? firstStart : start;
    if (leadSubs) {
      for (const [j, [a, b, letter]] of leadSubs.entries()) {
        refs.push(ref(j === 0 ? firstStart : a, b, "law", { art, par: num, sub: letter, thisArticle }));
      }
      continue;
    }
    if (!subs.length) {
      refs.push(ref(at, end, "law", { art, par: num, thisArticle }));
      continue;
    }
    for (const [j, [a, b, letter]] of subs.entries()) {
      refs.push(ref(j === 0 ? at : a, b, "law", { art, par: num, sub: letter, thisArticle }));
    }
  }
  if (tailEnd !== undefined && refs.length === 1) refs[0].end = tailEnd;
  for (const item of refs) {
    item.text = text.slice(item.start, item.end);
    item.extra.grp = match.index;
  }
  return refs;
}

function finish(text: string, refs: NormRef[]) {
  for (const item of refs) item.text = text.slice(item.start, item.end);
}

export function findRu(text: string): NormRef[] {
  const cands: [number, number, NormRef[]][] = [];
  for (const match of text.matchAll(RE_ART_FIRST) as Iterable<Match>) {
    const art = textOf(match, "anum");
    const refs = has(match, "plist")
      ? lawRefs(text, match, match.index!, art, false)
      : [ref(match.index!, match.index! + match[0].length, "law", { art, extra: {} })];
    if (!has(match, "plist")) refs[0].text = match[0];
    cands.push([match.index!, match.index! + match[0].length, refs]);
  }
  for (const match of text.matchAll(RE_PAR_FIRST) as Iterable<Match>) {
    if (SETTLEMENT.test(text.slice(Math.max(0, match.index! - 20), match.index))) continue;
    const art = has(match, "anum") ? textOf(match, "anum") : null;
    const lead = has(match, "slist")
      ? subLetters(textOf(match, "slist")).map(([a, b, letter]) => [a + span(match, "slist")![0], b + span(match, "slist")![0], letter] as [number, number, string])
      : undefined;
    cands.push([match.index!, match.index! + match[0].length, lawRefs(text, match, match.index!, art, has(match, "this"), match.index! + match[0].length, lead)]);
  }
  for (const [pattern, annex] of [[RE_SIGN, "1"], [RE_MARK, "2"]] as const) {
    for (const match of text.matchAll(pattern) as Iterable<Match>) {
      const refs: NormRef[] = [];
      const listAt = span(match, "list")![0];
      for (const [index, dotted] of [...textOf(match, "list").matchAll(new RegExp(DNUM, "dgu"))].entries()) {
        const start = listAt + dotted.index!;
        const end = start + dotted[0].length;
        refs.push(ref(index === 0 ? match.index! : start, end, "annex", { annex, item: dotted[0] }));
      }
      finish(text, refs);
      cands.push([match.index!, match.index! + match[0].length, refs]);
    }
  }
  for (const match of text.matchAll(RE_ANNEX) as Iterable<Match>) {
    const annex = textOf(match, "an");
    const refs: NormRef[] = [];
    if (has(match, "list")) {
      const listAt = span(match, "list")![0];
      for (const [index, dotted] of [...textOf(match, "list").matchAll(new RegExp(DNUM, "dgu"))].entries()) {
        const start = listAt + dotted.index!;
        const end = start + dotted[0].length;
        refs.push(ref(index === 0 ? match.index! : start, end, "annex", { annex, item: dotted[0] }));
      }
    } else {
      const note = has(match, "nsub") ? textOf(match, "nsub").slice(1, -1) : "";
      refs.push(ref(match.index!, match.index! + match[0].length, "annex", {
        annex, item: `${textOf(match, "sec")}.прим`, extra: { note_letters: note },
      }));
    }
    finish(text, refs);
    cands.push([match.index!, match.index! + match[0].length, refs]);
  }
  for (const match of text.matchAll(RE_BARE_DOTTED) as Iterable<Match>) {
    cands.push([match.index!, match.index! + match[0].length, [ref(match.index!, match.index! + match[0].length, "annex", {
      status: "ambiguous", extra: { why: "dotted number without annex" },
    })]]);
    cands.at(-1)![2][0].text = match[0];
  }
  cands.sort((a, b) => a[0] - b[0] || (b[1] - b[0]) - (a[1] - a[0]));
  const out: NormRef[] = [];
  let last = -1;
  for (const [start, end, refs] of cands) {
    if (start < last) continue;
    last = end;
    if (RE_EXTERNAL.test(text.slice(end, end + 60))) for (const item of refs) item.status = "external";
    out.push(...refs);
  }
  return out;
}

function parIds(par: string): string[] {
  for (const [mark, alts] of Object.entries(SUP_ID)) if (par.endsWith(mark)) return alts.map((alt) => par.slice(0, -1) + alt);
  return [par];
}

export function lawId(art: string, par: string | null, sub: string | null, ids: Set<string>): string | null {
  if (par === null) return ids.has(art) ? art : null;
  for (const item of parIds(par)) {
    const id = `${art}.${item}${sub ? `.${sub}` : ""}`;
    if (ids.has(id)) return id;
  }
  return null;
}

export function explicitCites(refs: NormRef[]): [string, string | null][] {
  return refs.filter((item) => item.kind === "law" && item.art && item.status === "pending").map((item) => [item.art!, item.par]);
}

function contextArticle(par: string, scopes: [string, string | null][][]): [string | null, string] {
  for (const cites of scopes) {
    const same = new Set(cites.filter(([, paragraph]) => paragraph === par).map(([article]) => article));
    if (same.size === 1) return [same.values().next().value!, "same paragraph cited"];
    if (same.size > 1) return [null, "paragraph cited under several articles"];
  }
  return [null, "paragraph never cited with an article"];
}

function resolveAnnex(item: NormRef, ids: Set<string>) {
  if (item.item!.includes(".прим")) {
    const sec = item.item!.split(".")[0];
    const letters = String(item.extra.note_letters ?? "");
    const pattern = new RegExp(`^A${item.annex}:${sec}\\.прим\\d*${letters ? `\\.${letters.replaceAll(".", "\\.")}` : ""}$`, "u");
    const found = [...ids].filter((id) => pattern.test(id)).sort();
    if (found.length === 1) {
      item.status = "linked";
      item.norm = found[0];
    } else item.status = found.length ? "ambiguous" : "missing";
    return;
  }
  const id = `A${item.annex}:${item.item}`;
  item.status = ids.has(id) ? "linked" : "missing";
  item.norm = ids.has(id) ? id : null;
}

function bareArticle(item: NormRef, scopes: [string, string | null][][], ownArticle: string | null, ids: Set<string>): string | null {
  const others = new Set((scopes[0] ?? []).map(([article]) => article));
  if (ownArticle !== null) others.delete(ownArticle);
  if (ownArticle !== null) {
    if (item.thisArticle || others.size === 0) return ownArticle;
    item.extra.why = "bare paragraph in a text that names another article";
    return null;
  }
  if (item.thisArticle) {
    const articles = new Set((scopes[0] ?? []).map(([article]) => article));
    if (articles.size === 1) return articles.values().next().value!;
    item.extra.why = "«настоящей статьи» outside a single-article block";
    return null;
  }
  let [article, why] = contextArticle(item.par!, scopes);
  if (article !== null) {
    const rivals = new Set(scopes.flatMap((cites) => cites.map(([name]) => name)).filter((name) => name !== article && lawId(name, item.par, item.sub, ids)));
    if (rivals.size) [article, why] = [null, "the paragraph exists in another article cited nearby"];
  }
  if (article === null) item.extra.why = why;
  return article;
}

export function resolveRu(refs: NormRef[], ids: Set<string>, scopes: [string, string | null][][] = [], ownArticle: string | null = null): NormRef[] {
  const arts = new Map<number, string>();
  refs.forEach((item, index) => {
    if (item.status !== "pending") return;
    if (item.kind === "annex") {
      resolveAnnex(item, ids);
      return;
    }
    const article = item.art ?? bareArticle(item, scopes, ownArticle, ids);
    if (article !== null) arts.set(index, article);
  });
  const groups = new Map<unknown, number[]>();
  refs.forEach((item, index) => {
    if (item.kind === "law" && item.art === null && "grp" in item.extra && item.status === "pending") {
      const list = groups.get(item.extra.grp) ?? [];
      list.push(index);
      groups.set(item.extra.grp, list);
    }
  });
  for (const indexes of groups.values()) {
    if (new Set(indexes.map((index) => arts.get(index))).size > 1) {
      for (const index of indexes) {
        arts.delete(index);
        refs[index].status = "ambiguous";
        refs[index].extra.why = "list items point to different articles";
      }
    }
  }
  refs.forEach((item, index) => {
    if (item.status !== "pending") return;
    const article = arts.get(index);
    if (article === undefined) {
      item.status = "ambiguous";
      return;
    }
    const id = lawId(article, item.par, item.sub, ids);
    item.status = id ? "linked" : "missing";
    item.norm = id;
  });
  return refs;
}
