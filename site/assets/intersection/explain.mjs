import { DIR_FROM, MANEUVER_WORD } from "./model.mjs";
import { blocking } from "./solver.mjs";
const LABEL = {
    "st5-p14": "ст. 5, п. 14",
    "st32-p12": "ст. 32, п. 12",
    "st36-p4-a": "ст. 36, п. 4 «а»",
    "st36-p4-v": "ст. 36, п. 4 «в»",
    "st36-p4-g": "ст. 36, п. 4 «г»",
    "sign-2.1": "знак 2.1",
    "sign-2.3": "знак 2.3",
};
function vehicleById(scenario, id) {
    const found = scenario.vehicles.find((item) => item.id === id);
    if (!found)
        throw new Error(`missing vehicle ${id}`);
    return found;
}
function phrase(vehicle) {
    return `Автомобиль ${vehicle.id} едет ${DIR_FROM[vehicle.from]} ${MANEUVER_WORD[vehicle.maneuver]}`;
}
function normsOf(relation) {
    return relation.norms.map((id) => ({ id, label: LABEL[id] ?? id }));
}
function signsFor(scenario, relation, selected) {
    if (relation.rule !== "main")
        return [];
    const mains = scenario.approaches.filter((arm) => arm.sign === "main").map((arm) => arm.id);
    return [...mains, selected.from];
}
export function explainWrong(scenario, decision, selectedId) {
    if (decision.admissible.includes(selectedId))
        return null;
    const relation = blocking(decision, selectedId);
    const selected = vehicleById(scenario, selectedId);
    if (!relation) {
        return {
            text: `Здесь правила не дают однозначной очередности. Не будем угадывать, кто должен ехать первым.`,
            assumption: "Номер автомобиля не определяет преимущество.",
            decisive: "неоднозначная ситуация",
            norms: [{ id: "st32-p12", label: LABEL["st32-p12"] }],
            highlight: { selected: selectedId, yieldTo: [], paths: scenario.vehicles.map((item) => item.id), signs: [] },
        };
    }
    const other = vehicleById(scenario, relation.to);
    const body = paragraph(scenario, decision, relation, selected, other);
    return {
        text: body.text,
        assumption: body.assumption,
        decisive: body.decisive,
        norms: normsOf(relation),
        highlight: {
            selected: selectedId,
            yieldTo: [other.id],
            paths: [selected.id, other.id],
            signs: signsFor(scenario, relation, selected),
        },
    };
}
function paragraph(scenario, decision, relation, selected, other) {
    const pair = `${phrase(selected)}. ${phrase(other)}.`;
    if (decision.status === "indeterminate" && decision.admissible.length === 0) {
        return {
            text: `${pair} Каждый должен уступить другому участнику. Правила не устанавливают единственного первого: водителям придётся согласовать движение.`,
            assumption: "Номер автомобиля здесь ничего не решает.",
            decisive: "взаимные обязанности",
        };
    }
    if (relation.rule === "main") {
        return {
            text: `Автомобиль ${selected.id} подъезжает по второстепенной дороге, а ${other.id} — по главной. Поэтому ${selected.id} должен уступить ${other.id}.`,
            assumption: "Здесь важны знаки приоритета, а не расположение машин справа и слева.",
            decisive: "знак главной дороги",
        };
    }
    if (relation.rule === "left") {
        const how = other.maneuver === "right" ? "направо" : "прямо";
        return {
            text: `Автомобиль ${selected.id} поворачивает налево и должен уступить встречному автомобилю ${other.id}, который едет ${how}.`,
            assumption: "При левом повороте нужно учитывать встречных, даже если они не справа.",
            decisive: "встречное направление",
        };
    }
    if (relation.rule === "right") {
        return {
            text: `Автомобиль ${other.id} приближается справа от автомобиля ${selected.id}. На равнозначных дорогах ${selected.id} должен уступить ему.`,
            assumption: "На равнозначных дорогах нужно проверить, кто приближается справа.",
            decisive: "автомобиль справа",
        };
    }
    return {
        text: `Автомобиль ${other.id} приближается справа от автомобиля ${selected.id}. Когда другие правила не определяют приоритет, ${selected.id} должен уступить ему.`,
        assumption: "Одного пересечения траекторий недостаточно: важно, какое правило действует.",
        decisive: "автомобиль справа",
    };
}
/** One sentence after a scene where nobody had to wait because the paths miss each other. */
export function closingNote(decision) {
    const yields = decision.relations.some((item) => item.effect === "yield");
    const latent = decision.relations.find((item) => item.effect === "latent");
    if (yields || !latent)
        return null;
    if (latent.rule === "right") {
        return "Оба автомобиля могли проехать: их траектории не мешают друг другу. Помехи справа в этой ситуации нет.";
    }
    if (latent.rule === "main") {
        return "Оба автомобиля могли проехать: хотя один подъехал по второстепенной дороге, они не мешают друг другу.";
    }
    if (latent.rule === "left") {
        return "Оба автомобиля могли проехать: их траектории в этой ситуации не пересекаются.";
    }
    return null;
}
