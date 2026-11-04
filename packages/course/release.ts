import { createHash } from "node:crypto";

export const COURSE_FILES = ["tickets", "items", "episodes", "norms"] as const;

export type Course = {
  tickets: unknown;
  items: unknown;
  episodes: unknown;
  norms: unknown;
};

export type JournalEvent = {
  id: string;
  t: number;
  c: number | null;
  ok: 0 | 1;
  w?: string;
  hash?: string;
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])]));
  }
  return value;
}

/** Identity of an immutable release: the same course files always hash to the same id. */
export function releaseId(course: Course): string {
  return createHash("sha256").update(JSON.stringify(stable(course))).digest("hex").slice(0, 16);
}
