/**
 * Next step of the study flow. Deterministic; the lesson is not the unit.
 * Invariants:
 * - no released lessons → null
 * - a step whose key is in `avoid` or equal to `just` is not returned while another step exists
 * - mix with no answers opens on the first lesson's text
 * - mix opens on the text of the next lesson when its questions are still untouched and earlier ones are answered
 * - situations prefers a question, explain prefers text, review prefers a wrong answer
 * - after a wrong answer on a mapped pilot item, mix offers one unanswered clarifying question for that wrong option before the lesson text, and the text names that option's fragment; any other miss offers the text first
 * - pause is set only when this session steps into a later lesson whose earlier questions are all answered
 * - done is set only on a text step, and only when every question in scope was last answered correctly
 * - repeat, once that stop is passed, serves answered questions again and does not open new ones
 * - a repetition pass walks every currently correct question before it starts over
 * - review never opens a question that has not been answered
 */
import { orderReview, reviewDue } from "./review.ts";
import { releasedLessons, studyLesson } from "./scope.ts";
import { followUp, lessonFocus } from "./skills.ts";

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
  again?: boolean;
  fresh?: boolean;
  reason?: "misconception-check" | "spaced-review";
  focus?: string;
};
type FlowLesson = {
  id: string;
  num: number;
  title: string;
  lead?: string;
  tickets_lesson?: (string | number)[];
  own_items?: (string | number)[];
};
type Attempt = { l?: number; t?: number; lc?: number; events?: { ok: 0 | 1; c?: number | null }[] };
type FlowOpts = { mode?: string; own?: boolean; last?: FlowKind; anchor?: string; avoid?: string[]; just?: string; served?: string[]; repeat?: boolean; now?: number; tutor?: boolean; fromProbe?: boolean };
type PickCtx = { justId?: string; now?: number; tutor: boolean; skipped: Set<string>; fromProbe: boolean };

export type FlowRun = { last?: FlowKind; anchor?: string; avoid: string[]; served: string[]; part: number; partLesson?: string; repeat: boolean };

/** The flow's place in the browser. Unknown fields are dropped; `just` is only for the open page. */
export function cleanFlowRun(value: unknown): FlowRun {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const texts = (value: unknown, cap: number) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, cap) : [];
  const avoid = texts(raw.avoid, 80);
  const served = texts(raw.served, 400);
  const part = typeof raw.part === "number" && Number.isInteger(raw.part) && raw.part > 0 ? raw.part : 0;
  const run: FlowRun = { avoid, served, part, repeat: raw.repeat === true };
  if (raw.last === "theory" || raw.last === "question" || raw.last === "review") run.last = raw.last;
  if (typeof raw.anchor === "string" && raw.anchor) run.anchor = raw.anchor;
  if (typeof raw.partLesson === "string" && raw.partLesson) run.partLesson = raw.partLesson;
  return run;
}

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
    ["На все вопросы сейчас отвечено правильно", named("solid")],
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
  const served = new Set((opts.served || []).map(String));
  const ctx: PickCtx = {
    justId: opts.just && !opts.just.startsWith("theory:") ? opts.just : undefined,
    now: typeof opts.now === "number" ? opts.now : undefined,
    tutor: opts.tutor !== false,
    skipped: avoid,
    fromProbe: opts.fromProbe === true,
  };
  return pick(list, progress, own, mode, opts.last, opts.anchor, blocked, served, opts.repeat === true, ctx)
    ?? pick(list, progress, own, mode, opts.last, opts.anchor, just, served, opts.repeat === true, ctx)
    ?? pick(list, progress, own, mode, opts.last, opts.anchor, new Set(), served, opts.repeat === true, ctx);
}

function pick(list: FlowLesson[], progress: Record<string, Attempt>, own: boolean, mode: FlowMode, last: FlowKind | undefined, anchor: string | undefined, blocked: Set<string>, served: Set<string>, repeat: boolean, ctx: PickCtx): FlowStep | null {
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
  const asTheory = (lesson?: FlowLesson): FlowStep | null => {
    if (!lesson || blocked.has(`theory:${lesson.id}`)) return null;
    return { kind: "theory" as const, lessonId: lesson.id, title: lesson.title, lead: lesson.lead ?? "", pause: entering(lesson), done: doneAll };
  };
  const asQuestion = (lesson: FlowLesson, id: string | number, kind: "question" | "review"): FlowStep | null => {
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
  const againQ = () => {
    const ids: (string | number)[] = [];
    for (const lesson of list) for (const id of work(lesson, own)) if (progress[id]?.l === 1) ids.push(id);
    const waiting = ids.filter(id => !served.has(String(id)) && !blocked.has(String(id)));
    const pool = waiting.length ? waiting : ids.filter(id => !blocked.has(String(id)));
    const id = orderReview(pool, progress, ctx.now)[0];
    if (id == null) return null;
    const lesson = list.find(item => work(item, own).some(itemId => String(itemId) === String(id)));
    const step = lesson ? asQuestion(lesson, id, "question") : null;
    if (!step) return null;
    step.again = true;
    if (!waiting.length) step.fresh = true;
    if (reviewDue(id, progress, ctx.now)) step.reason = "spaced-review";
    return step;
  };
  const studiedText = () => {
    const studied = list.filter(lesson => work(lesson, own).some(id => progress[id]));
    for (const lesson of (studied.length ? studied : [list[0]])) {
      const step = asTheory(lesson);
      if (step) return step;
    }
    return null;
  };
  if (repeat && doneAll) return againQ() || asTheory(list[list.length - 1]);
  const next = anchorLesson ? list[list.findIndex(lesson => lesson.id === anchorLesson.id) + 1] : undefined;
  const tail = () => asTheory(next) || asTheory(list[list.length - 1]);
  const anyAnswer = list.some(lesson => work(lesson, own).some(id => progress[id]));
  if (mode === "situations") return openQ() || badQ() || asTheory(list.find(lesson => lesson.id === studyLesson(list, progress, { own })?.id));
  if (mode === "review") return badQ() || againQ() || studiedText();
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
    const follow = ctx.tutor ? followUp(ctx.justId, progress, new Set([...blocked, ...ctx.skipped]), own, ctx.fromProbe) : null;
    const lesson = follow ? list.find(item => item.id === follow.lessonId) : undefined;
    const probe = follow && lesson ? asQuestion(lesson, follow.probe, "question") : null;
    if (probe && follow) probe.reason = follow.reason;
    const theory = asTheory(anchorLesson);
    const focus = lessonFocus(ctx.justId, progress);
    if (theory && focus) theory.focus = focus;
    return probe || theory || inLesson(anchorLesson, "question") || badQ() || tail();
  }
  if ((last === "question" || last === "review") && anchorLesson) return inLesson(anchorLesson, "question") || badQ() || tail();
  return badQ() || openQ() || asTheory(list[0]);
}
