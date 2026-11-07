import { lawId } from "../lesson/normref.ts";

const KA = "აბგდევზთიკლმნოპჟრსტუფ";
const RU = "абвгдежзиклмнопрстуф";
const KA_TO_RU: Record<string, string> = Object.fromEntries(
  [...KA].map((letter, index) => [letter, [...RU][index]]).filter(([, ru]) => ru),
);
const KN = "(?:\\d+-ე|მე-\\d+(?:-ე)?|პირველ(?:ი|მა)?|მეორე)";
const KSEP = "[\\s\\u00a0]*(?:,|და|\u2013|\u2212|-|\u2014)[\\s\\u00a0]*";
const KQ = "[„“\"«]";
const KQE = "[“”\"»]";
const KLET = "[ა-ჰ](?:\\.[ა-ჰ])?";
const DNUM = "\\d{1,2}(?:\\.\\d{1,2}){1,2}(?![.\\d])";
const LAW = new RegExp(
  `(?<art>(?:(?<this>ამ(?:ავე)?)|(?<anum>${KN}))[\\s\\u00a0]+მუხლ(?:ის|ით|ითა|ში|ზე|ი)?)(?![ა-ჰ])(?:[\\s\\u00a0]+(?<plist>${KN}(?:${KSEP}${KN})*)[\\s\\u00a0]+პუნქტ[ა-ჰ]*(?:[\\s\\u00a0]+(?<slist>${KQ}${KLET}${KQE}(?:${KSEP}${KQ}${KLET}${KQE})*)[\\s\\u00a0]+ქვეპუნქტ[ა-ჰ]*)?)?`,
  "dgu",
);
const DOTTED = new RegExp(`(?<![\\d.])(?<list>${DNUM}(?:${KSEP}${DNUM})*)(?<after>[\\s\\u00a0]*(?:საგზაო[\\s\\u00a0]+)?(?:ნიშ|მონიშვნ|${KQ}))?`, "dgu");
const ANNEX = /(პირველ(?:ი|მა)?|მე-2|მეორე)[\s\u00a0]+დანართ/gu;
const EXTERNAL = /(?:კოდექსის|კონსტიტუციის|კონვენციის|დადგენილების|ბრძანების)[\s\u00a0]*$/u;
const NUMBER = new RegExp(KN, "dgu");
const LETTER = new RegExp(`${KQ}(${KLET})${KQE}`, "dgu");
const DOT = new RegExp(DNUM, "dgu");

type Match = RegExpMatchArray & { indices?: { groups?: Record<string, [number, number] | undefined> } };

export type KaRef = {
  start: number;
  end: number;
  text: string;
  kind: "law" | "annex";
  art: string | null;
  par: string | null;
  annex: string | null;
  item: string | null;
  thisArticle: boolean;
  status: string;
  norm: string | null;
  extra: { ka_sub?: string; explicit?: boolean };
};

export function findKa(text: string): KaRef[] {
  const refs: KaRef[] = [];
  let lastArticle: string | null = null;
  for (const match of all(LAW, text)) {
    const here = match.index ?? 0;
    if (group(match, "this") !== undefined) {
      pushLaw(refs, match, lastArticle, true);
      continue;
    }
    const article = pyNum(kaNumber(group(match, "anum") ?? ""));
    if (EXTERNAL.test(text.slice(Math.max(0, here - 40), here))) {
      refs.push(lawRef(here, here + match[0].length, article, null, false, "external"));
      continue;
    }
    lastArticle = article;
    pushLaw(refs, match, article, false);
  }
  const taken = refs.map((ref) => [ref.start, ref.end] as [number, number]);
  for (const match of all(DOTTED, text)) {
    const here = match.index ?? 0;
    if (taken.some(([start, end]) => start < here + match[0].length && here < end)) continue;
    const after = (group(match, "after") ?? "").trim();
    const annex = annexOf(text, here, after);
    const listAt = startOf(match, "list") ?? here;
    for (const dotted of all(DOT, group(match, "list") ?? "")) {
      const at = listAt + (dotted.index ?? 0);
      const ref = annexRef(at, at + dotted[0].length, dotted[0], annex, after.includes("ნიშ") || after.includes("მონიშვნ"));
      if (annex === null) ref.status = "ambiguous";
      refs.push(ref);
    }
  }
  refs.sort((left, right) => left.start - right.start);
  for (const ref of refs) if (!ref.text) ref.text = text.slice(ref.start, ref.end);
  return refs;
}

export function resolveKa(
  refs: KaRef[],
  ids: Set<string>,
  kaText: Map<string, string>,
  confirmed: string[],
  strict = false,
): KaRef[] {
  const known = new Set(confirmed);
  for (const ref of refs) {
    if (ref.status !== "pending") continue;
    const explicit = !strict && (ref.kind === "annex" ? ref.extra.explicit === true : !ref.thisArticle);
    if (ref.kind === "annex") {
      linkAnnex(ref, ids, known, explicit);
      continue;
    }
    linkLaw(ref, ids, kaText, known, explicit);
  }
  return refs;
}

