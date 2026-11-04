import { render as renderEp01 } from "../../content/lessons/ep01/plain.mjs";
import { render as renderEp02 } from "../../content/lessons/ep02/plain.mjs";
import { render as renderEp03 } from "../../content/lessons/ep03/plain.mjs";
import { ep04Source } from "./ep04.ts";
import { ep05Source } from "./ep05.ts";
import { ep06Source } from "./ep06.ts";
import { publishedTheory } from "./publish.ts";

const sources: Record<string, () => string> = {
  ep01: renderEp01,
  ep02: renderEp02,
  ep03: renderEp03,
  ep04: ep04Source,
  ep05: ep05Source,
  ep06: ep06Source,
};

export function lessonTheory(id: string): string {
  const source = sources[id];
  if (!source) throw new Error(`no lesson theory for ${id}`);
  return publishedTheory(source(), id);
}
