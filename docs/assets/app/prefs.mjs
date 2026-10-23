/** Interface language and colour theme (browser preferences in localStorage). */
import { KEYS } from "../domain/registry.mjs";
export const LANGS = { ru: "RU", ka: "KA", en: "EN" };

export const getLang = () => localStorage.getItem(KEYS.lang) || "ru";

/** Changes the question language and notifies the page via the "pdd:lang" event. */
export function setLang(l) {
  localStorage.setItem(KEYS.lang, l);
  document.dispatchEvent(new CustomEvent("pdd:lang", { detail: l }));
}

export function applyTheme() {
  const t = localStorage.getItem(KEYS.theme) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = t;
  return t;
}

export function toggleTheme() {
  localStorage.setItem(KEYS.theme, document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  return applyTheme();
}
