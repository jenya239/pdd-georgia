/** Page script: norm/index.html — filter the list of all norms. */
import { header } from "../app/layout.mjs";
import { plural } from "../app/dom.mjs";
import { normMatches } from "../domain/normlinks.mjs";

header("law");
const input = document.getElementById("nq"), count = document.getElementById("ncount");
const rows = [...document.querySelectorAll("ul.nindex li")].map(li => {
  const a = li.querySelector("a");
  return { li, label: a.textContent, text: li.textContent.slice(a.textContent.length) + " " + li.dataset.id };
});
function apply() {
  const q = input.value;
  let n = 0;
  for (const r of rows) { const on = normMatches(q, r.label, r.text); r.li.hidden = !on; n += on; }
  count.textContent = q.trim() ? `${n} ${plural(n, ["норма", "нормы", "норм"])}` : `всего ${rows.length}`;
  document.querySelectorAll("ul.nindex").forEach(ul => { ul.previousElementSibling.hidden = q.trim() && !ul.querySelector("li:not([hidden])"); });
}
const q0 = new URLSearchParams(location.search).get("q");
if (q0) input.value = q0;
input.addEventListener("input", apply);
apply();
