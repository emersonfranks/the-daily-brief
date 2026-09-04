// @ts-check

/**
 * Canvas drawing. Reads state, writes pixels, decides nothing.
 *
 * The two panels are the same 64 switches drawn twice: on the left as elastic fibres inside
 * microfluidic channels, on the right as magnetic domains. Nothing here is allowed to compute
 * physics — if a number appears on screen it came from `hysterons.js` by way of `observables.js`.
 *
 * @typedef {import('./hysterons.js').Ensemble} Ensemble
 */

import { conductance, CONDUCTANCE_BUCKLED, CONDUCTANCE_OPEN, pressureFromDrive } from './observables.js';

const OPEN = '#5fd4ff';
const BUCKLED = '#ffb347';
const INK = '#e8edf6';
const MUTED = '#7c89a5';

/**
 * Give a canvas a backing store that matches the device pixel ratio, and return its 2D context
 * already scaled to CSS pixels.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ ctx: CanvasRenderingContext2D, width: number, height: number } | null}
 */
export function prepare(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth || 360;
  const height = canvas.clientHeight || 260;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

/**
 * @param {number} n
 * @returns {{ cols: number, rows: number }}
 */
function gridShape(n) {
  const cols = Math.ceil(Math.sqrt(n));
  return { cols, rows: Math.ceil(n / cols) };
}

/**
 * The chip: one cell per channel, with an elastic fibre anchored across it. A straight fibre leaves
 * the channel open; a buckled one throttles it. Dashes drift at the speed the flow actually has.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Ensemble} ensemble
 * @param {number} phase animation phase in seconds
 * @param {Set<number>} recentlyFlipped
 */
export function drawChip(canvas, ensemble, phase, recentlyFlipped) {
  const prepared = prepare(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const { cols, rows } = gridShape(ensemble.n);
  const padding = 8;
  const cellW = (width - padding * 2) / cols;
  const cellH = (height - padding * 2) / rows;
  const pressure = pressureFromDrive(ensemble.drive);

  for (let i = 0; i < ensemble.n; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padding + col * cellW;
    const y = padding + row * cellH;
    const buckled = ensemble.state[i] === 1;

    ctx.fillStyle = buckled ? 'rgba(255,179,71,0.10)' : 'rgba(95,212,255,0.09)';
    ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
    ctx.strokeStyle = 'rgba(150,170,200,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, cellW - 3, cellH - 3);

    // Flow: dashes travelling down the channel, spaced evenly, speed set by pressure x conductance.
    const g = buckled ? CONDUCTANCE_BUCKLED : CONDUCTANCE_OPEN;
    const speed = pressure * g * 6;
    ctx.strokeStyle = buckled ? 'rgba(255,179,71,0.45)' : 'rgba(95,212,255,0.55)';
    ctx.lineWidth = 1.6;
    const spacing = Math.max(6, cellH / 3);
    const offset = ((phase * speed) % spacing + spacing) % spacing;
    for (let d = -spacing; d < cellH; d += spacing) {
      const yy = y + 3 + d + offset;
      if (yy < y + 3 || yy > y + cellH - 4) continue;
      ctx.beginPath();
      ctx.moveTo(x + cellW / 2 - 3, yy);
      ctx.lineTo(x + cellW / 2 + 3, yy);
      ctx.stroke();
    }

    // The fibre itself: a line anchored at the channel wall, straight or bowed across the flow.
    ctx.strokeStyle = recentlyFlipped.has(i) ? '#ffffff' : (buckled ? BUCKLED : OPEN);
    ctx.lineWidth = recentlyFlipped.has(i) ? 3 : 2;
    ctx.beginPath();
    const anchorX = x + 4;
    const anchorY = y + cellH / 2;
    if (buckled) {
      ctx.moveTo(anchorX, anchorY);
      ctx.quadraticCurveTo(x + cellW / 2, y + cellH - 5, x + cellW - 4, anchorY);
    } else {
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(x + cellW - 4, anchorY - 0.5);
    }
    ctx.stroke();
  }
}

/**
 * The magnet: one cell per domain, arrow along or against the applied field.
 * @param {HTMLCanvasElement} canvas
 * @param {Ensemble} ensemble
 * @param {Set<number>} recentlyFlipped
 */
export function drawMagnet(canvas, ensemble, recentlyFlipped) {
  const prepared = prepare(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const { cols, rows } = gridShape(ensemble.n);
  const padding = 8;
  const cellW = (width - padding * 2) / cols;
  const cellH = (height - padding * 2) / rows;

  for (let i = 0; i < ensemble.n; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padding + col * cellW;
    const y = padding + row * cellH;
    const up = ensemble.state[i] === 1;
    const flash = recentlyFlipped.has(i);

    ctx.fillStyle = up ? 'rgba(255,179,71,0.16)' : 'rgba(95,212,255,0.10)';
    if (flash) ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
    ctx.strokeStyle = 'rgba(150,170,200,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, cellW - 3, cellH - 3);

    const cx = x + cellW / 2;
    const cy = y + cellH / 2;
    const arm = Math.min(cellW, cellH) * 0.3;
    const dir = up ? -1 : 1;
    ctx.strokeStyle = flash ? '#ffffff' : (up ? BUCKLED : OPEN);
    ctx.lineWidth = flash ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - dir * arm);
    ctx.lineTo(cx, cy + dir * arm);
    ctx.moveTo(cx - arm * 0.45, cy + dir * arm * 0.4);
    ctx.lineTo(cx, cy + dir * arm);
    ctx.lineTo(cx + arm * 0.45, cy + dir * arm * 0.4);
    ctx.stroke();
  }
}

/**
 * @typedef {Object} TracePoint
 * @property {number} x
 * @property {number} y
 */

/**
 * A hysteresis plot: the path the instrument's needle has actually taken since the last reset.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} options
 * @param {TracePoint[]} options.trace
 * @param {[number, number]} options.xRange
 * @param {[number, number]} options.yRange
 * @param {string} options.xLabel
 * @param {string} options.yLabel
 * @param {TracePoint | null} options.marker      the current reading
 * @param {TracePoint | null} options.turningPoint the point the memory experiment is aiming back at
 * @param {string} options.colour
 */
export function drawPlot(canvas, { trace, xRange, yRange, xLabel, yLabel, marker, turningPoint, colour }) {
  const prepared = prepare(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const left = 44;
  const bottom = 26;
  const top = 10;
  const right = 10;
  const plotW = width - left - right;
  const plotH = height - top - bottom;

  /** @param {number} x @returns {number} */
  const px = (x) => left + ((x - xRange[0]) / (xRange[1] - xRange[0])) * plotW;
  /** @param {number} y @returns {number} */
  const py = (y) => top + plotH - ((y - yRange[0]) / (yRange[1] - yRange[0])) * plotH;

  ctx.strokeStyle = 'rgba(150,170,200,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, plotW, plotH);

  ctx.fillStyle = MUTED;
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(xLabel, left + plotW / 2, height - 8);
  ctx.save();
  ctx.translate(12, top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  ctx.textAlign = 'right';
  ctx.fillText(yRange[1].toFixed(1), left - 4, top + 9);
  ctx.fillText(yRange[0].toFixed(1), left - 4, top + plotH);

  if (trace.length > 1) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px(trace[0].x), py(trace[0].y));
    for (let i = 1; i < trace.length; i += 1) ctx.lineTo(px(trace[i].x), py(trace[i].y));
    ctx.stroke();
  }

  if (turningPoint) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(px(turningPoint.x), py(turningPoint.y), 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (marker) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(px(marker.x), py(marker.y), 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Convenience for the caller: the flow axis range for a given ensemble size, so the plot does not
 * rescale itself while the reader is watching.
 * @returns {[number, number]}
 */
export function flowRange() {
  return [0, 12 * CONDUCTANCE_OPEN];
}

/**
 * @param {Uint8Array} state
 * @returns {number} fraction of channels throttled, for the readout strip
 */
export function throttledFraction(state) {
  if (state.length === 0) return 0;
  return (CONDUCTANCE_OPEN - conductance(state)) / (CONDUCTANCE_OPEN - CONDUCTANCE_BUCKLED);
}
