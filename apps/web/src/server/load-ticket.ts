import { openCourseDb } from "@course/store.ts";
import { readTicketFace } from "@course/read-ticket.ts";
import type { TicketFace } from "@course/ticket-face.ts";

export async function loadTicketFace(id: number): Promise<TicketFace | null> {
  const db = openCourseDb();
  try {
    return await readTicketFace(db, id);
  } finally {
    await db.$disconnect();
  }
}
