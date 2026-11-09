import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nextLesson, readDone, readStatus } from "./lesson-gap.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readNextEpisode(stateText) {
  const line = String(stateText).split("\n").find((row) => row.startsWith("next_episode:"));
  return line ? line.slice("next_episode:".length).trim() : "";
}

function episodeIds(repo) {
  return JSON.parse(readFileSync(path.join(repo, "content/episodes.json"), "utf8")).map((episode) => episode.id);
}

export function missingMedia(ids, repo) {
  return ids.filter((id) => !existsSync(path.join(repo, "content/media", `${id}.mp4`)));
}

export function videoReport(repo, stateText) {
  const ids = episodeIds(repo);
  const done = readDone(stateText);
  const status = readStatus(stateText);
  const pinned = readNextEpisode(stateText);
  const next = status === "in_progress" && pinned ? pinned : nextLesson(ids, done);
  return { next, status, media: existsSync(path.join(repo, "content/media", `${next}.mp4`)) ? "есть" : "нет" };
}

function printReport(report) {
  console.log(`next: ${report.next}`);
  console.log(`status: ${report.status}`);
  console.log(`media: ${report.media}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const statePath = path.join(root, "docs/agent/PDD_VIDEO_STATE.md");
  printReport(videoReport(root, readFileSync(statePath, "utf8")));
}
