/**
 * Russian sentences built only from a decision's structured reasons.
 * No model writes them at play time.
 */
import type { Dir, Scenario, Vehicle } from "./model.ts";
import { DIR_FROM, MANEUVER_WORD } from "./model.ts";
import type { Decision, Relation } from "./solver.ts";
import { blocking } from "./solver.ts";

export interface Explanation {
  text: string;
  assumption: string;
  decisive: string;
  norms: { id: string; label: string }[];
  tone: "ok" | "bad";
  highlight: {
    selected: string;
    yieldTo: string[];
    paths: string[];
    signs: Dir[];
  };
}

const LABEL: Record<string, string> = {
  "st5-p14": "ст. 5, п. 14",
  "st32-p12": "ст. 32, п. 12",
  "st36-p4-a": "ст. 36, п. 4 «а»",
  "st36-p4-v": "ст. 36, п. 4 «в»",
  "st36-p4-g": "ст. 36, п. 4 «г»",
  "sign-2.1": "знак 2.1",
  "sign-2.3": "знак 2.3",
};

function vehicleById(scenario: Scenario, id: string): Vehicle {
  const found = scenario.vehicles.find((item) => item.id === id);
  if (!found) throw new Error(`missing vehicle ${id}`);
  return found;
}

function phrase(vehicle: Vehicle): string {
  return `Автомобиль ${vehicle.id} едет ${DIR_FROM[vehicle.from]} ${MANEUVER_WORD[vehicle.maneuver]}`;
}

function normsOf(relation: Relation): { id: string; label: string }[] {
  return relation.norms.map((id) => ({ id, label: LABEL[id] ?? id }));
}

function signsFor(scenario: Scenario, relation: Relation, selected: Vehicle): Dir[] {
  if (relation.rule !== "main") return [];
  const mains = scenario.approaches.filter((arm) => arm.sign === "main").map((arm) => arm.id);
  return [...mains, selected.from];
}

