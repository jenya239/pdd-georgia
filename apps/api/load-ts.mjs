import { readFile } from "node:fs/promises";
import ts from "typescript";

// Node's type strip rejects decorators, so only Nest sources are transpiled.
const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2023,
  experimentalDecorators: true,
  importHelpers: true,
};

export async function load(url, context, nextLoad) {
  if (!url.includes("/apps/api/") || !url.endsWith(".ts")) return nextLoad(url, context);
  const source = await readFile(new URL(url), "utf8");
  const transpiled = ts.transpileModule(source, { compilerOptions, fileName: url });
  return { format: "module", source: transpiled.outputText, shortCircuit: true };
}
