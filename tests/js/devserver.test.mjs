import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startPagesServer } from "../../tools/dev-server.mjs";

async function read(url, method = "GET") {
  const res = await fetch(url, { method, redirect: "manual" });
  const body = method === "HEAD" ? "" : await res.text();
  return { status: res.status, location: res.headers.get("location"), type: res.headers.get("content-type"), body };
}

test("the dev server serves the site under /pdd-georgia/ and keeps files outside it", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pdd-pages-"));
  fs.writeFileSync(path.join(root, "index.html"), "HOME");
  fs.writeFileSync(path.join(root, "episode.html"), "EP");
  fs.mkdirSync(path.join(root, "norm"));
  fs.writeFileSync(path.join(root, "norm", "index.html"), "NORM");
  fs.mkdirSync(path.join(root, "assets"));
  fs.writeFileSync(path.join(root, "assets", "app.mjs"), "export {}");
  fs.writeFileSync(path.join(root, "404.html"), "MISSING");
  fs.writeFileSync(path.join(path.dirname(root), "secret.txt"), "SECRET");
  const started = await startPagesServer({ root });
  try {
    const home = await read(started.url);
    assert.equal(home.status, 200);
    assert.equal(home.body, "HOME");
    assert.match(home.type, /text\/html/);

    const episode = await read(`${started.url}episode.html?id=ep01`);
    assert.equal(episode.status, 200);
    assert.equal(episode.body, "EP");

    const dir = await read(`${started.url}norm`);
    assert.equal(dir.status, 302);
    assert.equal(dir.location, "/pdd-georgia/norm/");

    const norm = await read(new URL(dir.location, started.url));
    assert.equal(norm.status, 200);
    assert.equal(norm.body, "NORM");

    const script = await read(`${started.url}assets/app.mjs`);
    assert.equal(script.status, 200);
    assert.match(script.type, /javascript/);

    const missing = await read(`${started.url}no-such.html`);
    assert.equal(missing.status, 404);
    assert.equal(missing.body, "MISSING");

    const escaped = await read(`${started.url}../secret.txt`);
    assert.notEqual(escaped.body, "SECRET");

    const head = await read(started.url, "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.body, "");
  } finally {
    await started.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("course json comes from the release, not from the file", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pdd-pages-"));
  fs.mkdirSync(path.join(root, "data"));
  fs.writeFileSync(path.join(root, "data", "tickets.json"), JSON.stringify({ from: "file" }));
  fs.writeFileSync(path.join(root, "index.html"), "HOME");
  fs.writeFileSync(path.join(root, "404.html"), "MISSING");
  const course = {
    async body(path) {
      if (path === "data/tickets.json") return JSON.stringify({ from: "db" });
      return null;
    },
  };
  const started = await startPagesServer({ root, course });
  try {
    const tickets = await read(`${started.url}data/tickets.json`);
    assert.equal(tickets.status, 200);
    assert.match(tickets.type, /application\/json/);
    assert.deepEqual(JSON.parse(tickets.body), { from: "db" });

    const head = await read(`${started.url}data/tickets.json`, "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.body, "");

    const items = await read(`${started.url}data/items.json`);
    assert.equal(items.status, 404);
    assert.equal(items.body, "course release is not loaded");

    const home = await read(started.url);
    assert.equal(home.body, "HOME");
  } finally {
    await started.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a failed course read does not fall back to the file", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pdd-pages-"));
  fs.mkdirSync(path.join(root, "data"));
  fs.writeFileSync(path.join(root, "data", "tickets.json"), JSON.stringify({ from: "file" }));
  const course = { async body() { throw new Error("down"); } };
  const started = await startPagesServer({ root, course });
  try {
    const tickets = await read(`${started.url}data/tickets.json`);
    assert.equal(tickets.status, 500);
    assert.equal(tickets.body, "course release failed");
  } finally {
    await started.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
