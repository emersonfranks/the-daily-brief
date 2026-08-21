// @ts-check

/** @typedef {import('./grain-model.js').GrainModel} GrainModel */
/** @typedef {import('./grain-model.js').RateAccumulator} RateAccumulator */
/** @typedef {import('./grain-model.js').Fit} Fit */

const SIDE_RANGE = [3, 4, 5, 6, 7, 8, 9, 10];
const LABEL_FONT = '10px ui-monospace,monospace';

/**
 * Resizes a chart canvas for the device pixel ratio and hands back a ready context.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ context: CanvasRenderingContext2D, width: number, height: number } | null}
 */
function prepare(canvas) {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width) return null;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = bounds.width * ratio;
  canvas.height = bounds.height * ratio;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, bounds.width, bounds.height);
  context.font = LABEL_FONT;
  context.textAlign = 'center';
  return { context, width: bounds.width, height: bounds.height };
}

/**
 * Observed growth rate per side count, with the fitted law drawn over it.
 * @param {HTMLCanvasElement} canvas
 * @param {RateAccumulator} rates
 * @param {Fit | null} fit
 */
export function drawRateChart(canvas, rates, fit) {
  const surface = prepare(canvas);
  if (!surface) return;
  const { context, width, height } = surface;

  const padding = 16;
  const plotWidth = width - padding * 2;
  const plotHeight = height - 22;
  let scale = 0.6;
  for (const sides of SIDE_RANGE) {
    const rate = rates.meanRate(sides);
    if (rate !== null) scale = Math.max(scale, Math.abs(rate));
  }

  const midline = plotHeight / 2 + 4;
  const barWidth = plotWidth / SIDE_RANGE.length;
  context.strokeStyle = '#252b36';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding, midline);
  context.lineTo(padding + plotWidth, midline);
  context.stroke();

  SIDE_RANGE.forEach((sides, index) => {
    const left = padding + index * barWidth;
    const rate = rates.meanRate(sides);
    if (rate !== null) {
      const barHeight = (rate / scale) * (plotHeight / 2 - 6);
      context.fillStyle = rate > 0 ? '#f0c368' : rate < 0 ? '#e0705f' : '#5d626d';
      context.fillRect(left + 2, midline - Math.max(barHeight, 0), barWidth - 4, Math.abs(barHeight) || 1);
    }
    context.fillStyle = sides === 6 ? '#e7e4dd' : '#5d626d';
    context.fillText(String(sides), left + barWidth / 2, height - 4);
  });

  if (fit && fit.slope > 0) {
    context.strokeStyle = '#66d19e';
    context.lineWidth = 1.5;
    context.setLineDash([4, 3]);
    context.beginPath();
    SIDE_RANGE.forEach((sides, index) => {
      const y = midline - (fit.slope * (sides - 6) / scale) * (plotHeight / 2 - 6);
      const x = padding + index * barWidth + barWidth / 2;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
    context.setLineDash([]);
  }
}

/**
 * Census of neighbour counts across the surviving cells.
 * @param {HTMLCanvasElement} canvas
 * @param {GrainModel} model
 */
export function drawSideHistogram(canvas, model) {
  const surface = prepare(canvas);
  if (!surface) return;
  const { context, width, height } = surface;

  const padding = 16;
  const plotWidth = width - padding * 2;
  const plotHeight = height - 22;
  const counts = new Array(SIDE_RANGE.length).fill(0);
  for (let cell = 0; cell < model.seedCount; cell++) {
    if (model.area[cell] > 0) {
      const index = SIDE_RANGE.indexOf(model.sides[cell]);
      if (index >= 0) counts[index]++;
    }
  }

  const peak = Math.max(1, ...counts);
  const barWidth = plotWidth / SIDE_RANGE.length;
  SIDE_RANGE.forEach((sides, index) => {
    const barHeight = (counts[index] / peak) * plotHeight;
    context.fillStyle = sides === 6 ? '#e7e4dd' : sides < 6 ? '#3f5f8a' : '#8a6a2f';
    context.fillRect(padding + index * barWidth + 2, plotHeight - barHeight + 4, barWidth - 4, barHeight || 1);
    context.fillStyle = sides === 6 ? '#e7e4dd' : '#5d626d';
    context.fillText(String(sides), padding + index * barWidth + barWidth / 2, height - 4);
  });
}
