import type { JournalEvent } from "./release.ts";

export function attemptCount(journal: Record<string, JournalEvent[]>, ticketKey: string): number {
  return journal[ticketKey]?.length ?? 0;
}
