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
 * - repeat, once that stop is passed, serves answered questions again and does not open new ones
 * - review never opens a question that has not been answered
 */
import { releasedLessons, studyLesson } from "./scope.mjs";
/** The flow's place in the browser. Unknown fields are dropped; `just` is only for the open page. */
export function cleanFlowRun(value) {
    const raw = value && typeof value === "object" ? value : {};
    const avoid = Array.isArray(raw.avoid) ? raw.avoid.filter((item) => typeof item === "string" && item.length > 0).slice(0, 80) : [];
    const part = typeof raw.part === "number" && Number.isInteger(raw.part) && raw.part > 0 ? raw.part : 0;
    const run = { avoid, part, repeat: raw.repeat === true };
    if (raw.last === "theory" || raw.last === "question" || raw.last === "review")
        run.last = raw.last;
    if (typeof raw.anchor === "string" && raw.anchor)
        run.anchor = raw.anchor;
    if (typeof raw.partLesson === "string" && raw.partLesson)
        run.partLesson = raw.partLesson;
    return run;
}
const MODES = new Set(["mix", "situations", "explain", "review"]);
const STATUS = { text: "Текст", new: "Не начат", open: "В работе", wrong: "Есть ошибки", solid: "Вопросы отвечены" };
const work = (lesson, own) => [...(lesson.tickets_lesson || []), ...(own ? lesson.own_items || [] : [])];
function lessonState(lesson, progress, own) {
    const ids = work(lesson, own);
    if (!ids.length)
        return "text";
    if (!ids.some(id => progress[id]))
        return "new";
    if (ids.some(id => progress[id]?.l === 0))
        return "wrong";
    if (ids.some(id => !progress[id]))
        return "open";
    return "solid";
}
export function lessonStatus(lesson, progress = {}, { own = false } = {}) {
    return STATUS[lessonState(lesson, progress, own)];
}
function nameList(lessons) {
    const rest = lessons.length - 1;
    if (rest <= 0)
        return lessons[0]?.title ?? "";
    return `${lessons[0].title} ${rest === 1 ? "и ещё одна" : `и ещё ${rest}`}`;
}
export function knowledgeLine(released, progress = {}, { own = false } = {}) {
    const list = releasedLessons(released);
    if (!list.length)
        return "";
    if (!list.some(lesson => work(lesson, own).some(id => progress[id])))
        return "Ответов пока нет. Курс начинается с первого выпуска.";
    const named = (state) => list.filter(lesson => lessonState(lesson, progress, own) === state);
    const parts = [
        ["На все вопросы сейчас отвечено правильно", named("solid")],
        ["В работе", named("open")],
        ["Требуют внимания", named("wrong")],
        ["Ещё не начаты", named("new")],
    ].filter(([, lessons]) => lessons.length).map(([label, lessons]) => `${label}: ${nameList(lessons)}.`);
    return parts.join(" ");
}
export function flowKey(step) {
    return step.kind === "theory" ? `theory:${step.lessonId}` : String(step.ticketId);
}
export function nextFlowItem(released, progress = {}, opts = {}) {
    const list = releasedLessons(released);
    if (!list.length)
        return null;
    const mode = MODES.has(opts.mode) ? opts.mode : "mix";
    const own = opts.own === true;
    const avoid = new Set(opts.avoid || []);
    const just = opts.just ? new Set([opts.just]) : new Set();
    const blocked = new Set([...avoid, ...just]);
    return pick(list, progress, own, mode, opts.last, opts.anchor, blocked, opts.repeat === true)
        ?? pick(list, progress, own, mode, opts.last, opts.anchor, just, opts.repeat === true)
        ?? pick(list, progress, own, mode, opts.last, opts.anchor, new Set(), opts.repeat === true);
}
function pick(list, progress, own, mode, last, anchor, blocked, repeat) {
    const unanswered = (lesson) => work(lesson, own).filter(id => !progress[id]);
    const wrong = (lesson) => work(lesson, own).filter(id => progress[id]?.l === 0);
    const hasWork = list.some(lesson => work(lesson, own).length);
    const doneAll = hasWork && list.every(lesson => work(lesson, own).every(id => progress[id]?.l === 1));
    const anchorLesson = anchor ? list.find(lesson => lesson.id === anchor) : undefined;
    const from = anchorLesson ? list.findIndex(lesson => lesson.id === anchorLesson.id) : -1;
    const entering = (lesson) => {
        const to = list.findIndex(item => item.id === lesson.id);
        const earlier = to > 0 && list.slice(0, to).every(item => work(item, own).every(id => progress[id]));
        return !!last && from >= 0 && to > from && earlier;
    };
    const asTheory = (lesson) => {
        if (!lesson || blocked.has(`theory:${lesson.id}`))
            return null;
        return { kind: "theory", lessonId: lesson.id, title: lesson.title, lead: lesson.lead ?? "", pause: entering(lesson), done: doneAll };
    };
    const asQuestion = (lesson, id, kind) => {
        if (blocked.has(String(id)))
            return null;
        return { kind, lessonId: lesson.id, title: lesson.title, lead: lesson.lead ?? "", ticketId: id, pause: entering(lesson), done: false };
    };
    const firstOf = (kind, ids) => {
        for (const lesson of list) {
            for (const id of ids(lesson)) {
                const step = asQuestion(lesson, id, kind);
                if (step)
                    return step;
            }
        }
        return null;
    };
    const inLesson = (lesson, kind) => {
        for (const id of (kind === "question" ? unanswered(lesson) : wrong(lesson))) {
            const step = asQuestion(lesson, id, kind);
            if (step)
                return step;
        }
        return null;
    };
    const openQ = () => firstOf("question", unanswered);
    const badQ = () => firstOf("review", wrong);
    const againQ = () => {
        const step = firstOf("question", lesson => work(lesson, own).filter(id => progress[id]?.l === 1));
        if (step)
            step.again = true;
        return step;
    };
    const studiedText = () => {
        const studied = list.filter(lesson => work(lesson, own).some(id => progress[id]));
        for (const lesson of (studied.length ? studied : [list[0]])) {
            const step = asTheory(lesson);
            if (step)
                return step;
        }
        return null;
    };
    if (repeat && doneAll)
        return againQ() || asTheory(list[list.length - 1]);
    const next = anchorLesson ? list[list.findIndex(lesson => lesson.id === anchorLesson.id) + 1] : undefined;
    const tail = () => asTheory(next) || asTheory(list[list.length - 1]);
    const anyAnswer = list.some(lesson => work(lesson, own).some(id => progress[id]));
    if (mode === "situations")
        return openQ() || badQ() || asTheory(list.find(lesson => lesson.id === studyLesson(list, progress, { own })?.id));
    if (mode === "review")
        return badQ() || againQ() || studiedText();
    if (mode === "explain") {
        if (last === "theory" && anchorLesson)
            return inLesson(anchorLesson, "question") || inLesson(anchorLesson, "review") || tail();
        const target = list.find(lesson => lesson.id === studyLesson(list, progress, { own })?.id);
        return asTheory(target) || openQ() || badQ() || tail();
    }
    if (!last) {
        if (!anyAnswer)
            return asTheory(list[0]) || openQ();
        const missed = badQ();
        if (missed)
            return missed;
        const unread = list.find(lesson => {
            const ids = work(lesson, own);
            if (!ids.length || ids.some(id => progress[id]))
                return false;
            const index = list.findIndex(item => item.id === lesson.id);
            return list.slice(0, index).every(item => work(item, own).every(id => progress[id]));
        });
        return (unread ? asTheory(unread) : null) || openQ() || asTheory(list[list.length - 1]);
    }
    if (last === "theory" && anchorLesson)
        return inLesson(anchorLesson, "question") || badQ() || tail();
    if (last === "question" && anchorLesson && wrong(anchorLesson).length) {
        return asTheory(anchorLesson) || inLesson(anchorLesson, "question") || badQ() || tail();
    }
    if ((last === "question" || last === "review") && anchorLesson)
        return inLesson(anchorLesson, "question") || badQ() || tail();
    return badQ() || openQ() || asTheory(list[0]);
}
