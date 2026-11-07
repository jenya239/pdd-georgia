export type LawRef = {
  article: string | number;
  paragraph: string | number | null;
};

export type QuestionRow = {
  id: number;
  law_refs: LawRef[];
  episodes?: string[];
};

export type EpisodeSource = {
  id?: string;
  ticket_ids?: number[];
  ticket_refs?: [unknown, unknown][];
  linked?: string;
  plan?: string[];
  format?: string;
  lesson?: string;
};

const FORMATS = new Set(["video", "text"]);

function py(value: unknown): string {
  if (value === null || value === undefined) return "None";
  return String(value);
}

function pyList(values: number[]): string {
  return `[${values.join(", ")}]`;
}

function nameOf(ep: { id?: string }): string {
  return ep.id ?? "None";
}

export function coreTicketIds(ep: EpisodeSource, questions: QuestionRow[]): number[] {
  const known = new Set(questions.map((question) => question.id));
  if (ep.ticket_ids) {
    const unknown = ep.ticket_ids.filter((id) => !known.has(id));
    if (unknown.length) throw new Error(`${nameOf(ep)}: unknown ticket ids ${pyList(unknown)}`);
    return [...ep.ticket_ids];
  }
  const keys = new Set((ep.ticket_refs ?? []).map(([article, paragraph]) => `${py(article)}\0${py(paragraph)}`));
  return questions
    .filter((question) => question.law_refs.some((ref) => keys.has(`${py(ref.article)}\0${py(ref.paragraph)}`)))
    .map((question) => question.id);
}

export function linkedTicketIds(
  ep: EpisodeSource,
  questions: QuestionRow[],
  core: number[],
  lessonIds: number[] = [],
): number[] {
  const seen = new Set(core);
  if (ep.linked === "lesson") return lessonIds.filter((id) => !seen.has(id));
  const plan = new Set(ep.plan ?? []);
  return questions
    .filter((question) => !seen.has(question.id) && (question.episodes ?? []).some((id) => plan.has(id)))
    .map((question) => question.id);
}

export function episodeKind(ep: EpisodeSource): string {
  const kind = ep.format ?? "video";
  if (!FORMATS.has(kind)) throw new Error(`${nameOf(ep)}: unknown format '${kind}'`);
  if (kind === "text" && !ep.lesson) throw new Error(`${nameOf(ep)}: text episode needs a 'lesson' file`);
  return kind;
}

export function lessonTicketIds(lessonId: string, assignment: { [id: string]: string }): number[] {
  return Object.entries(assignment)
    .filter(([, lesson]) => lesson === lessonId)
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
}
