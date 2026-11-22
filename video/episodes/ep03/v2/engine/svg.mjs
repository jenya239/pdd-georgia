/** Frame primitives → SVG. Text is escaped. Geometry is not reinterpreted. */

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pts(points) {
  return points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
}

export function frameToSvg(frame) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}">`,
  ];
  for (const shape of frame.shapes) {
    const opacity = shape.opacity == null ? "" : ` opacity="${shape.opacity.toFixed(3)}"`;
    if (shape.op === "poly") {
      const fill = shape.fill && shape.fill !== "none" ? shape.fill : "none";
      const stroke = shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${shape.width ?? 2}"` : "";
      parts.push(`<polygon points="${pts(shape.pts)}" fill="${fill}"${stroke}${opacity}/>`);
    } else if (shape.op === "circle") {
      const fill = !shape.fill || shape.fill === "none" ? "none" : shape.fill;
      const stroke = shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${shape.width ?? 2}"` : "";
      parts.push(`<circle cx="${shape.cx.toFixed(2)}" cy="${shape.cy.toFixed(2)}" r="${shape.r.toFixed(2)}" fill="${fill}"${stroke}${opacity}/>`);
    } else if (shape.op === "line") {
      const dash = shape.dash ? ` stroke-dasharray="${shape.dash}"` : "";
      parts.push(`<polyline points="${pts(shape.pts)}" fill="none" stroke="${shape.stroke}" stroke-width="${shape.width ?? 2}" stroke-linecap="round" stroke-linejoin="round"${dash}${opacity}/>`);
    } else if (shape.op === "text") {
      const weight = shape.weight ? ` font-weight="${shape.weight}"` : "";
      const anchor = shape.anchor ? ` text-anchor="${shape.anchor}"` : "";
      parts.push(`<text x="${shape.x.toFixed(1)}" y="${shape.y.toFixed(1)}" fill="${shape.fill}" font-family="Noto Sans" font-size="${shape.size}"${weight}${anchor}${opacity}>${esc(shape.text)}</text>`);
    }
  }
  parts.push("</svg>");
  return parts.join("");
}
