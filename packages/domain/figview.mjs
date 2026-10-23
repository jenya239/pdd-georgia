/** Wide lesson figures on small screens (pure helpers). */
export const FIG_HINT = "↔ Схема шире экрана — листайте вбок или откройте во весь экран";

const PAD = 16;   // margin around the fullscreen figure, px per side
const BAR = 48;   // height of the close bar in the fullscreen view, px
const MAX_SCALE = 2;

/** True when content is wider than its box (1–2 px of rounding is ignored). */
export const overflowsX = (scrollWidth, clientWidth) => scrollWidth - clientWidth > 1;

/** Size of a w×h figure fitted into a vw×vh screen, keeping the aspect ratio. */
export function fitBox(w, h, vw, vh) {
  const scale = Math.min((vw - 2 * PAD) / w, (vh - 2 * PAD - BAR) / h, MAX_SCALE);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