function pushLaw(refs: KaRef[], match: Match, article: string | null, thisArticle: boolean): void {
  const here = match.index ?? 0;
  const plist = group(match, "plist");
  if (!plist) {
    const ref = lawRef(here, here + match[0].length, article, null, thisArticle, "pending");
    if (article === null) ref.status = "ambiguous";
    refs.push(ref);
    return;
  }
  const pars = numbers(plist, startOf(match, "plist") ?? here);
  const letters = letterSpans(group(match, "slist") ?? "", startOf(match, "slist") ?? 0);
  if (letters.length && pars.length === 1) {
    letters.forEach(([from, to, letter], index) => {
      refs.push(lawRef(
        index === 0 ? here : from - 1,
        letters.length === 1 ? here + match[0].length : to + 1,
        article,
        pyNum(pars[0][2]),
        thisArticle,
        "pending",
        letter,
      ));
    });
  } else {
    pars.forEach(([from, to, num], index) => {
      refs.push(lawRef(index === 0 ? here : from, pars.length === 1 ? here + match[0].length : to, article, pyNum(num), thisArticle, "pending"));
    });
  }
  for (const ref of refs) if (ref.art === null && ref.status === "pending") ref.status = "ambiguous";
}

function linkAnnex(ref: KaRef, ids: Set<string>, confirmed: Set<string>, explicit: boolean): void {
  const id = `A${ref.annex}:${ref.item}`;
  if (!ids.has(id)) {
    ref.status = "missing";
    return;
  }
  if (explicit || confirms(id, confirmed)) {
    ref.status = "linked";
    ref.norm = id;
    return;
  }
  ref.status = "unverified";
}

function linkLaw(ref: KaRef, ids: Set<string>, kaText: Map<string, string>, confirmed: Set<string>, explicit: boolean): void {
  const parId = ref.par ? lawId(ref.art ?? "", ref.par, null, ids) : lawId(ref.art ?? "", null, null, ids);
  if (parId === null) {
    ref.status = "missing";
    return;
  }
  let norm = parId;
  if (ref.extra.ka_sub) {
    const sub = kaSub(parId, ref.extra.ka_sub, ids, kaText);
    if (sub) norm = sub;
  }
  let ok = explicit || confirms(norm, confirmed);
  if (norm !== parId && !ok && confirms(parId, confirmed)) {
    norm = parId;
    ok = true;
  }
  ref.status = ok ? "linked" : "unverified";
  ref.norm = ok ? norm : null;
}

function kaSub(parId: string, letter: string, ids: Set<string>, kaText: Map<string, string>): string | null {
  const hits = [...ids].filter((id) => id.startsWith(`${parId}.`) && (kaText.get(id) || "").trimStart().startsWith(`${letter})`));
  if (hits.length === 1) return hits[0];
  const ru = letter.split(".").map((part) => KA_TO_RU[part] ?? "?").join(".");
  const id = `${parId}.${ru}`;
  return ids.has(id) && hits.length === 0 ? id : null;
}

function confirms(norm: string, confirmed: Set<string>): boolean {
  for (const item of confirmed) {
    if (norm === item || item.startsWith(`${norm}.`) || norm.startsWith(`${item}.`)) return true;
  }
  return false;
}

function annexOf(text: string, at: number, after: string): string | null {
  if (after.includes("მონიშვნ")) return "2";
  if (after.includes("ნიშ")) return "1";
  const prev = all(ANNEX, text.slice(0, at));
  if (!prev.length) return null;
  return (prev.at(-1)?.[1] ?? "").startsWith("პირველ") ? "1" : "2";
}

function lawRef(start: number, end: number, art: string | null, par: string | null, thisArticle: boolean, status: string, letter?: string): KaRef {
  return {
    start, end, text: "", kind: "law", art, par, annex: null, item: null, thisArticle, status, norm: null,
    extra: letter === undefined ? {} : { ka_sub: letter },
  };
}

function annexRef(start: number, end: number, item: string, annex: string | null, explicit: boolean): KaRef {
  return {
    start, end, text: item, kind: "annex", art: null, par: null, annex, item, thisArticle: false,
    status: "pending", norm: null, extra: { explicit },
  };
}

function numbers(text: string, offset: number): [number, number, number | null][] {
  return all(NUMBER, text).map((match) => [offset + (match.index ?? 0), offset + (match.index ?? 0) + match[0].length, kaNumber(match[0])]);
}

function letterSpans(text: string, offset: number): [number, number, string][] {
  return all(LETTER, text).map((match) => {
    const span = match.indices?.[1] ?? [match.index ?? 0, (match.index ?? 0) + match[0].length];
    return [offset + span[0], offset + span[1], match[1]];
  });
}

function kaNumber(token: string): number | null {
  const text = token.trim();
  if (text.startsWith("პირველ")) return 1;
  if (text === "მეორე") return 2;
  const found = text.match(/\d+/);
  return found ? Number(found[0]) : null;
}

function pyNum(value: number | null): string | null {
  return value === null ? null : String(value);
}

function all(pattern: RegExp, text: string): Match[] {
  pattern.lastIndex = 0;
  return [...text.matchAll(pattern)] as Match[];
}

function group(match: Match, name: string): string | undefined {
  const span = match.indices?.groups?.[name];
  return span ? match.input!.slice(span[0], span[1]) : undefined;
}

function startOf(match: Match, name: string): number | undefined {
  return match.indices?.groups?.[name]?.[0];
}
