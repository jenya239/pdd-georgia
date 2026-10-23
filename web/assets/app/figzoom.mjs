/** Wide lesson figures: a scroll hint when a figure is cut off, and a fullscreen view fitted to the screen. */
import { FIG_HINT, fitBox, overflowsX } from "../domain/figview.mjs";

function openFull(fig, opener) {
  const svg = fig.querySelector("svg"), vb = svg.viewBox && svg.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
  const h = vb && vb.height ? vb.height : svg.getBoundingClientRect().height;
  const cap = fig.querySelector("figcaption");
  const modal = document.createElement("div");
  modal.className = "figmodal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", cap ? cap.textContent : "Схема");
  modal.innerHTML = `<div class="figbar"><button type="button" class="figclose">Закрыть ✕</button></div><figure class="fig"></figure>`;
  const box = modal.querySelector("figure"), size = fitBox(w, h, innerWidth, innerHeight);
  box.append(svg.cloneNode(true));
  box.style.width = size.width + "px";
  box.style.height = size.height + "px";
  modal.querySelector(".figbar").style.width = size.width + "px";
  const close = () => {
    modal.remove(); document.body.classList.remove("figopen");
    document.removeEventListener("keydown", onKey); opener.focus();
  };
  const onKey = e => { if (e.key === "Escape") close(); };
  modal.addEventListener("click", e => { if (e.target === modal || e.target.closest(".figclose")) close(); });
  document.addEventListener("keydown", onKey);
  document.body.append(modal);
  document.body.classList.add("figopen");
  modal.querySelector(".figclose").focus();
}

export function enhanceFigures(root) {
  const figs = [...root.querySelectorAll("figure.fig")].filter(f => f.querySelector("svg"));
  const hints = figs.map(fig => {
    const hint = document.createElement("p");
    hint.className = "fighint";
    hint.hidden = true;
    hint.innerHTML = `<span></span><button type="button">⤢ Во весь экран</button>`;
    hint.querySelector("span").textContent = FIG_HINT;
    hint.querySelector("button").onclick = e => openFull(fig, e.currentTarget);
    fig.after(hint);
    return [fig, hint];
  });
  const update = () => hints.forEach(([fig, hint]) => { hint.hidden = !overflowsX(fig.scrollWidth, fig.clientWidth); });
  update();
  addEventListener("resize", update);
}
