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

export function film() {
  return clip([
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
      overlays: local > 4 ? ["На главной — ещё не первый"] : [],
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
    { dur: 18, at: (local) => ({
      scene: "case", world: "D1", cars: stillCars(),
      busAlong: local < 4 ? 0 : local < 8 ? ease((local - 4) / 4) : 1,
      overlays: [],
      t: local,
    }) },
    { dur: 16, at: () => ({ scene: "stoppark", world: "C3", cars: stillCars(), overlays: [] }) },
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
  ]);
}
