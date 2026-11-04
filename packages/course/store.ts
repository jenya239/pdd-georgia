import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { databaseUrl } from "./database-url.ts";
import { releaseId, type Course, type JournalEvent } from "./release.ts";

export function openCourseDb(url = databaseUrl()) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Inserts the release when its id is new. The same course a second time does not write another row. */
export async function saveRelease(db: PrismaClient, course: Course): Promise<string> {
  const id = releaseId(course);
  await db.courseRelease.createMany({
    data: [{ id, tickets: course.tickets as object, items: course.items as object, episodes: course.episodes as object, norms: course.norms as object }],
    skipDuplicates: true,
  });
  return id;
}

export async function loadRelease(db: PrismaClient, id: string): Promise<Course | null> {
  const row = await db.courseRelease.findUnique({ where: { id } });
  if (!row) return null;
  return { tickets: row.tickets, items: row.items, episodes: row.episodes, norms: row.norms };
}

/** Inserts journal events. An event id that is already stored is left as it was. */
export async function saveAttempts(db: PrismaClient, learnerId: string, ticketKey: string, events: JournalEvent[]): Promise<void> {
  if (!events.length) return;
  await db.attempt.createMany({
    data: events.map((event) => ({
      learnerId,
      id: event.id,
      ticketKey,
      t: BigInt(event.t),
      c: event.c,
      ok: event.ok,
      w: event.w ?? null,
      hash: event.hash ?? null,
    })),
    skipDuplicates: true,
  });
}

/** The learner's journal, grouped by ticket, oldest event first. */
export async function readJournal(db: PrismaClient, learnerId: string): Promise<Record<string, JournalEvent[]>> {
  const rows = await db.attempt.findMany({ where: { learnerId }, orderBy: [{ t: "asc" }, { id: "asc" }] });
  const out: Record<string, JournalEvent[]> = {};
  for (const row of rows) {
    const event: JournalEvent = { id: row.id, t: Number(row.t), c: row.c, ok: row.ok === 1 ? 1 : 0 };
    if (row.w) event.w = row.w;
    if (row.hash) event.hash = row.hash;
    (out[row.ticketKey] ??= []).push(event);
  }
  return out;
}
