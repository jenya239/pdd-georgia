import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { JournalEvent } from "../../../packages/course/release.ts";
import { AppModule } from "./app.module.ts";
import { AttemptJournal } from "./attempt-journal.ts";

async function withJournal<T>(use: (journal: AttemptJournal) => Promise<T>): Promise<T> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    return await use(app.get(AttemptJournal));
  } finally {
    await app.close();
  }
}

export function recordAttempt(learnerId: string, ticketKey: string, event: JournalEvent): Promise<void> {
  return withJournal((journal) => journal.record(learnerId, ticketKey, event));
}

export function readLearnerJournal(learnerId: string): Promise<Record<string, JournalEvent[]>> {
  return withJournal((journal) => journal.read(learnerId));
}
