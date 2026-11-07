import { explicitCites, findRu, resolveRu } from "../lesson/normref.ts";
import { findKa, resolveKa } from "./normref-ka.ts";

type Cite = [string, string | null];

export type NormJob = {
  id: string;
  lang: "ru" | "ka";
  text: string;
  confirmed?: string[];
  strict?: boolean;
  ownArticle?: string | null;
  scopes?: Cite[][];
};

export function occurrences(jobs: NormJob[], ids: Set<string>, kaText: Map<string, string>): [number, number, string | null][][] {
  return jobs.map((job) => (job.lang === "ru" ? russian(job, ids) : georgian(job, ids, kaText)));
}

function russian(job: NormJob, ids: Set<string>): [number, number, string | null][] {
  const refs = findRu(job.text);
  resolveRu(refs, ids, [explicitCites(refs), ...(job.scopes ?? [])], job.ownArticle ?? null);
  return refs.map((ref) => [ref.start, ref.end, ref.status === "linked" ? ref.norm : ref.status]);
}

function georgian(job: NormJob, ids: Set<string>, kaText: Map<string, string>): [number, number, string | null][] {
  const refs = resolveKa(findKa(job.text), ids, kaText, job.confirmed ?? [], job.strict === true);
  return refs.map((ref) => [ref.start, ref.end, ref.status === "linked" ? ref.norm : ref.status]);
}
