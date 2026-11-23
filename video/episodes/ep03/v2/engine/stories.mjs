/** Timed states. Prototypes have no captions. Passage is refused on snow and on the bending main. */
import { PATCH_LEN } from "./model.mjs";

export function ease(u) {
  const x = Math.min(1, Math.max(0, u));
  return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2;
}

function stillCars() {
  return { blueAlong: 0, redAlong: 0, blueBrake: false, redBrake: false };
}

export const PROTO_A = {
  id: "A2-A3",
  fps: 24,
  duration: 22,
  stills: [
    { name: "01-a2-before", t: 1 },
    { name: "02-a2-yield", t: 3.6 },
    { name: "03-spread-mid", t: 8.5 },
    { name: "04-a3-yield", t: 18.5 },
  ],
};

export function prototypeAState(t) {
  const cars = stillCars();
  let pave = { type: "patch", length: PATCH_LEN };
  if (t >= 2 && t < 5.2) {
    cars.blueAlong = ease((t - 2) / 3.2);
    cars.redBrake = true;
  } else if (t >= 6.4 && t < 10.6) {
    pave = { type: "spread", u: ease((t - 6.4) / 4.2) };
  } else if (t >= 10.6 && t < 11.6) {
    pave = { type: "spread", u: 1 };
  } else if (t >= 11.6 && t < 15.6) {
    pave = { type: "spread", u: 1 };
    cars.redAlong = ease((t - 11.6) / 4);
    cars.blueBrake = true;
  } else if (t >= 15.6) {
    pave = { type: "spread", u: 1 };
    cars.redAlong = 1;
    cars.blueBrake = true;
  }
  const done = pave.type === "spread" && pave.u >= 0.999;
  return {
    scene: "junction", world: done ? "A3" : "A2", pave, cars, snow: 0, contrast: 1, overlays: [], t,
  };
}

export const PROTO_C = {
  id: "C1-C2",
  fps: 24,
  duration: 22,
  stills: [
    { name: "01-c1-yard", t: 1.2 },
    { name: "02-c1-yield", t: 4.4 },
    { name: "03-morph-mid", t: 7.8 },
    { name: "04-c2-yield", t: 18 },
  ],
};

export function prototypeCState(t) {
  const cars = stillCars();
  let yardU = 0;
  if (t >= 2.4 && t < 6) {
    cars.blueAlong = ease((t - 2.4) / 3.6);
    cars.redBrake = true;
  } else if (t >= 7 && t < 8.6) {
    yardU = ease((t - 7) / 1.6);
  } else if (t >= 8.6 && t < 11) {
    yardU = 1;
  } else if (t >= 11 && t < 15.2) {
    yardU = 1;
    cars.redAlong = ease((t - 11) / 4.2);
    cars.blueBrake = true;
  } else if (t >= 15.2) {
    yardU = 1;
    cars.redAlong = 1;
    cars.blueBrake = true;
  }
  return {
    scene: "yard",
    world: yardU >= 0.999 ? "C2" : "C1",
    yardU,
    cars,
    pedestrian: true,
    overlays: [],
    t,
  };
}

export function snowState() {
  return {
    scene: "junction", world: "A5", pave: { type: "dirt" }, snow: 1, contrast: 1,
    cars: stillCars(), overlays: ["Считай свою дорогу второстепенной"], t: 0,
  };
}

function clip(parts) {
  let cursor = 0;
  const beats = parts.map((part) => {
    const beat = { t0: cursor, t1: cursor + part.dur, at: part.at };
    cursor += part.dur;
    return beat;
  });
  return {
    fps: 24,
    duration: cursor,
    at(time) {
      const beat = beats.find((item) => time < item.t1) ?? beats[beats.length - 1];
      return beat.at(Math.min(beat.t1 - beat.t0, Math.max(0, time - beat.t0)), beat.t1 - beat.t0);
    },
  };
}

