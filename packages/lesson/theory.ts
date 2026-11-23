import { render as renderEp01 } from "../../content/lessons/ep01/plain.mjs";
import { render as renderEp02 } from "../../content/lessons/ep02/plain.mjs";
import { render as renderEp03 } from "../../content/lessons/ep03/plain.mjs";
import { render as renderEp04 } from "../../content/lessons/ep04/plain.mjs";
import { render as renderEp05 } from "../../content/lessons/ep05/plain.mjs";
import { render as renderEp06 } from "../../content/lessons/ep06/plain.mjs";
import { ep07Source } from "./ep07.ts";
import { ep08Source } from "./ep08.ts";
import { publishedTheory } from "./publish.ts";

const sources: Record<string, () => string> = {
  ep01: renderEp01,
  ep02: renderEp02,
  ep03: renderEp03,
  ep04: () => renderEp04({}),
  ep05: () => renderEp05({}),
  ep06: () => renderEp06({}),
  ep07: ep07Source,
  ep08: ep08Source,
};

export function lessonTheory(id: string): string {
  const source = sources[id];
  if (!source) throw new Error(`no lesson theory for ${id}`);
  return publishedTheory(source(), id);
}
