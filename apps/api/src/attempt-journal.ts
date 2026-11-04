import { Injectable } from "@nestjs/common";
import type { JournalEvent } from "../../../packages/course/release.ts";
import { openCourseDb, readJournal, saveAttempts } from "../../../packages/course/store.ts";

@Injectable()
export class AttemptJournal {
  async record(learnerId: string, ticketKey: string, event: JournalEvent): Promise<void> {
    const db = openCourseDb();
    try {
      await saveAttempts(db, learnerId, ticketKey, [event]);
    } finally {
      await db.$disconnect();
    }
  }

  async read(learnerId: string): Promise<Record<string, JournalEvent[]>> {
    const db = openCourseDb();
    try {
      return await readJournal(db, learnerId);
    } finally {
      await db.$disconnect();
    }
  }

  async importEvents(learnerId: string, batches: { ticketKey: string; events: JournalEvent[] }[]): Promise<void> {
    const db = openCourseDb();
    try {
      for (const batch of batches) await saveAttempts(db, learnerId, batch.ticketKey, batch.events);
    } finally {
      await db.$disconnect();
    }
  }
}
