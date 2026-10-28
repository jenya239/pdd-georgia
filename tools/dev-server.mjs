import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES_PREFIX, resolvePages } from "../packages/domain/pageshost.mjs";

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

export function createPagesServer(root) {
  const siteRoot = path.resolve(root);
  const lookup = lookupOf(siteRoot);
  return http.createServer((req, res) => {
    const result = resolvePages(req.url ?? "/", lookup);
    if (result.type === "redirect") {
      res.writeHead(result.status, { Location: result.location });
      res.end();
      return;
    }
    if (result.type !== "file") {
      const body = Buffer.from("Not found");
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Content-Length": body.length });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }
    const full = insideRoot(siteRoot, result.path);
    const body = full ? fs.readFileSync(full) : null;
    if (!body) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : "Not found");
      return;
    }
    const type = TYPES[path.extname(result.path).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(result.status, { "Content-Type": type, "Content-Length": body.length, "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : body);
  });
}

export function startPagesServer({ root, host = "127.0.0.1", port = 0 } = {}) {
  const server = createPagesServer(root);
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
  const root = path.resolve(repoRoot, option("root", "docs"));
  startPagesServer({ root, host, port }).then(({ url }) => {
    console.log(url);
  });
}
