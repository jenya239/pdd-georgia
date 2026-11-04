import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { courseNameOf } from "../packages/course/documents.ts";
import { PAGES_PREFIX, resolvePages } from "../packages/domain/pageshost.ts";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function insideRoot(root, rel) {
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

function lookupOf(root) {
  const stat = (rel) => {
    const full = insideRoot(root, rel);
    if (!full) return null;
    try {
      return fs.statSync(full);
    } catch {
      return null;
    }
  };
  return {
    isFile: (rel) => stat(rel)?.isFile() ?? false,
    isDir: (rel) => stat(rel)?.isDirectory() ?? false,
  };
}

function withCourse(lookup, course) {
  if (!course) return lookup;
  return {
    isFile: (rel) => courseNameOf(rel) !== null || lookup.isFile(rel),
    isDir: (rel) => courseNameOf(rel) === null && lookup.isDir(rel),
  };
}

function write(res, req, status, type, body) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, { "Content-Type": type, "Content-Length": bytes.length, "Cache-Control": "no-cache" });
  res.end(req.method === "HEAD" ? undefined : bytes);
}

async function sendCourse(res, req, course, filePath) {
  const json = await course.body(filePath);
  if (json == null) {
    write(res, req, 404, "text/plain; charset=utf-8", "course release is not loaded");
    return;
  }
  write(res, req, 200, "application/json; charset=utf-8", json);
}

function sendFile(res, req, siteRoot, result) {
  const full = insideRoot(siteRoot, result.path);
  const body = full ? fs.readFileSync(full) : null;
  if (!body) {
    write(res, req, 404, "text/plain; charset=utf-8", "Not found");
    return;
  }
  const type = TYPES[path.extname(result.path).toLowerCase()] ?? "application/octet-stream";
  write(res, req, result.status, type, body);
}

async function handle(req, res, siteRoot, lookup, course) {
  const result = resolvePages(req.url ?? "/", lookup);
  if (result.type === "redirect") {
    res.writeHead(result.status, { Location: result.location });
    res.end();
    return;
  }
  if (result.type !== "file") {
    write(res, req, 404, "text/plain; charset=utf-8", "Not found");
    return;
  }
  if (course && courseNameOf(result.path)) {
    await sendCourseOrFail(res, req, course, result.path);
    return;
  }
  sendFile(res, req, siteRoot, result);
}

async function sendCourseOrFail(res, req, course, filePath) {
  try {
    await sendCourse(res, req, course, filePath);
  } catch {
    if (!res.headersSent) write(res, req, 500, "text/plain; charset=utf-8", "course release failed");
  }
}

export function createPagesServer(root, course = null) {
  const siteRoot = path.resolve(root);
  const lookup = withCourse(lookupOf(siteRoot), course);
  return http.createServer((req, res) => {
    void handle(req, res, siteRoot, lookup, course);
  });
}

export function startPagesServer({ root, host = "127.0.0.1", port = 0, course = null } = {}) {
  const server = createPagesServer(root, course);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const { port: bound } = server.address();
      resolve({
        server,
        url: `http://${host}:${bound}${PAGES_PREFIX}/`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function option(name, fallback) {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const host = option("host", "127.0.0.1");
  const port = Number(option("port", "8000"));
  const root = path.resolve(repoRoot, option("root", "site"));
  const { openCourseDb } = await import("../packages/course/store.ts");
  const { courseSource } = await import("../packages/course/source.ts");
  startPagesServer({ root, host, port, course: courseSource(openCourseDb()) }).then(({ url }) => {
    console.log(url);
  });
}
