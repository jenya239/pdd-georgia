import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { JournalEvent } from "../../../packages/course/release.ts";
import { parseBundle } from "../../../packages/domain/bundle.ts";
import type { ProgressView } from "../../../packages/domain/progress.ts";
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

function storedEvent(event: NonNullable<ProgressView["events"]>[number]): JournalEvent {
  const stored: JournalEvent = { id: event.id, t: event.t, c: event.c, ok: event.ok };
  if (event.w) stored.w = event.w;
  if (event.hash) stored.hash = event.hash;
  return stored;
}

export function importProgress(learnerId: string, text: string): Promise<void> {
  const progress = parseBundle(text).state.progress as Record<string, ProgressView> | undefined;
  const batches = Object.entries(progress ?? {}).flatMap(([ticketKey, rec]) => {
    const events = (rec.events ?? []).map(storedEvent);
    return events.length ? [{ ticketKey, events }] : [];
  });
  return withJournal((journal) => journal.importEvents(learnerId, batches));
}
