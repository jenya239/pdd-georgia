/** Page script: norm/<slug>.html — a permanent page of one norm (static HTML; this adds the header and «copy link»). */
import { header } from "../app/layout.mjs";
import { toast } from "../app/dom.mjs";

header("law");
const btn = document.getElementById("copylink");
if (btn) btn.onclick = async () => {
  const url = location.href.split(/[?#]/)[0];
  try { await navigator.clipboard.writeText(url); toast("Ссылка скопирована: " + url); }
  catch { toast(url); }
};
