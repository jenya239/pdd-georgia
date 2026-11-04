export type TicketFace = {
  id: number;
  question: string;
  options: string[];
  hash: string;
  original: string;
  explanation: string;
};

export function parseTicketId(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export function ticketFace(document: unknown, id: number): TicketFace | null {
  const ticket = findTicket(document, id);
  if (!ticket) return null;
  const question = russianText(ticket.q);
  const options = russianOptions(ticket.a);
  if (question === null || options === null || typeof ticket.hash !== "string" || ticket.hash === "") return null;
  return {
    id,
    question,
    options,
    hash: ticket.hash,
    original: text(ticket.ex),
    explanation: text(ticket.ex_ru),
  };
}

function findTicket(document: unknown, id: number): Record<string, unknown> | null {
  if (!isRecord(document) || !Array.isArray(document.tickets)) return null;
  const found = document.tickets.find((item) => isRecord(item) && item.id === id);
  return isRecord(found) ? found : null;
}

function russianText(value: unknown): string | null {
  if (!isRecord(value) || typeof value.ru !== "string" || value.ru === "") return null;
  return value.ru;
}

function russianOptions(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.ru) || value.ru.length === 0) return null;
  if (value.ru.some((option) => typeof option !== "string" || option === "")) return null;
  return value.ru;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
