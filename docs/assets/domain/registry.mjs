/**
 * The single registry of everything the site keeps in the browser (localStorage).
 * Every key the code reads or writes must be listed here (tests/js/registry.test.mjs enforces it),
 * so the progress file (bundle.mjs) always carries the learner's whole state.
 */
export const SCHEMA_VERSION = 3;   // progress-file schema; bump together with a migration in bundle.mjs
export const APP_VERSION = "0.7";  // site version written into exported files (lessons 1–6, norm pages)

export const STORAGE = [
  { id: "progress", key: "pddge.progress.v1", kind: "json",
    what: "ответы на билеты и наши вопросы: попытки, серия верных (освоение и «работа над ошибками»), выбранные неверные варианты, история последних 50 ответов (когда, какой вариант, где)" },
  { id: "runs", key: "pddge.runs.v1", kind: "json", what: "история завершённых накопительных проверок" },
  { id: "active", key: "pddge.cumrun.v1", kind: "json", what: "незавершённые накопительные проверки (для продолжения)" },
  { id: "settings", key: "pddge.settings.v1", kind: "json", what: "настройки: порядок вопросов в проверке, включать наши вопросы, последняя открытая вкладка под ответом" },
  { id: "exams", key: "pddge.exams.v1", kind: "json", what: "история пробных экзаменов" },
  { id: "theme", key: "pddge.theme", kind: "text", what: "светлая или тёмная тема" },
  { id: "notes", key: "pddge.notes.v1", kind: "json", what: "ваши заметки к билетам и нашим вопросам" },
];

/** Keys older versions wrote; the store deletes them on open, imports ignore their sections. */
export const RETIRED = [
  { id: "lang", key: "pddge.lang", why: "глобальный выбор языка вопросов убран в 0.7 (у билета — переключатель «оригинал (KA)»)" },
];

export const KEYS = Object.fromEntries(STORAGE.map(s => [s.id, s.key]));
