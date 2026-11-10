/** Own check items («наш вопрос», data/items.json) next to the bank tickets (pure). */
export const OWN_ID = /^o-ep\d\d-\d\d$/;

export const TYPE_LABEL: Record<string, string> = {
  ticket: "в формате билета", diagram: "схема", priority: "очерёдность проезда",
  "max-error": "найдите ошибку Макса", flashcard: "число из закона", cloze: "вставьте слово из закона",
};

export const isOwnId = (id: unknown): id is string => typeof id === "string" && OWN_ID.test(id);

/** Progress keys are strings: bank ids become numbers again, own ids stay as they are. */
export const parseId = (id: string) => (isOwnId(id) ? id : Number(id));

/** Bank tickets first (by number), then own items (by id). */
export const compareIds = (a: string | number, b: string | number) => (Number(isOwnId(a)) - Number(isOwnId(b))) || (isOwnId(a) && isOwnId(b) ? (a < b ? -1 : a > b ? 1 : 0) : Number(a) - Number(b));

/** The ticket shape the question renderer and the statistics understand. */
export function itemAsTicket(it: Record<string, any>) {
  return { id: it.id, own: true, type: it.type, typeLabel: it.type_label || TYPE_LABEL[it.type] || "",
    q: { ru: it.q }, a: { ru: [...it.options] }, c: it.answer, t: "own", lesson: it.lesson, rule: it.rule,
    fig: it.fig || null, img: null, quote: it.quote, explain: it.explain, distractors: it.distractors || {},
    nu: [], law: [], ex: null, src: null, nm: it.nm || null, cn: it.cn || [], _r: it._r || null };
}

/** Question text to show: Russian (+ the Georgian original for the «оригинал (KA)» toggle);
 *  tickets untranslated in the source base (nu ∋ "ru") are shown in our machine translation (t.mt) if there is one,
 *  else in Georgian; own items are Russian only. */
export function questionText(t: any) {
  if (t.own) return { q: t.q.ru, a: t.a.ru, lang: "ru", untranslated: false, ka: null };
  if ((t.nu || []).includes("ru") && t.mt) return { q: t.mt.q, a: t.mt.a, lang: "ru", untranslated: true, mt: true, ka: { q: t.q.ka, a: t.a.ka } };
  if ((t.nu || []).includes("ru")) return { q: t.q.ka || t.q.ru, a: t.a.ka || t.a.ru, lang: "ka", untranslated: true, ka: null };
  return { q: t.q.ru, a: t.a.ru, lang: "ru", untranslated: false, ka: t.q.ka && t.a.ka ? { q: t.q.ka, a: t.a.ka } : null };
}

/** The typical error behind a wrong choice, if the choice is annotated. */
export function misconceptionFor(t: any, choice: number | null, mcMap: Record<string, { belief: string; truth: string }> | null | undefined, ticketDistractors: Record<string, Record<string, string>> | null | undefined) {
  if (choice == null || choice === t.c) return null;
  const table = t.own ? t.distractors : (ticketDistractors || {})[String(t.id)];
  const id = table ? table[String(choice)] : null;
  const m = id && mcMap ? mcMap[id] : null;
  return m ? { id, belief: m.belief, truth: m.truth } : null;
}

/** The sentence shown above the panel after a wrong answer. Only an annotated misconception supplies it. */
export function answerLead(t: any, choice: number | null, mcMap: Record<string, { belief: string; truth: string }> | null | undefined, ticketDistractors: Record<string, Record<string, string>> | null | undefined) {
  if (choice == null) return null;
  return misconceptionFor(t, choice, mcMap, ticketDistractors)?.truth ?? null;
}

export const idLabel = (id: string | number) => (isOwnId(id) ? `наш вопрос ${id.slice(2)}` : `№ ${id}`);
