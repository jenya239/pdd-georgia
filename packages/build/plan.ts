export type PlanRow = {
  e: string;
  block: number;
  title: string;
  src: string;
  n?: number;
};

const ROW = /^\| (E\d{3})(?:–(E\d{3}))? \| (\d+) \| ([^|]+) \| ([^|]+) \|/gm;

export function parsePlan(md: string): PlanRow[] {
  const section = md.split("## 4.")[1];
  if (section === undefined) throw new Error("plan section 4 is missing");
  const plan: PlanRow[] = [];
  for (const match of section.matchAll(ROW)) {
    const start = Number(match[1].slice(1));
    const end = Number((match[2] ?? match[1]).slice(1));
    const count = end - start + 1;
    const title = match[4].trim();
    const src = match[5].trim();
    const block = Number(match[3]);
    for (let i = 0; i < count; i += 1) {
      plan.push({
        e: `E${String(start + i).padStart(3, "0")}`,
        block,
        title: count > 1 ? `${title} (${i + 1}/${count})` : title,
        src,
      });
    }
  }
  return plan;
}

export function withCounts(plan: PlanRow[], episodes: readonly (readonly string[])[]): PlanRow[] {
  const counts = new Map<string, number>();
  for (const list of episodes) {
    for (const id of list) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return plan.map((row) => ({ ...row, n: counts.get(row.e) ?? 0 }));
}
