/** Site data (built by tools/build.py into data/*.json), fetched once per page. */
let tickets = null, episodes = null;

/** Tickets with `byId` index. */
export async function loadTickets() {
  if (!tickets) {
    tickets = await fetchJson("data/tickets.json");
    tickets.byId = Object.fromEntries(tickets.tickets.map(x => [x.id, x]));
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
