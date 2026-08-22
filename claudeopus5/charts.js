// @ts-check

import { analyticHarm, braessWindow, createRoadState, meanTravelTime, relaxRoads } from './braess-model.js';
import { prepare } from './renderer.js';

const INK = '#e8e4dc';
const DIM = '#8a8375';
const HOT = '#e0533d';
const COOL = '#4aa8a0';
const GRID = '#302c26';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} colour
 * @param {CanvasTextAlign} align
 */
function tick(ctx, text, x, y, colour, align) {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * The two curves that make the point: the quantity the system minimises, and the
 * quantity the commuters care about, over the same relaxation.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} drivers
 */
export function drawDescent(canvas, drivers) {
  const { ctx, width, height } = prepare(canvas);
  const pad = { left: 46, right: 46, top: 20, bottom: 28 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const state = createRoadState(drivers, true);
  const run = relaxRoads(state);
  const trace = run.trace;

  ctx.save();
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);
  ctx.restore();

  if (trace.length < 2 || run.steps === 0) {
    tick(ctx, 'nobody wants to switch: already at equilibrium', width / 2, height / 2, DIM, 'center');
    return;
  }

  const potentials = trace.map((p) => p.potential);
  const times = trace.map((p) => p.meanTime);
  const pMin = Math.min(...potentials);
  const pMax = Math.max(...potentials);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const span = (v, lo, hi) => (hi - lo < 1e-9 ? 0.5 : (v - lo) / (hi - lo));

  /**
   * @param {number[]} series
   * @param {number} lo
   * @param {number} hi
   * @param {string} colour
   */
  const line = (series, lo, hi, colour) => {
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    series.forEach((value, i) => {
      const x = pad.left + (i / (series.length - 1)) * plotW;
      const y = pad.top + plotH - span(value, lo, hi) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  };

  line(potentials, pMin, pMax, COOL);
  line(times, tMin, tMax, HOT);

  tick(ctx, `${(pMax / 1000).toFixed(0)}k`, pad.left - 6, pad.top, COOL, 'right');
  tick(ctx, `${(pMin / 1000).toFixed(0)}k`, pad.left - 6, pad.top + plotH, COOL, 'right');
  tick(ctx, `${tMax.toFixed(0)}`, width - pad.right + 6, pad.top, HOT, 'left');
  tick(ctx, `${tMin.toFixed(0)}`, width - pad.right + 6, pad.top + plotH, HOT, 'left');
  tick(ctx, 'potential the drivers descend', pad.left, pad.top - 9, COOL, 'left');
  tick(ctx, 'the commute they get', width - pad.right, pad.top - 9, HOT, 'right');
  tick(ctx, `drivers switching route, one at a time  ->  ${run.steps} switches`, width / 2, height - 10, DIM, 'center');
}

/**
 * Harm from opening the shortcut, against demand, with the window shaded and the
 * reader's current demand marked.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} currentDrivers
 * @param {number} maxDrivers
 */
export function drawHarmCurve(canvas, currentDrivers, maxDrivers) {
  const { ctx, width, height } = prepare(canvas);
  const pad = { left: 46, right: 18, top: 18, bottom: 30 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const window = braessWindow();

  const samples = [];
  for (let n = 0; n <= maxDrivers; n += maxDrivers / 240) samples.push({ n, harm: analyticHarm(n) });
  const lo = Math.min(...samples.map((s) => s.harm));
  const hi = Math.max(...samples.map((s) => s.harm));
  const x = (n) => pad.left + (n / maxDrivers) * plotW;
  const y = (h) => pad.top + plotH - ((h - lo) / (hi - lo)) * plotH;

  ctx.save();
  ctx.fillStyle = 'rgba(224,83,61,0.10)';
  ctx.fillRect(x(window.lower), pad.top, x(window.upper) - x(window.lower), plotH);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);
  ctx.beginPath();
  ctx.moveTo(pad.left, y(0));
  ctx.lineTo(pad.left + plotW, y(0));
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 2;
  ctx.beginPath();
  samples.forEach((s, i) => (i === 0 ? ctx.moveTo(x(s.n), y(s.harm)) : ctx.lineTo(x(s.n), y(s.harm))));
  ctx.strokeStyle = HOT;
  ctx.stroke();
  ctx.restore();

  const here = analyticHarm(currentDrivers);
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x(currentDrivers), pad.top);
  ctx.lineTo(x(currentDrivers), pad.top + plotH);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x(currentDrivers), y(here), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  tick(ctx, `+${hi.toFixed(0)} min`, pad.left - 6, y(hi), HOT, 'right');
  tick(ctx, '0', pad.left - 6, y(0), DIM, 'right');
  tick(ctx, `${lo.toFixed(0)} min`, pad.left - 6, y(lo), COOL, 'right');
  tick(ctx, '0', pad.left, height - 12, DIM, 'center');
  tick(ctx, `${window.lower}`, x(window.lower), height - 12, HOT, 'center');
  tick(ctx, `${window.upper}`, x(window.upper), height - 12, HOT, 'center');
  tick(ctx, `${maxDrivers} drivers`, pad.left + plotW, height - 12, DIM, 'right');
  tick(
    ctx,
    here > 0.05 ? `the shortcut costs ${here.toFixed(1)} min` : here < -0.05 ? `the shortcut saves ${(-here).toFixed(1)} min` : 'the shortcut changes nothing',
    x(currentDrivers) > width / 2 ? x(currentDrivers) - 8 : x(currentDrivers) + 8,
    pad.top + 10,
    INK,
    x(currentDrivers) > width / 2 ? 'right' : 'left',
  );
}
