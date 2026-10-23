/** Site data (built by tools/build.py into data/*.json), fetched once per page. */
import { itemAsTicket } from "../domain/items.mjs";

let tickets = null, episodes = null;

/** Bank tickets (`tickets`) and own check items (`items`, ticket-shaped) with one `byId` index;
 *  `mc` — typical errors by id, `ticketDistractors` — typical errors behind bank ticket options. */
export async function loadTickets() {
  if (!tickets) {
    const [T, I] = await Promise.all([fetchJson("data/tickets.json"), fetchJson("data/items.json")]);
    tickets = T;
    tickets.items = I.items.map(itemAsTicket);
    tickets.mc = I.misconceptions;
    tickets.ticketDistractors = I.ticket_distractors;
    tickets.byId = Object.fromEntries([...tickets.tickets, ...tickets.items].map(x => [x.id, x]));
  }
  return tickets;
}

export async function loadEpisodes() {
  if (!episodes) episodes = await fetchJson("data/episodes.json");
  return episodes;
}

/** Synchronous access for renderers; the page must have awaited loadTickets() first. */
export function loadedTickets() {
  if (!tickets) throw new Error("tickets are not loaded yet");
  return tickets;
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
