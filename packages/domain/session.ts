export const STUDY_KINDS = ["theory", "practice", "review", "breakdown", "variation"] as const;

export type StudyKind = (typeof STUDY_KINDS)[number];

export type StudyStep = { kind: StudyKind; ref: string };

export type Study = {
  id: string;
  lesson: string;
  steps: StudyStep[];
  cursor: number;
};

export type StudyTicket = { id: string; mastered: boolean; lastWrong: boolean };

const ORDER = STUDY_KINDS;

function byRef(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

function take(buckets: Record<StudyKind, string[]>): StudyStep[] {
  const steps: StudyStep[] = [];
  let pending = true;
  while (pending) {
    pending = false;
    for (const kind of ORDER) {
      const ref = buckets[kind].shift();
      if (ref === undefined) continue;
      steps.push({ kind, ref });
      pending = true;
    }
  }
  return steps;
}

export function planStudy(input: {
  id: string;
  lesson: string;
  theory?: string[];
  practice?: string[];
  review?: string[];
  breakdown?: string[];
  variation?: string[];
}): Study {
  const buckets = Object.fromEntries(ORDER.map((kind) => [kind, [...(input[kind] ?? [])]])) as Record<StudyKind, string[]>;
  return { id: input.id, lesson: input.lesson, steps: take(buckets), cursor: 0 };
}

export function studyFor(input: {
  id: string;
  lesson: string;
  tickets: StudyTicket[];
  theory?: string[];
  breakdown?: string[];
  variation?: string[];
}): Study {
  const review = input.tickets.filter((ticket) => ticket.lastWrong).map((ticket) => ticket.id).sort(byRef);
  const practice = input.tickets.filter((ticket) => !ticket.mastered && !ticket.lastWrong).map((ticket) => ticket.id).sort(byRef);
  return planStudy({
    id: input.id,
    lesson: input.lesson,
    theory: input.theory,
    practice,
    review,
    breakdown: input.breakdown,
    variation: input.variation,
  });
}

export function currentStep(study: Study): StudyStep | null {
  return study.steps[study.cursor] ?? null;
}

export function completeStep(study: Study): Study {
  if (study.cursor >= study.steps.length) return study;
  return { ...study, cursor: study.cursor + 1 };
}

export function studyLeft(study: Study): number {
  return Math.max(0, study.steps.length - study.cursor);
}
