import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { missingMedia, videoReport } from "../../tools/video-gap.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));

test("a published film is not a hole", () => {
  assert.deepEqual(missingMedia(["ep01", "ep09"], repo), ["ep09"]);
});

test("an unfinished film stays pinned, a finished list moves on", () => {
  const pinned = videoReport(repo, "status: in_progress\nnext_episode: ep04\ndone: ep01, ep02, ep03\n");
  assert.equal(pinned.next, "ep04");
  assert.equal(pinned.media, existsSync(path.join(repo, "content/media/ep04.mp4")) ? "есть" : "нет");
  const later = videoReport(repo, "status: ready\ndone: ep01, ep02, ep03, ep04, ep05, ep06, ep07\n");
  assert.equal(later.next, "ep08");
});
