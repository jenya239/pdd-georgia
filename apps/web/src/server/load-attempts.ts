import { attemptCount } from "@course/attempt-summary.ts";
import { openCourseDb, readJournal } from "@course/store.ts";

export async function loadAttemptCount(learnerId: string, ticketKey: string): Promise<number> {
  const db = openCourseDb();
  try {
    return attemptCount(await readJournal(db, learnerId), ticketKey);
  } finally {
    await db.$disconnect();
  }
}
