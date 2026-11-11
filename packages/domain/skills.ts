/**
 * Pilot skills for ep03 and ep07. Item ids are the evidence; a skill id is not a ticket hash.
 * A follow-up is one clarifying question, not a diagnosis: the wrong option only points here.
 */
export type SkillRole = "recognize" | "apply" | "contrast" | "transfer";

export type PilotItem = { id: string; role: SkillRole; decisive?: boolean; facet?: string };

export type PilotSkill = {
  id: string;
  lessonId: string;
  title: string;
  norms: string[];
  /** Every named facet must appear among the independent answers before the skill is confirmed. */
  facets?: string[];
  items: PilotItem[];
};

export type FollowUp = {
  after: string;
  choice: number;
  probe: string;
  lessonId: string;
  heading: string;
  reason: "misconception-check";
  hypothesis: string[];
};

export const PILOT_SKILLS: PilotSkill[] = [
  {
    id: "yard-exit",
    lessonId: "ep03",
    title: "Выезд с прилегающей территории",
    norms: ["5.13", "36.7"],
    items: [
      { id: "o-ep03-07", role: "recognize" },
      { id: "o-ep03-01", role: "apply", decisive: true },
      { id: "o-ep03-02", role: "contrast" },
    ],
  },
  {
    id: "main-road",
    lessonId: "ep03",
    title: "Чем задана главная дорога",
    norms: ["36.4", "36.6", "36.8"],
    facets: ["sign", "surface"],
    items: [
      { id: "o-ep03-02", role: "apply" },
      { id: "o-ep03-03", role: "contrast", decisive: true, facet: "surface" },
      { id: "o-ep03-04", role: "contrast", decisive: true, facet: "sign" },
      { id: "o-ep03-05", role: "transfer", decisive: true, facet: "surface" },
      { id: "o-ep03-06", role: "transfer" },
    ],
  },
  {
    id: "stop-name",
    lessonId: "ep07",
    title: "Имя перерыва в движении",
    norms: ["5.11", "5.20", "5.26", "25.6"],
    items: [
      { id: "o-ep07-01", role: "recognize" },
      { id: "o-ep07-03", role: "apply" },
      { id: "o-ep07-04", role: "contrast", decisive: true },
      { id: "o-ep07-02", role: "apply" },
      { id: "o-ep07-06", role: "contrast", decisive: true },
      { id: "o-ep07-05", role: "transfer", decisive: true },
    ],
  },
];

export const FOLLOW_UPS: FollowUp[] = [
  {
    after: "o-ep03-01", choice: 0, probe: "o-ep03-07", lessonId: "ep03", heading: "yard",
    reason: "misconception-check", hypothesis: ["mc-yard-exit-priority"],
  },
  {
    after: "o-ep03-01", choice: 2, probe: "o-ep03-07", lessonId: "ep03", heading: "yard",
    reason: "misconception-check", hypothesis: ["mc-adjacent-is-intersection"],
  },
  {
    after: "o-ep07-03", choice: 1, probe: "o-ep07-04", lessonId: "ep07", heading: "korotko",
    reason: "misconception-check", hypothesis: ["mc-parking-is-stop"],
  },
  {
    after: "o-ep07-03", choice: 2, probe: "o-ep07-02", lessonId: "ep07", heading: "vynuzhdennaya",
    reason: "misconception-check", hypothesis: ["mc-forced-is-choice"],
  },
  {
    after: "o-ep07-02", choice: 0, probe: "o-ep07-06", lessonId: "ep07", heading: "vynuzhdennaya",
    reason: "misconception-check", hypothesis: ["mc-forced-is-choice"],
  },
  {
    after: "o-ep07-02", choice: 2, probe: "o-ep07-03", lessonId: "ep07", heading: "vynuzhdennaya",
    reason: "misconception-check", hypothesis: ["mc-forced-is-choice"],
  },
];

const ITEM_HEADING: Record<string, string> = {
  "o-ep03-01": "yard", "o-ep03-07": "yard", "o-ep03-02": "main", "o-ep03-03": "main",
  "o-ep03-04": "main", "o-ep03-05": "main", "o-ep03-06": "main",
  "o-ep07-03": "korotko", "o-ep07-04": "ostanovka", "o-ep07-01": "potok", "o-ep07-05": "potok",
  "o-ep07-02": "vynuzhdennaya", "o-ep07-06": "vynuzhdennaya",
};

type FollowAttempt = { l?: number; lc?: number; events?: { ok: 0 | 1; c?: number | null }[] };

function choiceOf(rec: FollowAttempt | undefined): number | undefined {
  if (!rec || rec.l !== 0) return undefined;
  const last = rec.events?.length ? rec.events[rec.events.length - 1] : undefined;
  if (last && last.ok === 0 && typeof last.c === "number") return last.c;
  return typeof rec.lc === "number" ? rec.lc : undefined;
}

/** Heading of the fragment that answers this miss. A mapped choice wins over the item's own section. */
export function lessonFocus(id: string | undefined, progress: Record<string, FollowAttempt | undefined> = {}): string | undefined {
  if (!id) return undefined;
  const row = FOLLOW_UPS.find(item => item.after === id && item.choice === choiceOf(progress[id]));
  return row?.heading || ITEM_HEADING[id];
}

/** One unanswered probe for this wrong option. `fromProbe` is the step just shown, not a guess from another miss. */
export function followUp(
  justId: string | undefined,
  progress: Record<string, FollowAttempt | undefined>,
  blocked: Set<string>,
  own: boolean,
  fromProbe = false,
): FollowUp | null {
  if (!own || !justId || fromProbe) return null;
  const choice = choiceOf(progress[justId]);
  if (choice == null) return null;
  const row = FOLLOW_UPS.find(item => item.after === justId && item.choice === choice);
  if (!row || progress[row.probe] || blocked.has(row.probe)) return null;
  return row;
}
