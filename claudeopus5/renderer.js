// @ts-check

/**
 * Canvas drawing for the two panels and the coverage chart. Everything here
 * reads simulation state and writes pixels; it never advances a simulation.
 */

const INK = '#0d1117';
const CAR_BODY = '#e8743b';
const CAR_TRIM = '#ffd7c2';
const DISC_BODY = '#3d8fd1';
const DISC_TRIM = '#cfe6f7';
const MISS = '#c62d42';
const ASPHALT = '#1c222b';
const RULE = '#39424f';

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D}
 */
export function fitCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('this browser did not provide a 2D canvas context');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

/**
 * The kerb is one long street folded into rows, the way a paragraph wraps.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rsa.js').Kerb} kerb
 * @param {number} rows
 * @param {{ aim: number, age: number }[]} misses
 * @param {number} w
 * @param {number} h
 */
export function drawKerb(ctx, kerb, rows, misses, w, h) {
  const perRow = kerb.length / rows;
  const rowHeight = h / rows;
  const unit = w / perRow;
  const carHeight = Math.min(rowHeight * 0.56, 26);

  ctx.clearRect(0, 0, w, h);
  for (let r = 0; r < rows; r += 1) {
    const y = r * rowHeight + rowHeight / 2;
    ctx.fillStyle = ASPHALT;
    ctx.fillRect(0, y - carHeight * 0.85, w, carHeight * 1.7);
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + carHeight * 0.85);
    ctx.lineTo(w, y + carHeight * 0.85);
    ctx.stroke();
  }

  for (const miss of misses) {
    const row = Math.floor(miss.aim / perRow);
    if (row < 0 || row >= rows) continue;
    const x = (miss.aim - row * perRow) * unit;
    const y = row * rowHeight + rowHeight / 2;
    ctx.globalAlpha = Math.max(0, 1 - miss.age / 18) * 0.75;
    ctx.strokeStyle = MISS;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y - carHeight / 2, Math.max(unit * 0.96, 2), carHeight);
    ctx.globalAlpha = 1;
  }

  for (const car of kerb.cars) {
    let remaining = 1;
    let start = car;
    while (remaining > 1e-9) {
      const row = Math.floor(start / perRow + 1e-9);
      if (row >= rows) break;
      const withinRow = start - row * perRow;
      const span = Math.min(remaining, perRow - withinRow);
      const x = withinRow * unit;
      const y = row * rowHeight + rowHeight / 2;
      const width = Math.max(span * unit - 1.5, 1);
      ctx.fillStyle = CAR_BODY;
      ctx.fillRect(x + 0.75, y - carHeight / 2, width, carHeight);
      ctx.fillStyle = CAR_TRIM;
      ctx.fillRect(x + 0.75, y - carHeight / 2 + 3, width, Math.max(carHeight * 0.22, 2));
      start += span;
      remaining -= span;
    }
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rsa.js').Membrane} membrane
 * @param {{ x: number, y: number, age: number }[]} misses
 * @param {number} w
 * @param {number} h
 */
export function drawMembrane(ctx, membrane, misses, w, h) {
  const side = Math.min(w, h);
  const scale = side / membrane.size;
  const ox = (w - side) / 2;
  const oy = (h - side) / 2;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = ASPHALT;
  ctx.fillRect(ox, oy, side, side);

  for (const miss of misses) {
    ctx.globalAlpha = Math.max(0, 1 - miss.age / 18) * 0.75;
    ctx.strokeStyle = MISS;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox + miss.x * scale, oy + miss.y * scale, membrane.radius * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const r = membrane.radius * scale;
  for (let i = 0; i < membrane.xs.length; i += 1) {
    const cx = ox + membrane.xs[i] * scale;
    const cy = oy + membrane.ys[i] * scale;
    // Periodic edges: draw the wrapped copy so the pattern reads as seamless.
    for (const dx of [0, -side, side]) {
      for (const dy of [0, -side, side]) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < ox - r || px > ox + side + r || py < oy - r || py > oy + side + r) continue;
        ctx.fillStyle = DISC_BODY;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.94, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = DISC_TRIM;
        ctx.beginPath();
        ctx.arc(px - r * 0.28, py - r * 0.28, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, side - 1, side - 1);
}

/**
 * @typedef {Object} Series
 * @property {string} label
 * @property {string} colour
 * @property {{ t: number, coverage: number }[]} points
 */

/**
 * @typedef {Object} Marker
 * @property {string} label
 * @property {string} colour
 * @property {number} value
 * @property {boolean} [dashed]
 */

/**
 * Coverage against RSA time, log horizontal axis, with the published limits
 * drawn as horizontal reference lines.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Series[]} series
 * @param {Marker[]} markers
 * @param {number} w
 * @param {number} h
 */
export function drawChart(ctx, series, markers, w, h) {
  const pad = { left: 52, right: 122, top: 16, bottom: 34 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const tMin = 0.5;
  const tMax = 4000;
  const yMax = 1;

  ctx.clearRect(0, 0, w, h);
  const xOf = (/** @type {number} */ t) =>
    pad.left + (Math.log(Math.max(t, tMin)) - Math.log(tMin)) / (Math.log(tMax) - Math.log(tMin)) * plotW;
  const yOf = (/** @type {number} */ c) => pad.top + plotH - (c / yMax) * plotH;

  ctx.strokeStyle = RULE;
  ctx.fillStyle = '#8a94a3';
  ctx.lineWidth = 1;
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';
  for (let c = 0; c <= 1.0001; c += 0.25) {
    const y = yOf(c);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText(`${Math.round(c * 100)}%`, pad.left - 8, y + 4);
  }
  ctx.textAlign = 'center';
  for (const t of [1, 10, 100, 1000]) {
    const x = xOf(t);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText(String(t), x, pad.top + plotH + 20);
  }
  ctx.fillText('arrivals per unit of space  (log scale)', pad.left + plotW / 2, h - 4);

  // Two of the reference lines sit barely a point apart, so their labels are
  // nudged down the page even though the lines themselves stay where they are.
  let lastLabelY = -Infinity;
  for (const marker of [...markers].sort((a, b) => b.value - a.value)) {
    const y = yOf(marker.value);
    ctx.strokeStyle = marker.colour;
    ctx.setLineDash(marker.dashed ? [3, 4] : [7, 5]);
    ctx.lineWidth = marker.dashed ? 1 : 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const labelY = Math.max(y + 4, lastLabelY + 15);
    lastLabelY = labelY;
    if (Math.abs(labelY - (y + 4)) > 1) {
      ctx.beginPath();
      ctx.moveTo(pad.left + plotW, y);
      ctx.lineTo(pad.left + plotW + 6, labelY - 4);
      ctx.stroke();
    }
    ctx.fillStyle = marker.colour;
    ctx.textAlign = 'left';
    ctx.fillText(marker.label, pad.left + plotW + 8, labelY);
  }

  for (const s of series) {
    if (s.points.length < 2) continue;
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const x = xOf(p.t);
      const y = yOf(p.coverage);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.left + 0.5, pad.top + 0.5, plotW, plotH);
  ctx.fillStyle = INK;
}
