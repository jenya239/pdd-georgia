/** Small DOM / text helpers shared by the pages. */
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const plural = (n, f) => {
  const m10 = n % 10, m100 = n % 100;
  return f[(m10 === 1 && m100 !== 11) ? 0 : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 1 : 2];
};
export const nq = n => n + " " + plural(n, ["вопрос", "вопроса", "вопросов"]);
