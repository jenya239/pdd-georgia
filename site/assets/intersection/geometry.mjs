import { rotateDir } from "./model.mjs";
export const LANE = 0.18;
export const VEHICLE_LENGTH = 0.34;
export const VEHICLE_WIDTH = 0.16;
/** Gap that still counts as interference. Not a legal distance. */
export const SAFETY = 0.04;
export const STOP = 0.72;
export const EXIT = 1.22;
export const RIGHT_RADIUS = 0.36;
export const ROAD_HALF = 0.4;
/** Unit vector of travel for a vehicle that entered from `dir`. */
export function forward(dir) {
    if (dir === "N")
        return { x: 0, y: -1 };
    if (dir === "E")
        return { x: -1, y: 0 };
    if (dir === "S")
        return { x: 0, y: 1 };
    return { x: 1, y: 0 };
}
export function rightVec(dir) {
    const face = forward(dir);
    return { x: face.y, y: -face.x };
}
/** Point on the right-hand lane, `dist` before the centre (negative = past it). */
export function pointOn(dir, dist) {
    const face = forward(dir);
    const right = rightVec(dir);
    return {
        x: -face.x * dist + right.x * LANE,
        y: -face.y * dist + right.y * LANE,
    };
}
export function headingOf(dir) {
    const face = forward(dir);
    return Math.atan2(face.y, face.x);
}
/** Where a maneuver leaves the junction, as an approach id you would be driving toward. */
export function exitArm(from, maneuver) {
    if (maneuver === "straight")
        return rotateDir(from, 2);
    if (maneuver === "right")
        return rotateDir(from, 1);
    return rotateDir(from, 3);
}
/**
 * Left-turn control polygon for the south approach, before rotation.
 * Handles stay tangent to the entry and exit lanes so the heading does not jump.
 * The curve bows through the south-west, away from the opposite left turn.
 */
