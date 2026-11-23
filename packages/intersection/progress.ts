/**
 * Local counts and a short situation log. This is a record, not a claim
 * that the count measures real-world driving, and it does not choose the next statute.
 * The ticket journal stays schema 5; this object lives in its own storage key.
 */
import type { Scenario } from "./model.ts";

export interface ConceptCount {
  seen: number;
  firstTry: number;
  missed: number;
}

export interface StepNote {
  vehicleId: string;
  correct: boolean;
  text: string;
  norms: { id: string; label: string }[];
  highlight: {
    selected: string;
    yieldTo: string[];
    paths: string[];
    signs: string[];
  };
}

export interface SituationRecord {
  scenario: Scenario;
  steps: StepNote[];
}

export interface Progress {
  version: 1;
  answered: number;
  firstTry: number;
  concepts: Record<string, ConceptCount>;
  history: SituationRecord[];
}

export const HISTORY_LIMIT = 40;

const isObj = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function freshProgress(): Progress {
  return { version: 1, answered: 0, firstTry: 0, concepts: {}, history: [] };
}

export function recordProgress(progress: Progress, concept: string, firstTry: boolean): Progress {
  const previous = progress.concepts[concept] ?? { seen: 0, firstTry: 0, missed: 0 };
  const concepts = {
    ...progress.concepts,
    [concept]: {
      seen: previous.seen + 1,
      firstTry: previous.firstTry + (firstTry ? 1 : 0),
      missed: previous.missed + (firstTry ? 0 : 1),
    },
  };
  return {
    version: 1,
    answered: progress.answered + 1,
    firstTry: progress.firstTry + (firstTry ? 1 : 0),
    concepts,
    history: progress.history ?? [],
  };
}

export function rememberSituation(progress: Progress, record: SituationRecord): Progress {
  const copy: SituationRecord = {
    scenario: record.scenario,
    steps: record.steps.map((step) => ({
      vehicleId: step.vehicleId,
      correct: step.correct,
      text: step.text,
      norms: step.norms.map((norm) => ({ id: norm.id, label: norm.label })),
      highlight: {
        selected: step.highlight.selected,
        yieldTo: [...step.highlight.yieldTo],
        paths: [...step.highlight.paths],
        signs: [...step.highlight.signs],
      },
    })),
  };
  return {
    ...progress,
    history: [...(progress.history ?? []), copy].slice(-HISTORY_LIMIT),
  };
}

/** The line worth keeping under the next task: a correct step that cites a norm, else the last one. */
export function situationSummary(record: SituationRecord | null | undefined): StepNote | null {
  if (!record || !Array.isArray(record.steps) || record.steps.length === 0) return null;
  const correct = record.steps.filter((step) => step.correct);
  const withNorm = [...correct].reverse().find((step) => step.norms.length > 0);
  return withNorm ?? correct[correct.length - 1] ?? record.steps[record.steps.length - 1] ?? null;
}

export function parseProgress(raw: unknown): Progress {
  if (!isObj(raw)) return freshProgress();
  if (raw.version !== 1 || typeof raw.answered !== "number" || typeof raw.firstTry !== "number") return freshProgress();
  if (!isObj(raw.concepts)) return freshProgress();
  return {
    version: 1,
    answered: raw.answered,
    firstTry: raw.firstTry,
    concepts: raw.concepts as Progress["concepts"],
    history: cleanHistory(raw.history),
  };
}

function cleanHistory(raw: unknown): SituationRecord[] {
  if (!Array.isArray(raw)) return [];
  const records: SituationRecord[] = [];
  for (const item of raw) {
    const record = cleanRecord(item);
    if (record) records.push(record);
  }
  return records.slice(-HISTORY_LIMIT);
}

function cleanRecord(raw: unknown): SituationRecord | null {
  if (!isObj(raw) || !cleanScenario(raw.scenario) || !Array.isArray(raw.steps)) return null;
  const steps = raw.steps.map(cleanStep).filter((step): step is StepNote => step !== null);
  if (!steps.length) return null;
  return { scenario: raw.scenario as Scenario, steps };
}

function cleanScenario(raw: unknown): raw is Scenario {
  if (!isObj(raw) || !Array.isArray(raw.vehicles) || !Array.isArray(raw.approaches)) return false;
  if (raw.vehicles.length < 1 || raw.vehicles.length > 8) return false;
  if (raw.approaches.length < 1 || raw.approaches.length > 8) return false;
  return raw.vehicles.every((vehicle) =>
    isObj(vehicle) && typeof vehicle.id === "string" && typeof vehicle.from === "string" && typeof vehicle.maneuver === "string");
}

function cleanStep(raw: unknown): StepNote | null {
  if (!isObj(raw) || typeof raw.vehicleId !== "string" || typeof raw.correct !== "boolean") return null;
  if (typeof raw.text !== "string" || raw.text.length === 0 || raw.text.length > 500) return null;
  const norms = Array.isArray(raw.norms)
    ? raw.norms.flatMap((item) => {
      if (!isObj(item) || typeof item.id !== "string" || typeof item.label !== "string") return [];
      return [{ id: item.id, label: item.label }];
    })
    : [];
  return {
    vehicleId: raw.vehicleId,
    correct: raw.correct,
    text: raw.text,
    norms,
    highlight: cleanHighlight(raw.highlight, raw.vehicleId),
  };
}

function cleanHighlight(raw: unknown, vehicleId: string): StepNote["highlight"] {
  const strings = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  if (!isObj(raw)) return { selected: vehicleId, yieldTo: [], paths: [vehicleId], signs: [] };
  return {
    selected: typeof raw.selected === "string" ? raw.selected : vehicleId,
    yieldTo: strings(raw.yieldTo),
    paths: strings(raw.paths),
    signs: strings(raw.signs),
  };
}
