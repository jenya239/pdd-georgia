import type { Norm } from "./text.ts";

const SHOW: Record<string, string> = { "^2": "²", "^3": "³", "^4": "⁴" };

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function show(num: string): string {
  let out = num;
  for (const [mark, digit] of Object.entries(SHOW)) out = out.replaceAll(mark, digit);
  return out;
}

export function citation(norm: Norm): string {
  const id = norm.id;
  if (id.startsWith("A")) {
    const colon = id.indexOf(":");
    const annex = id.slice(1, colon);
    const item = id.slice(colon + 1);
    const note = item.match(/^(\d+)\.прим(\d*)((?:\.[а-я])*)$/u);
    if (note) {
      const letters = note[3].replace(/^\./u, "");
      const number = note[2] ? ` ${note[2]}` : "";
      return `прил. ${annex}, разд. ${note[1]}, примечание${number}${letters ? ` «${letters}»` : ""}`;
    }
    return `${annex === "1" ? "знак " : "разметка "}${item}`;
  }
  const [art, ...rest] = id.split(".");
  let out = `ст. ${art}`;
  if (rest.length) {
    out += `, п. ${show(rest[0])}`;
    if (rest.length > 1) out += ` «${rest.slice(1).join(".")}»`;
  }
  return out;
}

export function excerpt(value: string, limit: number): string {
  const text = (value || "").split(/\s/u).filter(Boolean).join(" ");
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${space < 0 ? cut : cut.slice(0, space)}…`;
}
