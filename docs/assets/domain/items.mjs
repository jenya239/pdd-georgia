/** Own check items («наш вопрос», data/items.json) next to the bank tickets (pure). */
export const OWN_ID = /^o-ep\d\d-\d\d$/;

export const TYPE_LABEL = {
  ticket: "в формате билета", diagram: "схема", priority: "очерёдность проезда",
  "max-error": "найдите ошибку Макса", flashcard: "число из закона", cloze: "вставьте слово из закона",
};

export const isOwnId = id => typeof id === "string" && OWN_ID.test(id);

/** Progress keys are strings: bank ids become numbers again, own ids stay as they are. */
export const parseId = id => (isOwnId(id) ? id : Number(id));

/** Bank tickets first (by number), then own items (by id). */
export const compareIds = (a, b) => (isOwnId(a) - isOwnId(b)) || (isOwnId(a) ? (a < b ? -1 : a > b ? 1 : 0) : a - b);

/** The ticket shape the question renderer and the statistics understand. */
export function itemAsTicket(it) {
  return { id: it.id, own: true, type: it.type, typeLabel: it.type_label || TYPE_LABEL[it.type] || "",
    q: { ru: it.q }, a: { ru: [...it.options] }, c: it.answer, t: "own", lesson: it.lesson, rule: it.rule,
    fig: it.fig || null, img: null, quote: it.quote, explain: it.explain, distractors: it.distractors || {},
    nu: [], law: [], ex: null, src: null };
}

/** The typical error behind a wrong choice, if the choice is annotated. */
export function misconceptionFor(t, choice, mcMap, ticketDistractors) {
  if (choice == null || choice === t.c) return null;
  const table = t.own ? t.distractors : (ticketDistractors || {})[String(t.id)];
  const id = table ? table[String(choice)] : null;
  const m = id && mcMap ? mcMap[id] : null;
  return m ? { id, belief: m.belief, truth: m.truth } : null;
}

export const idLabel = id => (isOwnId(id) ? `наш вопрос ${id.slice(2)}` : `№ ${id}`);
