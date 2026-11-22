/** Immediate-mode raster of the same primitives. No legal interpretation. */
import { deflateSync, crc32 } from "node:zlib";

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, sum]);
}

export function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 1 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function parseHex(fill) {
  if (!fill || fill === "none" || fill.startsWith("rgba")) return null;
  const h = fill.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function blend(rgb, width, x, y, col, alpha) {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 3;
  if (alpha >= 0.999) {
    rgb[i] = col[0];
    rgb[i + 1] = col[1];
    rgb[i + 2] = col[2];
    return;
  }
  const k = 1 - alpha;
  rgb[i] = col[0] * alpha + rgb[i] * k;
  rgb[i + 1] = col[1] * alpha + rgb[i + 1] * k;
  rgb[i + 2] = col[2] * alpha + rgb[i + 2] * k;
}

function fillPolygon(rgb, width, height, points, col, alpha) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(height - 1, Math.ceil(maxY));
  const n = points.length;
  for (let y = y0; y <= y1; y++) {
    const scan = y + 0.5;
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1p] = points[i];
      const [x2, y2p] = points[(i + 1) % n];
      if ((y1p <= scan && y2p > scan) || (y2p <= scan && y1p > scan)) {
        const t = (scan - y1p) / (y2p - y1p);
        xs.push(x1 + (x2 - x1) * t);
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.max(0, Math.ceil(xs[i]));
      const b = Math.min(width - 1, Math.floor(xs[i + 1]));
      for (let x = a; x <= b; x++) blend(rgb, width, x, y, col, alpha);
    }
  }
}

function fillCircle(rgb, width, height, cx, cy, r, col, alpha) {
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(height - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    const dx = Math.sqrt(Math.max(0, r2 - dy * dy));
    const x0 = Math.max(0, Math.ceil(cx - dx));
    const x1 = Math.min(width - 1, Math.floor(cx + dx));
    for (let x = x0; x <= x1; x++) blend(rgb, width, x, y, col, alpha);
  }
}

function strokeSegment(rgb, width, height, a, b, strokeWidth, col, alpha) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * strokeWidth * 0.5;
  const ny = (dx / len) * strokeWidth * 0.5;
  fillPolygon(rgb, width, height, [
    [a[0] + nx, a[1] + ny],
    [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny],
    [a[0] - nx, a[1] - ny],
  ], col, alpha);
}

export function rasterize(frame) {
  const { width, height, shapes } = frame;
  const rgb = new Uint8Array(width * height * 3);
  for (const shape of shapes) {
    if (shape.op === "text") continue;
    const alpha = shape.opacity ?? 1;
    const col = parseHex(shape.fill);
    if (shape.op === "poly" && col) fillPolygon(rgb, width, height, shape.pts, col, alpha);
    else if (shape.op === "circle" && col) fillCircle(rgb, width, height, shape.cx, shape.cy, shape.r, col, alpha);
    else if (shape.op === "line") {
      const stroke = parseHex(shape.stroke);
      if (!stroke) continue;
      for (let i = 0; i < shape.pts.length - 1; i++) {
        strokeSegment(rgb, width, height, shape.pts[i], shape.pts[i + 1], shape.width ?? 2, stroke, alpha);
      }
    }
    if (shape.stroke && shape.op === "circle") {
      const stroke = parseHex(shape.stroke);
      if (stroke) {
        const steps = 28;
        for (let i = 0; i < steps; i++) {
          const a0 = (i / steps) * Math.PI * 2;
          const a1 = ((i + 1) / steps) * Math.PI * 2;
          strokeSegment(rgb, width, height,
            [shape.cx + Math.cos(a0) * shape.r, shape.cy + Math.sin(a0) * shape.r],
            [shape.cx + Math.cos(a1) * shape.r, shape.cy + Math.sin(a1) * shape.r],
            shape.width ?? 2, stroke, alpha);
        }
      }
    }
  }
  return rgb;
}
