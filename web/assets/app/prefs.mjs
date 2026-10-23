/** Colour theme (browser preference in localStorage). */
import { KEYS } from "../domain/registry.mjs";

export function applyTheme() {
  const t = localStorage.getItem(KEYS.theme) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = t;
  return t;
}

export function toggleTheme() {
  localStorage.setItem(KEYS.theme, document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  return applyTheme();
}
