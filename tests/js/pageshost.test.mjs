import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePages } from "../../packages/domain/pageshost.mjs";

function site(files, dirs = []) {
  const fileSet = new Set(files);
  const dirSet = new Set(dirs);
  return {
    isFile: (rel) => fileSet.has(rel),
    isDir: (rel) => dirSet.has(rel),
  };
}

const lookup = site(
  ["index.html", "episode.html", "404.html", "norm/index.html", "assets/app.mjs"],
  ["norm", "assets"],
);

test("the site root and a page resolve under /pdd-georgia/", () => {
  assert.deepEqual(resolvePages("/pdd-georgia/", lookup), { type: "file", status: 200, path: "index.html" });
  assert.deepEqual(resolvePages("/pdd-georgia/episode.html?id=ep01", lookup), { type: "file", status: 200, path: "episode.html" });
  assert.deepEqual(resolvePages("/pdd-georgia/norm/", lookup), { type: "file", status: 200, path: "norm/index.html" });
});

test("the bare prefix and the host root redirect into the site", () => {
  assert.deepEqual(resolvePages("/pdd-georgia", lookup), { type: "redirect", status: 302, location: "/pdd-georgia/" });
  assert.deepEqual(resolvePages("/?x=1", lookup), { type: "redirect", status: 302, location: "/pdd-georgia/?x=1" });
});

test("a directory without a slash redirects to itself with a slash", () => {
  assert.deepEqual(resolvePages("/pdd-georgia/norm?x=1", lookup), {
    type: "redirect", status: 302, location: "/pdd-georgia/norm/?x=1",
  });
});

test("a path outside the prefix is not a file of this site", () => {
  assert.deepEqual(resolvePages("/secret", lookup), { type: "missing", status: 404 });
  assert.deepEqual(resolvePages("/pdd-georgia/../secret", lookup), { type: "missing", status: 404 });
  assert.deepEqual(resolvePages("/pdd-georgia/%2e%2e/secret", lookup), { type: "missing", status: 404 });
});

test("a missing page is the site 404.html", () => {
  assert.deepEqual(resolvePages("/pdd-georgia/no-such.html", lookup), { type: "file", status: 404, path: "404.html" });
});

test("without 404.html a missing page has no file", () => {
  const bare = site(["index.html"]);
  assert.deepEqual(resolvePages("/pdd-georgia/no-such.html", bare), { type: "missing", status: 404 });
});
