/**
 * Invariants:
 * - only a path under /pdd-georgia/ can name a file of the site
 * - the relative path has no "." or ".." segment
 * - a directory URL redirects to the same path with a trailing slash, keeping the query
 * - a missing file is 404.html when that file exists in the site root
 */
export const PAGES_PREFIX = "/pdd-georgia";

export function resolvePages(rawUrl, lookup) {
  let url;
  try {
    url = new URL(rawUrl, "http://127.0.0.1");
  } catch {
    return { type: "missing", status: 404 };
  }
  const { pathname, search } = url;
  if (pathname === "/" || pathname === PAGES_PREFIX) {
    return { type: "redirect", status: 302, location: `${PAGES_PREFIX}/${search}` };
  }
  const prefix = `${PAGES_PREFIX}/`;
  if (!pathname.startsWith(prefix)) return { type: "missing", status: 404 };
  const rel = pathname.slice(prefix.length);
  if (rel.split("/").some((seg) => seg === "." || seg === ".." || seg.includes("\0"))) {
    return { type: "missing", status: 404 };
  }
  const path = rel === "" || rel.endsWith("/") ? `${rel}index.html` : rel;
  if (lookup.isFile(path)) return { type: "file", status: 200, path };
  if (rel !== "" && !rel.endsWith("/") && lookup.isDir(rel)) {
    return { type: "redirect", status: 302, location: `${pathname}/${search}` };
  }
  if (lookup.isFile("404.html")) return { type: "file", status: 404, path: "404.html" };
  return { type: "missing", status: 404 };
}