export function filmParts() {
  return [
    { dur: 16, at: (local) => ({
      scene: "junction", world: "A0", pave: { type: "dirt" }, snow: 0,
      contrast: local < 3 ? 0.35 : local < 7 ? 0.35 + 0.65 * ((local - 3) / 4) : 1,
      cars: stillCars(),
      overlays: local > 8 ? ["Красная — справа. Но этого недостаточно."] : [],
      t: local,
    }) },
    { dur: 18, at: (local) => {
      const cars = stillCars();
      if (local >= 7 && local < 11) {
        cars.blueAlong = ease((local - 7) / 4);
        cars.redBrake = true;
      } else if (local >= 11) {
        cars.blueAlong = 1;
        cars.redBrake = true;
      }
      return {
        scene: "junction", world: "A1", pave: { type: "dirt" }, contrast: 1, snow: 0, cars,
        legend: local >= 2 && local < 7,
        overlays: local >= 7 ? ["Красная уступает"] : [],
        t: local,
      };
    } },
    { dur: 16, at: (local) => {
      const cars = stillCars();
      const length = local < 1.3 ? (local / 1.3) * PATCH_LEN : PATCH_LEN;
      if (local >= 5 && local < 9) {
        cars.blueAlong = ease((local - 5) / 4);
        cars.redBrake = true;
      } else if (local >= 9) {
        cars.blueAlong = 1;
        cars.redBrake = true;
      }
      return {
        scene: "junction", world: "A2", pave: { type: "patch", length }, contrast: 1, snow: 0, cars,
        overlays: local >= 1.3 ? ["Короткий участок не меняет статус"] : [],
        t: local,
      };
    } },
    { dur: 18, at: (local) => {
      const cars = stillCars();
      let u = 1;
      if (local < 3.5) u = ease(local / 3.5);
      else if (local >= 5.5 && local < 11) {
        cars.redAlong = ease((local - 5.5) / 5.5);
        cars.blueBrake = true;
      } else if (local >= 11) {
        cars.redAlong = 1;
        cars.blueBrake = true;
      }
      return {
        scene: "junction", world: u >= 0.999 ? "A3" : "A2", pave: { type: "spread", u }, contrast: 1, snow: 0, cars,
        overlays: local >= 5.5 ? ["Синяя уступает"] : local >= 3.5 ? ["Обе дороги с твёрдым покрытием"] : [],
        t: local,
      };
    } },
    { dur: 20, at: (local) => {
      const cars = stillCars();
      const signs = local >= 5;
      const u = local < 2 ? 1 - ease(local / 2) : 0;
      if (local >= 8 && local < 13) {
        cars.redAlong = ease((local - 8) / 5);
        cars.blueBrake = true;
      } else if (local >= 13) {
        cars.redAlong = 1;
        cars.blueBrake = true;
      }
      return {
        scene: "junction", world: signs ? "A4" : "A1",
        pave: u <= 0.001 ? { type: "dirt" } : { type: "spread", u },
        signs: signs ? "a4" : "none", contrast: 1, snow: 0, cars,
        overlays: signs ? ["Знаки установили другой приоритет"] : [],
        t: local,
      };
    } },
    { dur: 16, at: (local) => {
      const snow = local < 3 ? 0 : local < 5 ? (local - 3) / 2 : 1;
      const signs = local < 2;
      return {
        scene: "junction", world: snow > 0.85 ? "A5" : "A4",
        pave: { type: "dirt" }, signs: signs ? "a4" : "none", snow, contrast: 1, cars: stillCars(),
        overlays: snow > 0.85 ? ["Покрытие не определить", "Не угадывай приоритет"] : [],
        t: local,
      };
    } },
    { dur: 16, at: (local) => ({
      scene: "bend", world: "B1", cars: stillCars(),
      overlays: ["Не определено"],
      t: local,
    }) },
    { dur: 16, at: (local) => {
      const cars = stillCars();
      if (local >= 4 && local < 9) {
        cars.blueAlong = ease((local - 4) / 5);
        cars.redBrake = true;
      } else if (local >= 9) {
        cars.blueAlong = 1;
        cars.redBrake = true;
      }
      return {
        scene: "yard", world: "C1", yardU: 0, pedestrian: true, cars,
        overlays: local >= 2 ? ["Это выезд с прилегающей территории"] : [],
        t: local,
      };
    } },
    { dur: 16, at: (local) => {
      const cars = stillCars();
      let yardU = 1;
      if (local < 1.6) yardU = ease(local / 1.6);
      else if (local >= 4 && local < 9) {
        cars.redAlong = ease((local - 4) / 5);
        cars.blueBrake = true;
      } else if (local >= 9) {
        cars.redAlong = 1;
        cars.blueBrake = true;
      }
      return {
        scene: "yard", world: yardU >= 0.999 ? "C2" : "C1", yardU, pedestrian: true, cars,
        overlays: local >= 1.6 ? ["Двор сменился сквозной дорогой"] : [],
        t: local,
      };
    } },
    { dur: 16, at: () => ({ scene: "stoppark", world: "C3", cars: stillCars(), overlays: [] }) },
    { dur: 18, at: (local) => ({
      scene: "case", world: "D1", cars: stillCars(),
      busAlong: local < 4 ? 0 : local < 8 ? ease((local - 4) / 4) : 1,
      overlays: [],
      t: local,
    }) },
    { dur: 20, at: (local) => {
      const flashes = [
        { scene: "junction", world: "A1", pave: { type: "dirt" } },
        { scene: "junction", world: "A2", pave: { type: "patch", length: PATCH_LEN } },
        { scene: "junction", world: "A3", pave: { type: "paved" } },
        { scene: "junction", world: "A4", pave: { type: "dirt" }, signs: "a4" },
        { scene: "junction", world: "A5", pave: { type: "dirt" }, snow: 1 },
        { scene: "yard", world: "C1", yardU: 0, pedestrian: true },
        { scene: "yard", world: "C2", yardU: 1, pedestrian: true },
      ];
      if (local < 8.05) {
        const index = Math.min(flashes.length - 1, Math.floor(local / 1.15));
        return { ...flashes[index], cars: stillCars(), contrast: 1, snow: flashes[index].snow ?? 0, overlays: [], t: local };
      }
      return { scene: "recap", world: "OUTRO", cars: stillCars(), overlays: [], t: local };
    } },
  ];
}

