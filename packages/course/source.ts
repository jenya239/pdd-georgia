import type { PrismaClient } from "../../generated/prisma/client.ts";
import { courseJson, courseNameOf } from "./documents.ts";
import type { Course } from "./release.ts";
import { loadRelease } from "./store.ts";

export type CourseSource = {
  body(path: string): Promise<string | null>;
};

export function courseSource(db: PrismaClient): CourseSource {
  let loaded: { id: string; course: Course } | null = null;
  return {
    async body(path: string) {
      if (courseNameOf(path) === null) return null;
      const id = await latestReleaseId(db);
      if (id === null) return null;
      if (loaded?.id !== id) loaded = await loadCached(db, id);
      return loaded === null ? null : courseJson(loaded.course, path);
    },
  };
}

async function latestReleaseId(db: PrismaClient): Promise<string | null> {
  const row = await db.courseRelease.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return row?.id ?? null;
}

async function loadCached(db: PrismaClient, id: string) {
  const course = await loadRelease(db, id);
  return course === null ? null : { id, course };
}
