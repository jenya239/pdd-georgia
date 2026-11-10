/**
 * Next step of the study flow. Deterministic; the lesson is not the unit.
 * Invariants:
 * - no released lessons → null
 * - a step whose key is in `avoid` or equal to `just` is not returned while another step exists
 * - mix with no answers opens on the first lesson's text
 * - mix opens on the text of the next lesson when its questions are still untouched and earlier ones are answered
 * - situations prefers a question, explain prefers text, review prefers a wrong answer
 * - after a wrong answer, mix offers that lesson's text before another of its questions
 * - pause is set only when this session steps into a later lesson whose earlier questions are all answered
 * - done is set only on a text step, and only when every question in scope was last answered correctly
 */
import { releasedLessons, studyLesson } from "./scope.ts";

export type FlowKind = "theory" | "question" | "review";
export type FlowMode = "mix" | "situations" | "explain" | "review";
export type FlowStep = {
  kind: FlowKind;
  lessonId: string;
  title: string;
  lead: string;
  ticketId?: string | number;
  pause: boolean;
  done: boolean;
};
type FlowLesson = {
  id: string;
  num: number;
  title: string;
  lead?: string;
  tickets_lesson?: (string | number)[];
  own_items?: (string | number)[];
};
type Attempt = { l?: number };
type FlowOpts = { mode?: string; own?: boolean; last?: FlowKind; anchor?: string; avoid?: string[]; just?: string };

const MODES = new Set<FlowMode>(["mix", "situations", "explain", "review"]);
const STATUS = { text: "Текст", new: "Не начат", open: "В работе", wrong: "Есть ошибки", solid: "Вопросы отвечены" } as const;

const work = (lesson: FlowLesson, own: boolean) => [...(lesson.tickets_lesson || []), ...(own ? lesson.own_items || [] : [])];

function lessonState(lesson: FlowLesson, progress: Record<string, Attempt>, own: boolean) {
  const ids = work(lesson, own);
  if (!ids.length) return "text" as const;
  if (!ids.some(id => progress[id])) return "new" as const;
  if (ids.some(id => progress[id]?.l === 0)) return "wrong" as const;
  if (ids.some(id => !progress[id])) return "open" as const;
  return "solid" as const;
}

export function lessonStatus(lesson: FlowLesson, progress: Record<string, Attempt> = {}, { own = false } = {}) {
  return STATUS[lessonState(lesson, progress, own)];
}

function nameList(lessons: FlowLesson[]) {
  const rest = lessons.length - 1;
  if (rest <= 0) return lessons[0]?.title ?? "";
  return `${lessons[0].title} ${rest === 1 ? "и ещё одна" : `и ещё ${rest}`}`;
}

export function knowledgeLine(released: FlowLesson[], progress: Record<string, Attempt> = {}, { own = false } = {}) {
  const list = releasedLessons(released);
  if (!list.length) return "";
  if (!list.some(lesson => work(lesson, own).some(id => progress[id]))) return "Ответов пока нет. Курс начинается с первого выпуска.";
  const named = (state: ReturnType<typeof lessonState>) => list.filter(lesson => lessonState(lesson, progress, own) === state);
  const parts = [
    ["Без ошибок", named("solid")],
    ["В работе", named("open")],
    ["Требуют внимания", named("wrong")],
    ["Ещё не начаты", named("new")],
  ].filter(([, lessons]) => (lessons as FlowLesson[]).length).map(([label, lessons]) => `${label}: ${nameList(lessons as FlowLesson[])}.`);
  return parts.join(" ");
}

export function flowKey(step: FlowStep) {
  return step.kind === "theory" ? `theory:${step.lessonId}` : String(step.ticketId);
}

export function nextFlowItem(released: FlowLesson[], progress: Record<string, Attempt> = {}, opts: FlowOpts = {}): FlowStep | null {
  const list = releasedLessons(released);
  if (!list.length) return null;
  const mode: FlowMode = MODES.has(opts.mode as FlowMode) ? opts.mode as FlowMode : "mix";
  const own = opts.own === true;
  const avoid = new Set(opts.avoid || []);
  const just = opts.just ? new Set([opts.just]) : new Set<string>();
  const blocked = new Set([...avoid, ...just]);
  return pick(list, progress, own, mode, opts.last, opts.anchor, blocked)
    ?? pick(list, progress, own, mode, opts.last, opts.anchor, just)
    ?? pick(list, progress, own, mode, opts.last, opts.anchor, new Set());
}

