import type { PrismaClient } from "../../generated/prisma/client.ts";
import { courseSource } from "./source.ts";
import { ticketFace, type TicketFace } from "./ticket-face.ts";

export async function readTicketFace(db: PrismaClient, id: number): Promise<TicketFace | null> {
  const body = await courseSource(db).body("data/tickets.json");
  if (body === null) return null;
  return ticketFace(JSON.parse(body) as unknown, id);
}