export function film() {
  return clip(filmParts());
}

function moveCars(who, u, enabled) {
  const cars = stillCars();
  if (!enabled) return cars;
  const along = u < 0.14 ? 0 : ease((u - 0.14) / 0.72);
  if (who === "blue") {
    cars.blueAlong = along;
    cars.redBrake = along > 0.02;
  } else {
    cars.redAlong = along;
    cars.blueBrake = along > 0.02;
  }
  return cars;
}

function directPrologue(id, u, inLead) {
  const cars = stillCars();
  if (inLead || !id || id === "S00.1") {
    const uu = inLead || !id ? 0 : u;
    let focus = "space";
    if (uu > 0.4) focus = "surface";
    if (uu > 0.6) focus = "sign";
    if (uu > 0.78) focus = "drive";
    return { scene: "prologue", phase: "road", u: uu, focus, morph: 0, carsIn: 0, cars, world: null };
  }
  if (id === "S00.2") {
    return { scene: "prologue", phase: "compare", u, focus: null, morph: 0, carsIn: 0, cars, world: null };
  }
  if (u < 0.14) {
    return {
      scene: "prologue", phase: "road", u: 1, focus: "space", morph: 0, carsIn: 0,
      leave: ease(u / 0.14), cars, world: null,
    };
  }
  const morph = u < 0.28 ? ease((u - 0.14) / 0.14) : 1;
  const carsIn = u < 0.3 ? 0 : ease(Math.min(1, (u - 0.3) / 0.22));
  return {
    scene: "prologue", phase: "arrive", u, focus: null, morph, carsIn, cars,
    world: "A0", pave: { type: "dirt" }, snow: 0, contrast: 1,
  };
}

