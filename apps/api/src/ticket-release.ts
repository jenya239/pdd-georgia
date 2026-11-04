import { Injectable } from "@nestjs/common";
import { readTicketFace } from "../../../packages/course/read-ticket.ts";
import { openCourseDb } from "../../../packages/course/store.ts";

@Injectable()
export class TicketRelease {
  async hashOf(id: number): Promise<string | null> {
    const db = openCourseDb();
    try {
      const face = await readTicketFace(db, id);
      return face?.hash ?? null;
    } finally {
      await db.$disconnect();
    }
  }
}
