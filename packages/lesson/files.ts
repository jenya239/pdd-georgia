import { render as renderEp01 } from "../../content/lessons/ep01/plain.mjs";
import { render as renderEp02 } from "../../content/lessons/ep02/plain.mjs";
import { render as renderEp03 } from "../../content/lessons/ep03/plain.mjs";
import { render as renderPlain04 } from "../../content/lessons/ep04/plain.mjs";
import { render as renderPlain05 } from "../../content/lessons/ep05/plain.mjs";
import { render as renderPlain06 } from "../../content/lessons/ep06/plain.mjs";
import { ep04Source } from "./ep04.ts";
import { figCrossingSigns, figCrossingZebra, figLevels, figRailway, figTown } from "./ep04-figs.ts";
import { ep05Source } from "./ep05.ts";
import { figBoarding, figOutside, figRoles } from "./ep05-figs.ts";
import { ep06Source } from "./ep06.ts";
import { figScale, figTram, figTree } from "./ep06-figs.ts";
import { ep07Source } from "./ep07.ts";
import { ep08Source } from "./ep08.ts";
import { publishedLesson } from "./publish.ts";

const figs04 = {
  fig_crossing_zebra: figCrossingZebra(),
  fig_crossing_signs: figCrossingSigns(),
  fig_railway: figRailway(),
  fig_levels: figLevels(),
  fig_town: figTown(),
};
const figs05 = {
  fig_roles: figRoles(),
  fig_outside: figOutside(),
  fig_boarding: figBoarding(),
};
const figs06 = {
  fig_tree: figTree(),
  fig_scale: figScale(),
  fig_tram: figTram(),
};

const raw: Record<string, string> = {
  "ep01-plain": renderEp01(),
  "ep02-plain": renderEp02(),
  "ep03-plain": renderEp03(),
  ep04: ep04Source(),
  "ep04-plain": renderPlain04(figs04),
  ep05: ep05Source(),
  "ep05-plain": renderPlain05(figs05),
  ep06: ep06Source(),
  "ep06-plain": renderPlain06(figs06),
  ep07: ep07Source(),
  ep08: ep08Source(),
};

export function lessonFiles(): Record<string, string> {
  return {
    "lessons/ep01-plain.html": publishedLesson(raw["ep01-plain"], "ep01"),
    "lessons/ep02-plain.html": publishedLesson(raw["ep02-plain"], "ep02"),
    "lessons/ep03-plain.html": publishedLesson(raw["ep03-plain"], "ep03"),
    "lessons/ep04.html": publishedLesson(raw.ep04, "ep04"),
    "lessons/ep04-plain.html": publishedLesson(raw["ep04-plain"], "ep04"),
    "lessons/ep05.html": publishedLesson(raw.ep05, "ep05"),
    "lessons/ep05-plain.html": publishedLesson(raw["ep05-plain"], "ep05"),
    "lessons/ep06.html": publishedLesson(raw.ep06, "ep06"),
    "lessons/ep06-plain.html": publishedLesson(raw["ep06-plain"], "ep06"),
    "lessons/ep07.html": publishedLesson(raw.ep07, "ep07"),
    "lessons/ep08.html": publishedLesson(raw.ep08, "ep08"),
  };
}

export function lessonBundle(): { raw: Record<string, string>; linked: Record<string, string> } {
  return { raw, linked: lessonFiles() };
}
