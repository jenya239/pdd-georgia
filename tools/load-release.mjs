import { readFileSync } from "node:fs";
import { openCourseDb, saveRelease } from "../packages/course/store.ts";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const course = {
  tickets: read("site/data/tickets.json"),
  items: read("site/data/items.json"),
  episodes: read("site/data/episodes.json"),
  norms: read("content/ontology/generated/norms.json"),
};
const db = openCourseDb();
try {
  const id = await saveRelease(db, course);
  process.stdout.write(id + "\n");
} finally {
  await db.$disconnect();
}
