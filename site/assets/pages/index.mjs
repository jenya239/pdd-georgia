/** Page script: index.html. One next step, not a catalog of lessons. */
import { loadEpisodes } from "../app/data.mjs";
import { $, esc } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
import { store } from "../app/progress.mjs";
import { knowledgeLine, nextFlowItem } from "../domain/flow.mjs";

const KICK = {
  theory: "Следующий материал · объяснение",
  question: "Следующий материал · ситуация",
  review: "Следующий материал · повтор ошибки",
};

header("home");
const [E, st] = await Promise.all([loadEpisodes(), store]);
const own = st.settings().own !== false;
const progress = st.progress();
const step = nextFlowItem(E.released, progress, { mode: st.settings().flow, own });
$("#know").textContent = knowledgeLine(E.released, progress, { own });
const now = document.createElement("section");
now.id = "now";
if (!step) {
  now.textContent = "Выпусков пока нет.";
} else {
  const blurb = step.kind === "theory"
    ? (step.lead || "Короткое объяснение этого выпуска.")
    : (step.kind === "review" ? "Вопрос, в прошлый раз решённый неверно." : "Один вопрос по этому выпуску.");
  now.innerHTML = `<p class="kicker">${KICK[step.kind]}</p><h2>${esc(step.title)}</h2><p class="deck">${esc(blurb)}</p>
    <p><a class="btn" href="flow.html">Продолжить поток</a></p>`;
}
$("#know").before(now);
