/**
 * Course ontology: which norm a ticket checks, and the earliest lesson that may ask it.
 *
 * Invariants:
 * - a spec covers a norm id only when the id equals the spec or continues it after a dot
 * - a ticket is assigned only to a lesson that teaches its primary norm and already has every concept
 * - the report object matches content/ontology/generated/report.json for the current sources
 */
const KA = "აბგდევზთიკლმნოპჟრსტუფ";
const RU = "абвгдежзиклмнопрстуф";
const KA_TO_RU = Object.fromEntries([...KA].map((letter, i) => [letter, [...RU][i]]).filter(([, ru]) => ru));

const CITATION = /(\S+)\s+მუხლის\s+(\S+)\s+პუნქტის\s+[„“"]([^„“”"]+)[“”"]\s+ქვეპუნქტ/g;
const NOTE = /შენიშვნის\s+((?:[„“"][^„“”"]{1,5}[“”"](?:\s*,\s*|\s+და\s+)?)+)\s*(?:ქვე)?პუნქტ/g;
const LETTERS = /[„“"]([^„“”"]{1,5})[“”"]/g;
const CHAPTER = /(\S+)\s+თავის/g;
const ANNEX = /(\S+)\s+დანართის/g;

function matches(text, regex) {
  regex.lastIndex = 0;
  return [...text.matchAll(regex)];
}

function numberToken(token) {
  if (token.startsWith("პირველ")) return 1;
  const found = token.match(/\d+/);
  return found ? Number(found[0]) : null;
}

function ruLetters(ka) {
  const parts = ka.split(".");
  if (parts.every((part) => KA_TO_RU[part])) return parts.map((part) => KA_TO_RU[part]).join(".");
  return null;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function coversId(spec, normId) {
  return normId === spec || normId.startsWith(`${spec}.`);
}

export function resolveSpec(spec, ids) {
  if (ids.has(spec)) return [spec];
  return [...ids].filter((id) => id.startsWith(`${spec}.`)).sort();
}

export function subpointFor(explanation, article, paragraph) {
  for (const match of matches(explanation || "", CITATION)) {
    if (numberToken(match[1]) === Number(article) && numberToken(match[2]) === paragraph) {
      const letters = match[3].split(".");
      if (letters.every((letter) => letter.length === 1 && KA_TO_RU[letter])) {
        return letters.map((letter) => KA_TO_RU[letter]).join(".");
      }
      return null;
    }
  }
  return null;
}

export function primaryRef(ticket) {
  const laws = ticket.law_refs || [];
  if (laws.length) {
    const article = String(laws[0].article);
    const paragraph = laws[0].paragraph;
    if (paragraph == null) return { kind: "law", major: article, minor: null, sub: null };
    const minor = Number(paragraph);
    return { kind: "law", major: article, minor, sub: subpointFor(ticket.explanation_ka, article, minor) };
  }
  for (const annex of ticket.annex_refs || []) {
    if (annex.items?.length) return { kind: "annex", major: String(annex.annex), minor: annex.items[0], sub: null };
  }
  return null;
}

function lawId(article, paragraph, sub, normIds) {
  const base = paragraph == null ? String(article) : `${article}.${paragraph}`;
  if (sub && normIds.has(`${base}.${sub}`)) return `${base}.${sub}`;
  return normIds.has(base) ? base : null;
}

export function noteCitations(question, normIds, normText) {
  const text = question.explanation_ka || "";
  const items = (question.annex_refs || []).flatMap((annex) => (annex.items || []).map(String));
  const out = [];
  for (const match of matches(text, NOTE)) {
    const before = text.slice(0, match.index);
    let annex = 1;
    for (const found of matches(before, ANNEX)) {
      const n = numberToken(found[1]);
      if (n) annex = n;
    }
    let chapter = null;
    for (const found of matches(before, CHAPTER)) {
      const n = numberToken(found[1]);
      if (n) chapter = n;
    }
    if (chapter == null && items.length) chapter = Number(items[0].split(".")[0]);
    if (chapter == null) continue;
    for (const found of matches(match[1], LETTERS)) {
      const ru = ruLetters(found[1]);
      if (!ru) continue;
      const pattern = new RegExp(`^A${annex}:${chapter}\\.прим\\d*\\.${escapeRegExp(ru)}$`);
      const candidates = [...normIds].filter((id) => pattern.test(id)).sort();
      if (!candidates.length) continue;
      const mentions = candidates.filter((id) => items.some((item) => {
        const look = new RegExp(`(?<![\\d.])${escapeRegExp(item)}(?!\\d)`);
        return look.test(normText.get(id) || "");
      }));
      const id = (mentions.length ? mentions : candidates)[0];
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

export function citedNorms(question, normIds, normText, extra = []) {
  const norms = [];
  const unresolved = [];
  const add = (id) => {
    if (!norms.includes(id)) norms.push(id);
  };
  for (const ref of question.law_refs || []) {
    const paragraph = ref.paragraph == null ? null : Number(ref.paragraph);
    const sub = paragraph == null ? null : subpointFor(question.explanation_ka, String(ref.article), paragraph);
    const id = lawId(ref.article, paragraph, sub, normIds);
    if (id) add(id);
    else unresolved.push(`${ref.article}.${paragraph == null ? "None" : paragraph}`);
  }
  for (const annex of question.annex_refs || []) {
    for (const item of annex.items || []) {
      const id = `A${annex.annex}:${item}`;
      if (normIds.has(id)) add(id);
      else unresolved.push(id);
    }
  }
  for (const id of noteCitations(question, normIds, normText)) add(id);
  for (const spec of extra) {
    const resolved = resolveSpec(spec, normIds);
    for (const id of (resolved.length ? resolved : [spec])) {
      if (normIds.has(id)) add(id);
      else unresolved.push(spec);
    }
  }
  const ref = primaryRef(question);
  let primary = null;
  if (ref?.kind === "law") primary = lawId(ref.major, ref.minor, ref.sub, normIds);
  else if (ref) {
    const id = `A${ref.major}:${ref.minor}`;
    primary = normIds.has(id) ? id : null;
  }
  return { primary, norms, unresolved };
}

function pyList(keys) {
  return `[${[...keys].sort().map((key) => `'${key}'`).join(", ")}]`;
}

function sortedObject(entries) {
  return Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export class World {
  constructor(doc, norms, questions, episodes) {
    this.doc = doc;
    this.normList = norms;
    this.questionList = questions;
    this.norms = new Map(norms.map((norm) => [norm.id, norm]));
    this.normIds = new Set(this.norms.keys());
    this.normText = new Map([...this.norms].map(([id, norm]) => [id, norm.ru || ""]));
    this.questions = new Map(questions.map((question) => [question.id, question]));
    this.episodes = [...episodes].sort((a, b) => a.num - b.num);
    this.concepts = Object.fromEntries(doc.concepts.map((concept) => [concept.id, concept]));
    this.misconceptions = Object.fromEntries(doc.misconceptions.map((item) => [item.id, item]));
    this.lessons = Object.fromEntries(doc.lessons.map((lesson) => [lesson.id, lesson]));
    this.lessonOrder = this.episodes.map((episode) => episode.id);
  }

  episode(lesson) {
    return this.episodes.find((episode) => episode.id === lesson);
  }

  teaches(lesson) {
    return [...(this.episode(lesson).teaches || [])];
  }

  quoted(lesson) {
    const episode = this.episode(lesson);
    const specs = (episode.quote_refs || []).map(([article, paragraph]) => (
      paragraph == null ? String(article) : `${article}.${paragraph}`
    ));
    for (const [annex, item] of episode.annex_quotes || []) specs.push(`A${annex}:${item}`);
    return [...this.teaches(lesson), ...specs, ...((this.lessons[lesson] || {}).states || [])];
  }

  lessonCovers(lesson, normId) {
    return normId != null && this.teaches(lesson).some((spec) => coversId(spec, normId));
  }

  upto(lesson) {
    return this.lessonOrder.slice(0, this.lessonOrder.indexOf(lesson) + 1);
  }

  introducedIn() {
    const out = {};
    for (const lesson of this.lessonOrder) {
      for (const concept of (this.lessons[lesson] || {}).introduces || []) {
        if (!(concept in out)) out[concept] = lesson;
      }
    }
    return out;
  }

  availableConcepts(lesson) {
    const out = new Set();
    for (const id of this.upto(lesson)) {
      const row = this.lessons[id] || {};
      for (const concept of row.introduces || []) out.add(concept);
      for (const concept of row.assumes || []) out.add(concept);
    }
    return out;
  }

  assumed() {
    const introduced = new Set(Object.keys(this.introducedIn()));
    const names = new Set();
    for (const lesson of this.doc.lessons) for (const concept of lesson.assumes || []) names.add(concept);
    return [...names].filter((concept) => !introduced.has(concept)).sort();
  }

  untaught() {
    const introduced = new Set(Object.keys(this.introducedIn()));
    const assumed = new Set(this.assumed());
    return Object.keys(this.concepts).filter((id) => !introduced.has(id) && !assumed.has(id)).sort();
  }

  annotation(id) {
    return this.doc.tickets[String(id)] || {};
  }

  questionNorms(id) {
    const question = this.questions.get(id);
    const cited = citedNorms(question, this.normIds, this.normText, this.annotation(id).norms || []);
    const context = this.annotation(id).context_norms || [];
    if (!context.length) return cited;
    const drop = cited.norms.filter((norm) => context.some((spec) => coversId(spec, norm)));
    return {
      ...cited,
      norms: cited.norms.filter((norm) => !drop.includes(norm)),
      context: [...drop].sort(),
    };
  }

  ticketNorms(id) {
    return this.questionNorms(id);
  }

  noteCitations(id) {
    return noteCitations(this.questions.get(id), this.normIds, this.normText);
  }

  conceptsForNorms(normIds) {
    return Object.entries(this.concepts)
      .filter(([, concept]) => (concept.norms || []).some((spec) => normIds.some((norm) => coversId(spec, norm))))
      .map(([id]) => id)
      .sort();
  }

  ticketConcepts(id) {
    const norms = this.questionNorms(id).norms;
    return [...new Set([...this.conceptsForNorms(norms), ...(this.annotation(id).concepts || [])])].sort();
  }

  deriveAssignment() {
    const assigned = {};
    const blocked = {};
    for (const id of [...this.questions.keys()].sort((a, b) => a - b)) {
      const primary = this.questionNorms(id).primary;
      const covering = this.lessonOrder.filter((lesson) => this.lessonCovers(lesson, primary));
      if (!covering.length) continue;
      const need = new Set(this.ticketConcepts(id));
      const lesson = covering.find((candidate) => [...need].every((concept) => this.availableConcepts(candidate).has(concept)));
      if (!lesson) {
        const known = this.availableConcepts(covering[0]);
        blocked[id] = { lesson: covering[0], missing: [...need].filter((concept) => !known.has(concept)).sort() };
      } else {
        assigned[id] = lesson;
      }
    }
    return { assigned, blocked };
  }

  strictAssignment() {
    const out = {};
    for (const id of [...this.questions.keys()].sort((a, b) => a - b)) {
      const norms = this.questionNorms(id).norms;
      if (!norms.length) continue;
      for (const lesson of this.lessonOrder) {
        const taught = this.upto(lesson);
        if (norms.every((norm) => taught.some((earlier) => this.lessonCovers(earlier, norm)))) {
          out[id] = lesson;
          break;
        }
      }
    }
    return out;
  }

  specOk(spec) {
    return resolveSpec(spec, this.normIds).length > 0;
  }

  integrityErrors() {
    const errors = [];
    const conceptIds = new Set(Object.keys(this.concepts));
    for (const concept of this.doc.concepts) {
      for (const spec of [...(concept.norms || []), ...(concept.part_of || [])]) {
        if (!this.specOk(spec)) errors.push(`concept ${concept.id}: unknown norm ${spec}`);
      }
    }
    for (const item of this.doc.misconceptions) {
      for (const spec of item.norms || []) {
        if (!this.specOk(spec)) errors.push(`misconception ${item.id}: unknown norm ${spec}`);
      }
      for (const concept of item.concepts || []) {
        if (!conceptIds.has(concept)) errors.push(`misconception ${item.id}: unknown concept ${concept}`);
      }
    }
    const seen = {};
    for (const lesson of this.doc.lessons) {
      const id = lesson.id;
      if (!this.lessonOrder.includes(id)) {
        errors.push(`lesson ${id}: not in episodes.json`);
        continue;
      }
      for (const key of ["introduces", "relies_on", "assumes"]) {
        for (const concept of lesson[key] || []) {
          if (!conceptIds.has(concept)) errors.push(`lesson ${id}: ${key} unknown concept ${concept}`);
        }
      }
      for (const spec of lesson.states || []) {
        if (!this.specOk(spec)) errors.push(`lesson ${id}: unknown stated norm ${spec}`);
      }
      for (const concept of lesson.introduces || []) {
        if (concept in seen) errors.push(`concept ${concept} introduced twice (${seen[concept]}, ${id})`);
        if (!(concept in seen)) seen[concept] = id;
        const quoted = this.quoted(id);
        for (const spec of (this.concepts[concept] || {}).norms || []) {
          const ids = resolveSpec(spec, this.normIds);
          const taught = quoted.some((quote) => ids.some((norm) => coversId(quote, norm)));
          if (!taught) errors.push(`lesson ${id}: introduces ${concept} but neither teaches nor quotes ${spec}`);
        }
      }
    }
    for (const id of this.lessonOrder) {
      const lesson = this.lessons[id] || {};
      const before = new Set();
      for (const prev of this.lessonOrder.slice(0, this.lessonOrder.indexOf(id))) {
        for (const concept of (this.lessons[prev] || {}).introduces || []) before.add(concept);
      }
      const assumed = new Set();
      for (const prev of this.upto(id)) {
        for (const concept of (this.lessons[prev] || {}).assumes || []) assumed.add(concept);
      }
      for (const concept of lesson.relies_on || []) {
        if (!before.has(concept) && !assumed.has(concept)) {
          errors.push(`lesson ${id}: relies on ${concept} before it is introduced`);
        }
      }
    }
    for (const [key, row] of Object.entries(this.doc.tickets)) {
      const id = Number(key);
      const question = this.questions.get(id);
      if (!question) {
        errors.push(`ticket ${key}: not in the bank`);
        continue;
      }
      for (const concept of row.concepts || []) {
        if (!conceptIds.has(concept)) errors.push(`ticket ${key}: unknown concept ${concept}`);
      }
      for (const spec of row.norms || []) {
        if (!this.specOk(spec)) errors.push(`ticket ${key}: unknown norm ${spec}`);
      }
      if (row.context_norms) {
        const bank = citedNorms(question, this.normIds, this.normText, row.norms || []);
        for (const spec of row.context_norms) {
          if (bank.primary != null && coversId(spec, bank.primary)) {
            errors.push(`ticket ${key}: context norm ${spec} is its primary norm`);
          } else if (!bank.norms.some((norm) => coversId(spec, norm))) {
            errors.push(`ticket ${key}: context norm ${spec} is not cited by the bank`);
          }
        }
      }
      const correct = question.correct - 1;
      const distractors = row.distractors;
      if (distractors != null) {
        const want = question.answers.map((_, index) => String(index)).filter((index) => Number(index) !== correct);
        const got = Object.keys(distractors);
        if (got.length !== want.length || want.some((index) => !(index in distractors))) {
          errors.push(`ticket ${key}: distractor keys ${pyList(got)} != ${pyList(want)}`);
        }
        for (const misconception of Object.values(distractors)) {
          if (misconception != null && !(misconception in this.misconceptions)) {
            errors.push(`ticket ${key}: unknown misconception ${misconception}`);
          }
        }
      }
    }
    const assigned = this.deriveAssignment().assigned;
    for (const [id, lesson] of Object.entries(assigned)) {
      if (!this.lessonCovers(lesson, this.questionNorms(Number(id)).primary)) {
        errors.push(`ticket ${id}: assigned to ${lesson} but its primary norm is not taught there`);
      }
    }
    return errors;
  }

  withTicketAnnotation(id, patch) {
    const doc = structuredClone(this.doc);
    const key = String(id);
    doc.tickets[key] = { ...(doc.tickets[key] || {}), ...patch };
    return new World(doc, this.normList, this.questionList, this.episodes);
  }

  report(items = []) {
    const derived = this.deriveAssignment();
    const strict = this.strictAssignment();
    const assigned = derived.assigned;
    const kinds = {};
    for (const norm of this.normList) {
      const kind = norm.id.includes(".прим") ? "annex note" : norm.kind;
      kinds[kind] = (kinds[kind] || 0) + 1;
    }
    const ids = new Set([...Object.keys(assigned), ...Object.keys(strict)].map(Number));
    const diff = [...ids].sort((a, b) => a - b)
      .filter((id) => (assigned[id] ?? null) !== (strict[id] ?? null))
      .map((id) => ({ ticket: id, derived: assigned[id] ?? null, strict: strict[id] ?? null }));
    const annotated = this.doc.tickets;
    const distractors = Object.values(annotated).flatMap((row) => Object.values(row.distractors || {}));
    const count = (map) => Object.fromEntries(this.lessonOrder.map((lesson) => [
      lesson, Object.values(map).filter((value) => value === lesson).length,
    ]));
    const use = {};
    const bump = (id) => {
      if (id) use[id] = (use[id] || 0) + 1;
    };
    for (const row of Object.values(annotated)) for (const id of Object.values(row.distractors || {})) bump(id);
    for (const item of items) for (const id of Object.values(item.distractors)) bump(id);
    const blockedTickets = {};
    for (const id of Object.keys(derived.blocked).map(Number).sort((a, b) => a - b)) {
      const note = this.annotation(id).note;
      blockedTickets[String(id)] = note ? { ...derived.blocked[id], note } : { ...derived.blocked[id] };
    }
    const byType = {};
    for (const item of items) byType[item.type] = (byType[item.type] || 0) + 1;
    return {
      _generated: "node tools/ontology-report.mjs; do not edit",
      stats: {
        norms: this.norms.size,
        norms_by_kind: sortedObject(Object.entries(kinds)),
        concepts: Object.keys(this.concepts).length,
        introduced: Object.fromEntries(this.lessonOrder.map((lesson) => [lesson, ((this.lessons[lesson] || {}).introduces || []).length])),
        assumed: this.assumed().length,
        untaught: this.untaught().length,
        misconceptions: Object.keys(this.misconceptions).length,
        annotated_tickets: Object.keys(annotated).length,
        distractors: distractors.length,
        distractors_mapped: distractors.filter((id) => id).length,
      },
      assignment: {
        derived: count(assigned),
        strict: count(strict),
        blocked: Object.keys(derived.blocked).length,
        blocked_tickets: blockedTickets,
        diff_derived_vs_strict: diff,
      },
      gaps: {
        assumed_concepts: this.assumed().map((id) => ({ id, label: this.concepts[id].label })),
        untaught_concepts: this.untaught().map((id) => ({
          id,
          label: this.concepts[id].label,
          blocks: Object.entries(derived.blocked)
            .filter(([, row]) => row.missing.includes(id))
            .map(([ticket]) => Number(ticket))
            .sort((a, b) => a - b),
        })),
        concept_notes: this.doc.concepts.filter((concept) => concept.gap).map((concept) => ({ id: concept.id, gap: concept.gap })),
        unmapped_distractors: Object.entries(annotated)
          .flatMap(([ticket, row]) => Object.entries(row.distractors || {})
            .filter(([, id]) => id == null)
            .map(([index]) => `${ticket}:${index}`))
          .sort(),
        unused_misconceptions: Object.keys(this.misconceptions).filter((id) => !use[id]).sort(),
        unresolved_ticket_refs: Object.fromEntries(
          [...this.questions.keys()].sort((a, b) => a - b)
            .map((id) => [String(id), this.questionNorms(id).unresolved])
            .filter(([, unresolved]) => unresolved.length),
        ),
      },
      own_items: {
        total: items.length,
        by_lesson: Object.fromEntries(this.lessonOrder
          .filter((lesson) => items.some((item) => item.lesson === lesson))
          .map((lesson) => [lesson, items.filter((item) => item.lesson === lesson).length])),
        by_type: sortedObject(Object.entries(byType)),
      },
      misconception_use: sortedObject(Object.entries(use)),
    };
  }
}
