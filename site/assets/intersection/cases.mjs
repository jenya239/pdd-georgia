import { scenario } from "./model.mjs";
function equal(id, vehicles) {
    return scenario({ id, pattern: "equal", vehicles });
}
function mainNs(id, vehicles) {
    return scenario({ id, pattern: "main-ns", vehicles });
}
export const SOLVED_CASES = [
    {
        id: "opposite-straight",
        family: "equal-opposite",
        basis: "Встречные прямо на равнозначных дорогах разъезжаются правыми сторонами, пути не мешают друг другу.",
        scene: equal("opposite-straight", [
            { id: "1", from: "S", maneuver: "straight" },
            { id: "2", from: "N", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["1", "2"],
        waits: [],
    },
    {
        id: "yield-right",
        family: "equal-right",
        basis: "С юга и с востока прямо, пути пересекаются. Восток для южного автомобиля справа (ст. 36, п. 4 «в»).",
        scene: equal("yield-right", [
            { id: "1", from: "S", maneuver: "straight" },
            { id: "2", from: "E", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["2"],
        waits: [{ id: "1", norm: "st36-p4-v" }],
    },
    {
        id: "yield-from-left",
        family: "equal-right",
        basis: "С запада прямо для южного автомобиля слева. Ждёт западный: южный для него справа.",
        scene: equal("yield-from-left", [
            { id: "1", from: "S", maneuver: "straight" },
            { id: "2", from: "W", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["1"],
        waits: [{ id: "2", norm: "st36-p4-v" }],
    },
    {
        id: "left-oncoming",
        family: "equal-left",
        basis: "Поворот налево с юга пересекает встречного, идущего прямо (ст. 36, п. 4 «г»). Встречный не стоит справа.",
        scene: equal("left-oncoming", [
            { id: "1", from: "S", maneuver: "left" },
            { id: "2", from: "N", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["2"],
        waits: [{ id: "1", norm: "st36-p4-g" }],
    },
    {
        id: "left-oncoming-right",
        family: "equal-left",
        basis: "Левый поворот уступает встречному, который сворачивает направо: оба выходят на одну сторону.",
        scene: equal("left-oncoming-right", [
            { id: "1", from: "S", maneuver: "left" },
            { id: "2", from: "N", maneuver: "right" },
        ]),
        status: "ready",
        admissible: ["2"],
        waits: [{ id: "1", norm: "st36-p4-g" }],
    },
    {
        id: "dual-left",
        family: "equal-left-clear",
        basis: "Оба поворачивают налево. Правило про встречного прямо и направо их не связывает, а пути в модели не сходятся.",
        scene: equal("dual-left", [
            { id: "1", from: "S", maneuver: "left" },
            { id: "2", from: "N", maneuver: "left" },
        ]),
        status: "ready",
        admissible: ["1", "2"],
        waits: [],
    },
    {
        id: "right-clear",
        family: "equal-clear",
        basis: "Правый поворот с юга не пересекает прямую с востока. Обязанность уступить тому, кто справа, не срабатывает: помехи нет (ст. 5, п. 14).",
        scene: equal("right-clear", [
            { id: "1", from: "S", maneuver: "right" },
            { id: "2", from: "E", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["1", "2"],
        waits: [],
    },
    {
        id: "right-merge",
        family: "equal-right",
        basis: "Правый поворот с юга выезжает на ту же полосу, куда с запада едут прямо. Ждёт западный автомобиль: южный для него справа.",
        scene: equal("right-merge", [
            { id: "1", from: "S", maneuver: "right" },
            { id: "2", from: "W", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["1"],
        waits: [{ id: "2", norm: "st36-p4-v" }],
    },
    {
        id: "main-cross",
        family: "main-yield",
        basis: "Север–юг главная, восток второстепенная, оба прямо. Второстепенная уступает независимо от стороны (ст. 36, п. 4 «а»).",
        scene: mainNs("main-cross", [
            { id: "1", from: "S", maneuver: "straight" },
            { id: "2", from: "E", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["1"],
        waits: [{ id: "2", norm: "st36-p4-a" }],
    },
    {
        id: "main-from-left",
        family: "main-yield",
        basis: "Второстепенная слева всё равно ждёт главную. Помеха справа эту пару не переворачивает.",
        scene: mainNs("main-from-left", [
            { id: "1", from: "S", maneuver: "straight" },
            { id: "2", from: "W", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["1"],
        waits: [{ id: "2", norm: "st36-p4-a" }],
    },
    {
        id: "main-clear",
        family: "main-clear",
        basis: "Правый поворот с главной не пересекает прямую по второстепенной с востока. Оба могут ехать: уступать некому мешать.",
        scene: mainNs("main-clear", [
            { id: "1", from: "S", maneuver: "right" },
            { id: "2", from: "E", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["1", "2"],
        waits: [],
    },
    {
        id: "main-opposite",
        family: "main-same",
        basis: "Оба на главной и едут прямо навстречу. Знак между ними очередь не строит, пути не сходятся.",
        scene: mainNs("main-opposite", [
            { id: "1", from: "S", maneuver: "straight" },
            { id: "2", from: "N", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["1", "2"],
        waits: [],
    },
    {
        id: "main-left",
        family: "main-left",
        basis: "Оба на главной, южный поворачивает налево через встречного прямо. Приоритет внутри главной одинаковый, левый поворот пропускает встречного.",
        scene: mainNs("main-left", [
            { id: "1", from: "S", maneuver: "left" },
            { id: "2", from: "N", maneuver: "straight" },
        ]),
        status: "ready",
        admissible: ["2"],
        waits: [{ id: "1", norm: "st36-p4-g" }],
    },
];
export const EDGE_CASES = [
    {
        id: "four-straight-cycle",
        family: "cycle",
        basis: "Четыре прямых: каждый видит кого-то справа, пути с ним пересекаются. Цикл обязанностей. Номер автомобиля очередь не назначает.",
        scene: equal("four-straight-cycle", [
            { id: "1", from: "S", maneuver: "straight" },
            { id: "2", from: "W", maneuver: "straight" },
            { id: "3", from: "N", maneuver: "straight" },
            { id: "4", from: "E", maneuver: "straight" },
        ]),
        status: "indeterminate",
        admissible: [],
        waits: [
            { id: "1", norm: "st36-p4-v" },
            { id: "2", norm: "st36-p4-v" },
            { id: "3", norm: "st36-p4-v" },
            { id: "4", norm: "st36-p4-v" },
        ],
    },
];
