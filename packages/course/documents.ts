import type { Course } from "./release.ts";

const BY_PATH = {
  "data/tickets.json": "tickets",
  "data/items.json": "items",
  "data/episodes.json": "episodes",
} as const;

export type CourseDocumentName = (typeof BY_PATH)[keyof typeof BY_PATH];

export function courseNameOf(path: string): CourseDocumentName | null {
  return Object.hasOwn(BY_PATH, path) ? BY_PATH[path as keyof typeof BY_PATH] : null;
}

export function courseJson(course: Course, path: string): string | null {
  const name = courseNameOf(path);
  return name === null ? null : JSON.stringify(course[name]);
}
