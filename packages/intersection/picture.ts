/**
 * Layout for the canvas. Colors and positions only: this module does not
 * know which vehicle is allowed to move.
 */
import type { Dir, Scenario, Vehicle } from "./model.ts";
import { DIR_FROM, MANEUVER_WORD } from "./model.ts";
import { ROAD_HALF, pathOf, pointOn, rightVec, type Sample } from "./geometry.ts";

export const VIEW = 1.35;
export type StyleName = "ink" | "soft";

export interface Palette {
  grass: string;
  tree: string;
  sidewalk: string;
  asphalt: string;
  mark: string;
  car: [string, string];
  disc: string;
  ink: string;
  shadow: string;
  yieldMark: string;
  goMark: string;
}

export const PALETTES: Record<StyleName, Palette> = {
  ink: {
    grass: "#c9d2c6",
    tree: "#667864",
    sidewalk: "#d2cdc2",
    asphalt: "#2a333c",
    mark: "#f4f0e6",
    car: ["#1d4f7a", "#c4511f"],
    disc: "#f7f4ee",
    ink: "#1c242c",
    shadow: "rgba(22, 28, 34, 0.32)",
    yieldMark: "#8e3b32",
    goMark: "#2f6b45",
  },
  soft: {
    grass: "#e4f3d4",
    tree: "#93b986",
    sidewalk: "#f7ecda",
    asphalt: "#838c7c",
    mark: "#fffaf2",
    car: ["#5b93bf", "#e3a36f"],
    disc: "#fffaf3",
    ink: "#2a241e",
    shadow: "rgba(48, 42, 36, 0.2)",
    yieldMark: "#9a5348",
    goMark: "#3d7a52",
  },
};

export interface Anchor {
  dir: Dir;
  sign: Scenario["approaches"][number]["sign"];
  x: number;
  y: number;
}

export interface Hotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
}

export function styleName(value: string | null): StyleName {
  return value === "ink" ? "ink" : "soft";
}

export function waitingSample(vehicle: Vehicle): Sample {
  return pathOf(vehicle.from, vehicle.maneuver)[0];
}

export function signAnchor(dir: Dir): { x: number; y: number } {
  const beside = pointOn(dir, 0.56);
  const right = rightVec(dir);
  return { x: beside.x + right.x * 0.38, y: beside.y + right.y * 0.38 };
}

export function signAnchors(scenario: Scenario): Anchor[] {
  return scenario.approaches
    .filter((arm) => arm.sign === "main" || arm.sign === "yield")
    .map((arm) => ({ dir: arm.id, sign: arm.sign, ...signAnchor(arm.id) }));
}

export function treeSpots(): { x: number; y: number }[] {
  return [
    { x: -1.05, y: -1.05 },
    { x: 1.05, y: -1.05 },
    { x: -1.05, y: 1.05 },
    { x: 1.05, y: 1.05 },
  ];
}

export interface Frame {
  scale: number;
  ox: number;
  oy: number;
}

export function frame(width: number, height: number): Frame {
  const scale = Math.min(width, height) / (VIEW * 2);
  return { scale, ox: width / 2, oy: height / 2 };
}

export function toCanvas(point: { x: number; y: number }, view: Frame): { x: number; y: number } {
  return { x: view.ox + point.x * view.scale, y: view.oy - point.y * view.scale };
}

export function labelPx(scale: number): number {
  return Math.max(16, scale * 0.11);
}

export function hotspots(scenario: Scenario, width: number, height: number, ids: readonly string[]): Hotspot[] {
  const view = frame(width, height);
  return scenario.vehicles.filter((vehicle) => ids.includes(vehicle.id)).map((vehicle) => {
    const pose = waitingSample(vehicle);
    const at = toCanvas(pose, view);
    return {
      id: vehicle.id,
      label: `Автомобиль ${vehicle.id}, ${DIR_FROM[vehicle.from]}, ${MANEUVER_WORD[vehicle.maneuver]}`,
      x: at.x,
      y: at.y,
      size: Math.max(48, view.scale * 0.36),
    };
  });
}

export function carColor(index: number, style: StyleName): string {
  return PALETTES[style].car[index % PALETTES[style].car.length];
}

export function motionMs(outcome: "go" | "stop", reduced: boolean): number {
  if (reduced) return 0;
  return outcome === "go" ? 1100 : 520;
}

/** Ease used by the player. Exported so a test can lock the shape. */
export function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** A short creep forward and back. At 0 and 1 the car is on the stop line. */
export function creep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return Math.sin(x * Math.PI) * 0.16;
}

export function onAsphalt(point: { x: number; y: number }): boolean {
  const box = ROAD_HALF;
  if (Math.abs(point.x) <= box && Math.abs(point.y) <= box) return true;
  if (Math.abs(point.x) <= box && Math.abs(point.y) >= box) return true;
  if (Math.abs(point.y) <= box && Math.abs(point.x) >= box) return true;
  return false;
}
