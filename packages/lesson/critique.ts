export const CRITIQUE_KINDS = ["translation", "boundary", "silence", "variation", "naive"] as const;

export type CritiqueKind = (typeof CRITIQUE_KINDS)[number];

export type Critique = {
  id: string;
  lesson: string;
  kind: CritiqueKind;
  norms: string[];
  anchor: string;
  point: string;
  ru?: string;
  ka?: string;
};

export function critiqueErrors(records: Critique[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const key = record.id || "?";
    if (seen.has(key)) errors.push(`${key}: duplicate id`);
    seen.add(key);
    if (!/^cr-ep\d\d-/.test(key)) errors.push(`${key}: id must start with cr-epNN-`);
    if (!CRITIQUE_KINDS.includes(record.kind)) errors.push(`${key}: unknown kind`);
    if (!record.norms?.length) errors.push(`${key}: needs a norm`);
    if (!record.anchor || !record.point) errors.push(`${key}: needs an anchor and our own point`);
    if ("text" in record) errors.push(`${key}: a critique does not carry the norm text`);
    if (record.kind === "translation" && (!record.ru || !record.ka)) errors.push(`${key}: translation needs ru and ka`);
    if (record.kind !== "translation" && (record.ru || record.ka)) errors.push(`${key}: only a translation carries ru and ka`);
  }
  return errors;
}