export const LEFT_SOUTH = {
    p0: { x: LANE, y: -0.62 },
    p1: { x: LANE, y: -0.46 },
    p2: { x: -0.5, y: LANE },
    p3: { x: -0.82, y: LANE },
};
function add(out, sample) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(prev.x - sample.x, prev.y - sample.y) < 1e-6)
        return;
    out.push(sample);
}
function line(out, from, to, steps) {
    const heading = Math.atan2(to.y - from.y, to.x - from.x);
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        add(out, {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
            heading,
        });
    }
}
function southStraight() {
    const out = [];
    line(out, pointOn("S", STOP), pointOn("S", -EXIT), 28);
    return out;
}
function southRight() {
    const out = [];
    const radius = RIGHT_RADIUS;
    const arcStart = pointOn("S", LANE + radius);
    const center = { x: arcStart.x + radius, y: arcStart.y };
    const arcEnd = { x: center.x, y: center.y + radius };
    line(out, pointOn("S", STOP), arcStart, 6);
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
        const theta = Math.PI - (i / steps) * (Math.PI / 2);
        const x = center.x + radius * Math.cos(theta);
        const y = center.y + radius * Math.sin(theta);
        const dx = Math.sin(theta);
        const dy = -Math.cos(theta);
        add(out, { x, y, heading: Math.atan2(dy, dx) });
    }
    line(out, arcEnd, { x: EXIT, y: -LANE }, 12);
    return out;
}
function cubic(t, a, b, c, d) {
    const u = 1 - t;
    return {
        x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
        y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
    };
}
function cubicTangent(t, a, b, c, d) {
    const u = 1 - t;
    return {
        x: 3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x),
        y: 3 * u * u * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t * t * (d.y - c.y),
    };
}
function southLeft() {
    const out = [];
    const { p0, p1, p2, p3 } = LEFT_SOUTH;
    line(out, pointOn("S", STOP), p0, 8);
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = cubic(t, p0, p1, p2, p3);
        const tangent = cubicTangent(t, p0, p1, p2, p3);
        add(out, { x: point.x, y: point.y, heading: Math.atan2(tangent.y, tangent.x) });
    }
    line(out, p3, { x: -EXIT, y: LANE }, 12);
    return out;
}
function rotateSample(sample) {
    return { x: sample.y, y: -sample.x, heading: sample.heading - Math.PI / 2 };
}
const BASE = {
    straight: southStraight(),
    right: southRight(),
    left: southLeft(),
};
/** Steps clockwise from the south approach. South is the base path. */
function stepsFromSouth(dir) {
    if (dir === "S")
        return 0;
    if (dir === "W")
        return 1;
    if (dir === "N")
        return 2;
    return 3;
}
export function pathOf(from, maneuver) {
    let samples = BASE[maneuver].map((sample) => ({ ...sample }));
    const steps = stepsFromSouth(from);
    for (let i = 0; i < steps; i++)
        samples = samples.map(rotateSample);
    return samples;
}
export function pointAlong(samples, t) {
    const clamped = Math.min(1, Math.max(0, t));
    if (samples.length === 0)
        return { x: 0, y: 0, heading: 0 };
    const lengths = [0];
    for (let i = 1; i < samples.length; i++) {
        lengths.push(lengths[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
    }
    const total = lengths[lengths.length - 1] || 1;
    const target = clamped * total;
    let index = 1;
    while (index < lengths.length - 1 && lengths[index] < target)
        index += 1;
    const span = lengths[index] - lengths[index - 1] || 1;
    const local = (target - lengths[index - 1]) / span;
    const a = samples[index - 1];
    const b = samples[index];
    return {
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local,
        heading: lerpAngle(a.heading, b.heading, local),
    };
}
function lerpAngle(a, b, t) {
    let delta = b - a;
    while (delta > Math.PI)
        delta -= Math.PI * 2;
    while (delta < -Math.PI)
        delta += Math.PI * 2;
    return a + delta * t;
}
function corners(sample, halfL, halfW) {
    const ux = Math.cos(sample.heading);
    const uy = Math.sin(sample.heading);
    const px = -uy;
    const py = ux;
    return [
        { x: sample.x + ux * halfL + px * halfW, y: sample.y + uy * halfL + py * halfW },
        { x: sample.x + ux * halfL - px * halfW, y: sample.y + uy * halfL - py * halfW },
        { x: sample.x - ux * halfL - px * halfW, y: sample.y - uy * halfL - py * halfW },
        { x: sample.x - ux * halfL + px * halfW, y: sample.y - uy * halfL + py * halfW },
    ];
}
function project(points, axis) {
    let min = Infinity;
    let max = -Infinity;
    for (const point of points) {
        const value = point.x * axis.x + point.y * axis.y;
        if (value < min)
            min = value;
        if (value > max)
            max = value;
    }
    return { min, max };
}
function axes(points) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
        const next = points[(i + 1) % points.length];
        const edge = { x: next.x - points[i].x, y: next.y - points[i].y };
        const length = Math.hypot(edge.x, edge.y) || 1;
        out.push({ x: -edge.y / length, y: edge.x / length });
    }
    return out;
}
function polygonsOverlap(a, b) {
    for (const axis of [...axes(a), ...axes(b)]) {
        const pa = project(a, axis);
        const pb = project(b, axis);
        if (pa.max < pb.min || pb.max < pa.min)
            return false;
    }
    return true;
}
/** True when the inflated bodies of the two swept paths meet. */
export function pathsConflict(a, b) {
    const halfL = VEHICLE_LENGTH / 2 + SAFETY / 2;
    const halfW = VEHICLE_WIDTH / 2 + SAFETY / 2;
    for (const left of a) {
        const boxA = corners(left, halfL, halfW);
        for (const right of b) {
            if (polygonsOverlap(boxA, corners(right, halfL, halfW)))
                return true;
        }
    }
    return false;
}
export function minCenterDistance(a, b) {
    let best = Infinity;
    for (const left of a) {
        for (const right of b) {
            const distance = Math.hypot(left.x - right.x, left.y - right.y);
            if (distance < best)
                best = distance;
        }
    }
    return best;
}
/** Largest heading change between consecutive samples, in radians. */
export function maxHeadingStep(samples) {
    let best = 0;
    for (let i = 1; i < samples.length; i++) {
        let delta = samples[i].heading - samples[i - 1].heading;
        while (delta > Math.PI)
            delta -= Math.PI * 2;
        while (delta < -Math.PI)
            delta += Math.PI * 2;
        best = Math.max(best, Math.abs(delta));
    }
    return best;
}
