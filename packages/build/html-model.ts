import { backlinkModel, type BacklinkInput } from "./backlinks.ts";

export type PageBacklink = {
  lessons: [string, string[]][];
  concepts: { label: string; intro: number | null }[];
  misconceptions: { belief: string; truth: string }[];
  tickets: number[];
  items: { id: string; q: string }[];
  cited: string[];
};

export function pageModel(input: BacklinkInput): Record<string, PageBacklink> {
  const packed = backlinkModel(input).get("backlinks");
  const out: Record<string, PageBacklink> = {};
  if (!(packed instanceof Map)) return out;
  for (const [id, row] of packed) {
    if (!(row instanceof Map)) continue;
    out[id] = {
      lessons: row.get("lessons") as [string, string[]][],
      concepts: plainRows(row.get("concepts")),
      misconceptions: plainRows(row.get("misconceptions")),
      tickets: row.get("tickets") as number[],
      items: plainRows(row.get("items")),
      cited: row.get("cited") as string[],
    };
  }
  return out;
}

function plainRows<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (item instanceof Map ? Object.fromEntries(item) : item)) as T[];
}
