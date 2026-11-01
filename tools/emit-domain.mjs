/**
 * Emits packages/domain/*.ts as browser ESM (assets/domain/*.mjs).
 * tsc rewrites `./x.ts` to `./x.js`; this script renames the files and those specifiers to `.mjs`.
 * stdout is one JSON object { "progress.mjs": "…", … }. Node-only imports (node:crypto) stay.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const out = mkdtempSync(join(tmpdir(), "pdd-domain-"));

try {
  const run = spawnSync(process.execPath, [
    tsc, "-p", "packages/domain",
    "--noEmit", "false", "--outDir", out,
    "--declaration", "false", "--sourceMap", "false", "--pretty", "false",
  ], { cwd: root, encoding: "utf8" });
  if (run.status !== 0) {
    process.stderr.write(run.stdout || "");
    process.stderr.write(run.stderr || "");
    process.exit(run.status || 1);
  }
  const files = {};
  for (const name of readdirSync(out).filter((n) => n.endsWith(".js")).sort()) {
    const text = readFileSync(join(out, name), "utf8").replace(
      /(from\s+)(["'])(\.[^"']+)\.js\2/g,
      (_, keyword, quote, path) => `${keyword}${quote}${path}.mjs${quote}`,
    );
    files[name.replace(/\.js$/, ".mjs")] = text;
  }
  process.stdout.write(JSON.stringify(files));
} finally {
  rmSync(out, { recursive: true, force: true });
}
