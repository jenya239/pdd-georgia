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
            text: `${phrase(selected)}. Пути с другим автомобилем сходятся, а проверенные правила эту пару не выстраивают. Такой проезд не засчитывается: решатель не назначает приоритет наугад.`,
            assumption: "Если правило молчит, очередь можно додумать по номеру или по удобству.",
            decisive: "пробел правила",
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
            text: `${pair} Сейчас каждому есть кого пропустить, и правила не называют, кто едет первым. Номер на автомобиле эту очередь не создаёт.`,
            assumption: "Раз все стоят, первым едет автомобиль с меньшим номером.",
            decisive: "взаимные обязанности",
        };
    }
    if (relation.rule === "main") {
        return {
            text: `${pair} Автомобиль ${selected.id} на второстепенной дороге, автомобиль ${other.id} — на главной, и их пути пересекаются. Сначала едет тот, кто на главной. С какой стороны подъехал автомобиль ${other.id}, здесь не определяет очередность.`,
            assumption: "И при знаке главной дороги первым едет тот, кто справа.",
            decisive: "знак главной дороги",
        };
    }
    if (relation.rule === "left") {
        const how = other.maneuver === "right" ? "направо" : "прямо";
        return {
            text: `${pair} Автомобиль ${selected.id} поворачивает налево и пересекает путь встречного автомобиля ${other.id}, который едет ${how}. На дорогах одного приоритета левый поворот пропускает такого встречного. То, что он не стоит справа, эту обязанность не отменяет.`,
            assumption: "Налево можно ехать вместе со встречным, если тот не приближается справа.",
            decisive: "встречное направление",
        };
    }
    if (relation.rule === "right") {
        return {
            text: `${pair} Дороги равнозначные, знаков приоритета нет, и пути пересекаются. Автомобиль ${other.id} приближается справа, поэтому автомобиль ${selected.id} его пропускает. Сторона «слева» сама по себе никому не даёт проезда.`,
            assumption: "На равнозначном перекрёстке уступает тот, кто слева, или очередь вообще не зависит от стороны.",
            decisive: "автомобиль справа",
        };
    }
    return {
        text: `${pair} Очерёдность здесь держит общее правило: если пути пересеклись, а более частное правило их не развело, пропускают того, кто приближается справа.`,
        assumption: "Пересечение путей само назначает, кто важнее, без правила о правой стороне.",
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
        return "Оба могли ехать сейчас: пути не сходятся, поэтому обязанность пропустить того, кто справа, не сработала. Она появилась бы, если бы пути пересеклись.";
    }
    if (latent.rule === "main") {
        return "Оба могли ехать сейчас. Второстепенная дорога уступает главной, только когда пути мешают друг другу. Здесь они не мешают.";
    }
    if (latent.rule === "left") {
        return "Оба могли ехать сейчас: левый поворот не пересёк путь встречного, и ждать было некого.";
    }
    return null;
}