/** Картинка обзорного ролика привязана к фразе, а не к старому немому хронометражу. */
export function directedState(index, speech = {}) {
  const inLead = !!speech.inLead;
  const u = inLead ? 0 : Math.min(1, Math.max(0, speech.u ?? 0));
  const id = speech.id ?? "";
  const last = !inLead && speech.count > 0 && speech.ordinal === speech.count - 1;
  if (index === 0) return directPrologue(id, u, inLead);
  if (index === 1) {
    return {
      scene: "junction", world: "A1", pave: { type: "dirt" }, snow: 0, contrast: 1,
      cars: moveCars("blue", u, last),
      legend: id === "S01.1" && u > 0.18 && u < 0.9,
      path: last ? [[-38, 0], [28, 0]] : null,
      pathU: last ? Math.min(1, u / 0.36) : 0,
      view: { scale: 1, cx: 960, cy: 540 },
    };
  }
  if (index === 2) {
    const cars = stillCars();
    let length = PATCH_LEN;
    let scale = 0.9;
    if (inLead || id === "S02.1") {
      const uu = inLead ? 0 : u;
      length = uu < 0.42 ? ease(uu / 0.42) * PATCH_LEN : PATCH_LEN;
      scale = uu < 0.42 ? 1.1 : 1.1 - 0.22 * ease((uu - 0.42) / 0.58);
    } else {
      Object.assign(cars, moveCars("blue", u, true));
    }
    return {
      scene: "junction", world: "A2", pave: { type: "patch", length }, snow: 0, contrast: 1, cars,
      path: id === "S02.2" ? [[-38, 0], [28, 0]] : null,
      pathU: id === "S02.2" ? Math.min(1, u / 0.36) : 0,
      view: { scale, cx: 960, cy: 520 },
    };
  }
  if (index === 3) {
    const cars = stillCars();
    let paveU = 1;
    if (inLead || id === "S03.1") {
      const uu = inLead ? 0 : u;
      paveU = uu < 0.12 ? 0 : ease(Math.min(1, (uu - 0.12) / 0.7));
    } else {
      const gated = u < 0.52 ? 0 : (u - 0.52) / 0.48;
      Object.assign(cars, moveCars("red", gated, true));
    }
    const done = paveU >= 0.999;
    return {
      scene: "junction", world: done ? "A3" : "A2",
      pave: { type: "spread", u: paveU }, snow: 0, contrast: 1, cars,
      path: id === "S03.2" ? [[0, -38], [0, 28]] : null,
      pathU: id === "S03.2" ? Math.min(1, u / 0.36) : 0,
      view: { scale: 1, cx: 960, cy: 540 },
    };
  }
  if (index === 4) {
    const cars = stillCars();
    let back = 0;
    let signs = true;
    if (inLead || id === "S04.1") {
      const uu = inLead ? 0 : u;
      back = uu < 0.42 ? 1 - ease(uu / 0.42) : 0;
      signs = uu > 0.62;
    } else Object.assign(cars, moveCars("red", u, true));
    return {
      scene: "junction", world: signs ? "A4" : "A1",
      pave: back <= 0.001 ? { type: "dirt" } : { type: "spread", u: back },
      signs: signs ? "a4" : "none", snow: 0, contrast: 1, cars,
      view: { scale: 1, cx: 960, cy: 540 },
    };
  }
  if (index === 5) {
    let signs = id === "S05.1" || inLead;
    let snow = 0;
    if (id === "S05.2") {
      signs = u < 0.22;
      snow = u < 0.28 ? 0 : ease(Math.min(1, (u - 0.28) / 0.55));
    } else if (id === "S05.3") {
      signs = false;
      snow = 1;
    }
    return {
      scene: "junction", world: snow > 0.85 ? "A5" : "A4",
      pave: { type: "dirt" }, signs: signs ? "a4" : "none", snow, contrast: 1, cars: stillCars(),
    };
  }
  if (index === 6) return { scene: "bend", world: "B1", cars: stillCars(), t: u };
  if (index === 7) {
    return {
      scene: "yard", world: "C1", yardU: 0, pedestrian: true,
      cars: moveCars("blue", u, last),
    };
  }
  if (index === 8) {
    const yardU = inLead || speech.ordinal === 0 ? (inLead ? 0 : ease(Math.min(1, u / 0.55))) : 1;
    return {
      scene: "yard", world: yardU >= 0.999 ? "C2" : "C1", yardU, pedestrian: true,
      cars: moveCars("red", u, last),
    };
  }
  if (index === 9) return { scene: "stoppark", world: "C3", cars: stillCars() };
  if (index === 10) {
    const busAlong = id === "S10.2" ? Math.min(0.62, ease(u) * 0.62) : id === "S10.3" ? 0.62 : 0;
    return { scene: "case", world: "D1", cars: stillCars(), busAlong, t: u * 6 };
  }
  if (inLead || speech.ordinal === 0) {
    return { scene: "junction", world: "A1", pave: { type: "dirt" }, snow: 0, contrast: 1, cars: stillCars() };
  }
  if (speech.ordinal === 1) {
    const memories = [
      { scene: "junction", world: "A2", pave: { type: "patch", length: PATCH_LEN } },
      { scene: "junction", world: "A3", pave: { type: "paved" } },
      { scene: "junction", world: "A5", pave: { type: "dirt" }, snow: 1 },
      { scene: "yard", world: "C1", yardU: 0, pedestrian: true },
    ];
    const item = memories[Math.min(memories.length - 1, Math.floor(u * memories.length))];
    return { ...item, snow: item.snow ?? 0, contrast: 1, cars: stillCars() };
  }
  return { scene: "recap", world: "OUTRO", cars: stillCars(), recapCount: Math.max(1, Math.ceil(Math.max(u, 0.05) * 8)) };
}
