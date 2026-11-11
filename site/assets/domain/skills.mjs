export const PILOT_SKILLS = [
    {
        id: "yard-exit",
        lessonId: "ep03",
        title: "Выезд с прилегающей территории",
        norms: ["5.13", "36.7"],
        items: [
            { id: "o-ep03-07", role: "recognize" },
            { id: "o-ep03-01", role: "apply" },
            { id: "o-ep03-02", role: "contrast" },
        ],
    },
    {
        id: "main-road",
        lessonId: "ep03",
        title: "Чем задана главная дорога",
        norms: ["36.4", "36.6", "36.8"],
        items: [
            { id: "o-ep03-02", role: "apply" },
            { id: "o-ep03-03", role: "contrast" },
            { id: "o-ep03-04", role: "contrast" },
            { id: "o-ep03-05", role: "transfer" },
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
            { id: "o-ep07-04", role: "contrast" },
            { id: "o-ep07-02", role: "apply" },
            { id: "o-ep07-06", role: "contrast" },
            { id: "o-ep07-05", role: "transfer" },
        ],
    },
];
export const FOLLOW_UPS = [
    {
        after: "o-ep03-01",
        probe: "o-ep03-07",
        lessonId: "ep03",
        reason: "misconception-check",
        hypothesis: ["mc-yard-exit-priority", "mc-adjacent-is-intersection"],
    },
    {
        after: "o-ep07-03",
        probe: "o-ep07-04",
        lessonId: "ep07",
        reason: "misconception-check",
        hypothesis: ["mc-parking-is-stop"],
    },
    {
        after: "o-ep07-02",
        probe: "o-ep07-06",
        lessonId: "ep07",
        reason: "misconception-check",
        hypothesis: ["mc-forced-is-choice"],
    },
];
const PROBE_IDS = new Set(FOLLOW_UPS.map(item => item.probe));
/** One unanswered probe after a mapped miss. A probe is never followed by another probe. */
export function followUp(justId, progress, blocked, own) {
    if (!own || !justId || PROBE_IDS.has(justId))
        return null;
    if (progress[justId]?.l !== 0)
        return null;
    const row = FOLLOW_UPS.find(item => item.after === justId);
    if (!row || progress[row.probe] || blocked.has(row.probe))
        return null;
    return row;
}
