/**
 * One ticket's permanent page (`ticket.html?id=`) and the catalog (`tickets.html`).
 * A link that names a single ticket opens the page. A practice set, a topic, an exam
 * and an error drill stay practice: those URLs are not rewritten.
 * The progress journal stays schema 5. An answer given on the page is the same event
 * as any other, with the existing optional place `ticket`.
 */
import { compareIds, idLabel, isOwnId, parseId } from "./items.mjs";
export const TICKET_PAGE = "ticket.html";
export const TICKET_INDEX = "tickets.html";
export const SIMILAR_CAP = 6;
const ownOf = (ticket) => !!ticket.own || isOwnId(ticket.id);
export function ticketTitle(id) {
    return isOwnId(id) ? `Наш вопрос ${id}` : `Билет № ${id}`;
}
export function ticketHref(id, root = "") {
    return `${root}${TICKET_PAGE}?id=${encodeURIComponent(String(id))}`;
}
export function ticketIndexHref(query = {}, root = "") {
    const params = new URLSearchParams();
    if (query.topic)
        params.set("topic", query.topic);
    if (query.lesson)
        params.set("lesson", query.lesson);
    if (query.q)
        params.set("q", query.q);
    const text = params.toString();
    return `${root}${TICKET_INDEX}${text ? `?${text}` : ""}`;
}
/** `practice.html?ids=<one>` with no extra session parameters. A comma-separated set is not single. */
export function singlePracticeTarget(href) {
    const match = /^(?:\.\.\/)?practice\.html\?ids=([^&#]+)$/.exec(href);
    if (!match)
        return null;
    const ids = match[1].split(",").map(part => part.trim()).filter(Boolean);
    if (ids.length !== 1)
        return null;
    try {
        return decodeURIComponent(ids[0]);
    }
    catch {
        return null;
    }
}
/** Point a single-ticket practice URL at the ticket page. Every other URL stays as it is. */
export function retargetSingleTicketHref(href) {
    const id = singlePracticeTarget(href);
    if (id == null)
        return href;
    return ticketHref(id, href.startsWith("../") ? "../" : "");
}
export function canonicalTicketId(raw) {
    const text = String(raw ?? "").trim();
    if (!text)
        return null;
    const id = parseId(text);
    if (typeof id === "number" && !Number.isFinite(id))
        return null;
    return id;
}
export function excerptQuestion(text, max = 180) {
    const compact = String(text ?? "").replace(/\s+/g, " ").trim();
    if (compact.length <= max)
        return compact;
    return `${compact.slice(0, max - 1).trimEnd()}…`;
}
function topicIdOf(ticket) {
    if (ownOf(ticket) || ticket.t == null || ticket.t === "own")
        return null;
    return String(ticket.t);
}
function neighbor(ticket) {
    if (!ticket)
        return null;
    return { id: ticket.id, label: idLabel(ticket.id) };
}
function normsOf(ticket) {
    const main = ticket.nm?.m ?? [];
    const context = ticket.nm?.x ?? [];
    const mainSlugs = new Set(main.map(pair => pair[0]));
    const seen = new Set();
    const out = [];
    for (const [slug, label] of [...main, ...context]) {
        if (!slug || seen.has(slug))
            continue;
        seen.add(slug);
        out.push({ slug, label, role: mainSlugs.has(slug) ? "main" : "context" });
    }
    return out;
}
function relation(left, right) {
    const reasons = [];
    const main = new Set((left.nm?.m ?? []).map(pair => pair[0]));
    if ((right.nm?.m ?? []).some(pair => main.has(pair[0])))
        reasons.push([4, "та же норма"]);
    const leftTopic = topicIdOf(left);
    const rightTopic = topicIdOf(right);
    if (leftTopic && leftTopic === rightTopic)
        reasons.push([3, "та же тема"]);
    if (left.lesson && left.lesson === right.lesson)
        reasons.push([2, "тот же выпуск"]);
    const concepts = new Set(left.cn ?? []);
    if ((right.cn ?? []).some(id => concepts.has(id)))
        reasons.push([1, "то же понятие"]);
    reasons.sort((a, b) => b[0] - a[0]);
    return reasons.length ? { score: reasons[0][0], why: reasons[0][1] } : { score: 0, why: "" };
}
function idDistance(left, right) {
    if (!isOwnId(left) && !isOwnId(right))
        return Math.abs(Number(left) - Number(right));
    if (isOwnId(left) && isOwnId(right))
        return left === right ? 0 : 1;
    return 10_000;
}
export function ticketPageModel(id, tickets, meta = {}) {
    const ticket = tickets.find(item => String(item.id) === String(id));
    if (!ticket)
        return null;
    const own = ownOf(ticket);
    const pool = tickets.filter(item => ownOf(item) === own).slice().sort((a, b) => compareIds(a.id, b.id));
    const index = pool.findIndex(item => String(item.id) === String(ticket.id));
    const topicId = topicIdOf(ticket);
    const lessonId = ticket.lesson || null;
    const similar = tickets
        .filter(item => String(item.id) !== String(ticket.id))
        .map(item => ({ item, ...relation(ticket, item) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || idDistance(ticket.id, a.item.id) - idDistance(ticket.id, b.item.id) || compareIds(a.item.id, b.item.id))
        .slice(0, SIMILAR_CAP)
        .map(item => ({ id: item.item.id, label: idLabel(item.item.id), why: item.why }));
    return {
        id: ticket.id,
        own,
        title: ticketTitle(ticket.id),
        kind: own ? (ticket.kind || null) : null,
        topicId,
        topicLabel: topicId ? (meta.topics?.[topicId] ?? null) : null,
        lessonId,
        lessonLabel: lessonId ? (meta.lessons?.[lessonId] ?? null) : null,
        ruleLabel: ticket.rule?.label || null,
        series: (ticket.ep ?? []).map(code => ({ code, title: meta.series?.[code] || code })),
        norms: normsOf(ticket),
        concepts: (ticket.cn ?? []).map(concept => ({ id: concept, label: meta.concepts?.[concept] || concept })),
        prev: neighbor(pool[index - 1]),
        next: neighbor(pool[index + 1]),
        similar,
    };
}
export function ticketListRows(tickets, meta = {}) {
    return tickets.slice().sort((a, b) => compareIds(a.id, b.id)).map(ticket => {
        const topicId = topicIdOf(ticket);
        const lessonId = ticket.lesson || null;
        return {
            id: ticket.id,
            own: ownOf(ticket),
            label: idLabel(ticket.id),
            question: ticket.question || "",
            topicId,
            topic: topicId ? (meta.topics?.[topicId] ?? null) : null,
            lessonId,
            lesson: lessonId ? (meta.lessons?.[lessonId] ?? null) : null,
        };
    });
}
export function filterTicketRows(rows, query = {}) {
    const q = (query.q ?? "").trim().toLowerCase();
    const topic = query.topic || "";
    const lesson = query.lesson || "";
    const found = rows.filter(row => {
        if (topic === "own" && !row.own)
            return false;
        if (topic && topic !== "own" && row.topicId !== topic)
            return false;
        if (lesson === "none" && (row.own || row.lessonId))
            return false;
        if (lesson && lesson !== "none" && row.lessonId !== lesson)
            return false;
        if (!q)
            return true;
        const id = String(row.id).toLowerCase();
        return id === q || id.includes(q) || row.question.toLowerCase().includes(q);
    });
    if (!q)
        return found;
    return found.slice().sort((a, b) => {
        const exact = Number(String(a.id).toLowerCase() !== q) - Number(String(b.id).toLowerCase() !== q);
        return exact || compareIds(a.id, b.id);
    });
}