function pick(list: FlowLesson[], progress: Record<string, Attempt>, own: boolean, mode: FlowMode, last: FlowKind | undefined, anchor: string | undefined, blocked: Set<string>): FlowStep | null {
  const unanswered = (lesson: FlowLesson) => work(lesson, own).filter(id => !progress[id]);
  const wrong = (lesson: FlowLesson) => work(lesson, own).filter(id => progress[id]?.l === 0);
  const hasWork = list.some(lesson => work(lesson, own).length);
  const doneAll = hasWork && list.every(lesson => work(lesson, own).every(id => progress[id]?.l === 1));
  const anchorLesson = anchor ? list.find(lesson => lesson.id === anchor) : undefined;
  const from = anchorLesson ? list.findIndex(lesson => lesson.id === anchorLesson.id) : -1;
  const entering = (lesson: FlowLesson) => {
    const to = list.findIndex(item => item.id === lesson.id);
    const earlier = to > 0 && list.slice(0, to).every(item => work(item, own).every(id => progress[id]));
    return !!last && from >= 0 && to > from && earlier;
  };
  const asTheory = (lesson?: FlowLesson) => {
    if (!lesson || blocked.has(`theory:${lesson.id}`)) return null;
    return { kind: "theory" as const, lessonId: lesson.id, title: lesson.title, lead: lesson.lead ?? "", pause: entering(lesson), done: doneAll };
  };
  const asQuestion = (lesson: FlowLesson, id: string | number, kind: "question" | "review") => {
    if (blocked.has(String(id))) return null;
    return { kind, lessonId: lesson.id, title: lesson.title, lead: lesson.lead ?? "", ticketId: id, pause: entering(lesson), done: false };
  };
  const firstOf = (kind: "question" | "review", ids: (lesson: FlowLesson) => (string | number)[]) => {
    for (const lesson of list) {
      for (const id of ids(lesson)) {
        const step = asQuestion(lesson, id, kind);
        if (step) return step;
      }
    }
    return null;
  };
  const inLesson = (lesson: FlowLesson, kind: "question" | "review") => {
    for (const id of (kind === "question" ? unanswered(lesson) : wrong(lesson))) {
      const step = asQuestion(lesson, id, kind);
      if (step) return step;
    }
    return null;
  };
  const openQ = () => firstOf("question", unanswered);
  const badQ = () => firstOf("review", wrong);
  const next = anchorLesson ? list[list.findIndex(lesson => lesson.id === anchorLesson.id) + 1] : undefined;
  const tail = () => asTheory(next) || asTheory(list[list.length - 1]);
  const anyAnswer = list.some(lesson => work(lesson, own).some(id => progress[id]));
  if (mode === "situations") return openQ() || badQ() || asTheory(list.find(lesson => lesson.id === studyLesson(list, progress, { own })?.id));
  if (mode === "review") {
    if (last === "review") return badQ() || asTheory(anchorLesson) || openQ() || tail();
    return badQ() || openQ() || tail();
  }
  if (mode === "explain") {
    if (last === "theory" && anchorLesson) return inLesson(anchorLesson, "question") || inLesson(anchorLesson, "review") || tail();
    const target = list.find(lesson => lesson.id === studyLesson(list, progress, { own })?.id);
    return asTheory(target) || openQ() || badQ() || tail();
  }
  if (!last) {
    if (!anyAnswer) return asTheory(list[0]) || openQ();
    const missed = badQ();
    if (missed) return missed;
    const unread = list.find(lesson => {
      const ids = work(lesson, own);
      if (!ids.length || ids.some(id => progress[id])) return false;
      const index = list.findIndex(item => item.id === lesson.id);
      return list.slice(0, index).every(item => work(item, own).every(id => progress[id]));
    });
    return (unread ? asTheory(unread) : null) || openQ() || asTheory(list[list.length - 1]);
  }
  if (last === "theory" && anchorLesson) return inLesson(anchorLesson, "question") || badQ() || tail();
  if (last === "question" && anchorLesson && wrong(anchorLesson).length) {
    return asTheory(anchorLesson) || inLesson(anchorLesson, "question") || badQ() || tail();
  }
  if ((last === "question" || last === "review") && anchorLesson) return inLesson(anchorLesson, "question") || badQ() || tail();
  return badQ() || openQ() || asTheory(list[0]);
}