export function explainWrong(scenario: Scenario, decision: Decision, selectedId: string): Explanation | null {
  if (decision.admissible.includes(selectedId)) return null;
  const relation = blocking(decision, selectedId);
  const selected = vehicleById(scenario, selectedId);
  if (!relation) {
    return {
      text: `Здесь правила не дают однозначной очередности. Не будем угадывать, кто должен ехать первым.`,
      assumption: "Номер автомобиля не определяет преимущество.",
      decisive: "неоднозначная ситуация",
      norms: [{ id: "st32-p12", label: LABEL["st32-p12"] }],
      tone: "bad",
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
    tone: "bad",
    highlight: {
      selected: selectedId,
      yieldTo: [other.id],
      paths: [selected.id, other.id],
      signs: signsFor(scenario, relation, selected),
    },
  };
}

function paragraph(
  scenario: Scenario,
  decision: Decision,
  relation: Relation,
  selected: Vehicle,
  other: Vehicle,
): { text: string; assumption: string; decisive: string } {
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

/** Why an admissible vehicle may go, from the same relations as a wrong answer. */
export function explainRight(scenario: Scenario, decision: Decision, selectedId: string): Explanation | null {
  if (!decision.admissible.includes(selectedId)) return null;
  const selected = vehicleById(scenario, selectedId);
  const owed = decision.relations.find((item) => item.to === selectedId && item.effect === "yield");
  if (owed) {
    const other = vehicleById(scenario, owed.from);
    const body = rightYield(owed, selected, other);
    return {
      text: body.text,
      assumption: body.assumption,
      decisive: body.decisive,
      norms: normsOf(owed),
      tone: "ok",
      highlight: {
        selected: selected.id,
        yieldTo: [other.id],
        paths: [selected.id, other.id],
        signs: owed.rule === "main" ? [selected.from, other.from] : [],
      },
    };
  }
  const latent = decision.relations.find((item) =>
    item.effect === "latent" && (item.from === selectedId || item.to === selectedId));
  if (latent) {
    const other = vehicleById(scenario, latent.from === selectedId ? latent.to : latent.from);
    return {
      text: clearText(latent, selected, other),
      assumption: "Если пути не мешают, обязанность уступить не срабатывает.",
      decisive: latent.rule === "main" ? "знак главной дороги" : "пути не мешают",
      norms: normsOf(latent),
      tone: "ok",
      highlight: {
        selected: selected.id,
        yieldTo: [],
        paths: [selected.id, other.id],
        signs: latent.rule === "main" ? [selected.from, other.from] : [],
      },
    };
  }
  const present = new Set(decision.admissible);
  for (const relation of decision.relations) {
    present.add(relation.from);
    present.add(relation.to);
  }
  const other = scenario.vehicles.find((item) => item.id !== selectedId && present.has(item.id));
  const text = other
    ? `Автомобиль ${selected.id} может ехать: его путь не мешает автомобилю ${other.id}.`
    : `Автомобиль ${selected.id} может ехать: на перекрёстке не осталось автомобиля, который ему мешает.`;
  return {
    text,
    assumption: "Очередь появляется только там, где пути мешают и правило это подтверждает.",
    decisive: "пути не мешают",
    norms: [],
    tone: "ok",
    highlight: {
      selected: selected.id,
      yieldTo: [],
      paths: other ? [selected.id, other.id] : [selected.id],
      signs: [],
    },
  };
}

function rightYield(relation: Relation, selected: Vehicle, other: Vehicle): { text: string; assumption: string; decisive: string } {
  if (relation.rule === "main") {
    return {
      text: `Автомобиль ${selected.id} едет по главной, а ${other.id} — по второстепенной. Пути пересекаются, поэтому сначала может ехать ${selected.id}.`,
      assumption: "Знак главной важнее того, кто оказался справа.",
      decisive: "знак главной дороги",
    };
  }
  if (relation.rule === "left") {
    const how = selected.maneuver === "right" ? "направо" : "прямо";
    return {
      text: `Автомобиль ${other.id} поворачивает налево и должен уступить встречному автомобилю ${selected.id}, который едет ${how}. Поэтому сейчас может ехать ${selected.id}.`,
      assumption: "При левом повороте встречный проезжает первым, даже если он не справа.",
      decisive: "встречное направление",
    };
  }
  if (relation.rule === "right") {
    return {
      text: `Автомобиль ${selected.id} приближается справа от автомобиля ${other.id}. На равнозначных дорогах ${other.id} уступает, поэтому ехать может ${selected.id}.`,
      assumption: "На равнозначных дорогах сначала едет тот, кто справа.",
      decisive: "автомобиль справа",
    };
  }
  return {
    text: `Автомобиль ${selected.id} приближается справа от автомобиля ${other.id}. Другие правила эту пару не выстраивают, поэтому уступает ${other.id}.`,
    assumption: "Когда частное правило молчит, остаётся общая обязанность уступить тому, кто справа.",
    decisive: "автомобиль справа",
  };
}

function clearText(relation: Relation, selected: Vehicle, other: Vehicle): string {
  if (relation.rule === "main") {
    return `Автомобиль ${selected.id} может ехать вместе с автомобилем ${other.id}: пути не пересекаются, и второстепенная здесь никому не мешает.`;
  }
  if (relation.rule === "right") {
    return `Автомобиль ${selected.id} может ехать вместе с автомобилем ${other.id}: пути не пересекаются, помехи справа нет.`;
  }
  return `Автомобиль ${selected.id} может ехать вместе с автомобилем ${other.id}: их пути не пересекаются.`;
}

/** One sentence after a scene where nobody had to wait because the paths miss each other. */
export function closingNote(decision: Decision): string | null {
  const yields = decision.relations.some((item) => item.effect === "yield");
  const latent = decision.relations.find((item) => item.effect === "latent");
  if (yields || !latent) return null;
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
