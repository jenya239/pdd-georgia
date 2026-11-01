import { createHash } from "node:crypto";
/** First 16 hex chars of sha256 over the Russian question, the Russian options and the correct index.
 *  The picture, the breakdown and the rest of the snapshot are not hashed: an attempt stays
 *  comparable for as long as the question the learner answered is the same text.
 *  Node only. Pages do not import this module. */
export function ticketHash(ticket) {
    const q = ticket?.q && typeof ticket.q === "object" ? String(ticket.q.ru ?? "") : String(ticket?.q ?? "");
    const options = ticket?.a && typeof ticket.a === "object" ? (ticket.a.ru ?? []) : (ticket?.options ?? []);
    const correct = ticket?.c ?? ticket?.answer ?? null;
    return createHash("sha256").update(JSON.stringify({ q, options, correct })).digest("hex").slice(0, 16);
}
