import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";

const loader = new URL("../../apps/api/load-ts.mjs", import.meta.url);
await register(pathToFileURL(loader.pathname).href, { parentURL: import.meta.url });

test("Nest reads ticket 1 hash 26ab70a7e00969e1 from the course release", async () => {
  const { ticketHash } = await import("../../apps/api/src/ticket-hash.ts");
  assert.equal(await ticketHash(1), "26ab70a7e00969e1");
});
