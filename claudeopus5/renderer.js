// @ts-check
import { poissonPdf, wignerPdf, gammaSpacingPdf, histogram } from './spacings.js';

const COLORS = {
  bus: '#ffb545',
  busTight: '#ff7b72',
  busLoose: '#5f6b82',
  level: '#6ea8fe',
  poisson: '#8a94a8',
  wigner: '#7ee787',
  gamma: '#ff7b72',
  axis: '#26314a',
  text: '#93a1b8',
  track: '#1b2233',
};

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ctx:CanvasRenderingContext2D, width:number, height:number}}
 */
export function setupCanvas(canvas) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || canvas.width));
  const height = Math.max(1, Math.round(rect.height || canvas.height));
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

/**
 * @param {number} gap
 * @returns {string}
 */
function gapColor(gap) {
  if (gap < 0.35) return COLORS.busTight;
  if (gap > 1.7) return COLORS.busLoose;
  return COLORS.bus;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {{positions:Float64Array, spacings:Float64Array}} state
 */
export function drawRing(ctx, width, height, state) {
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 26;

  ctx.strokeStyle = COLORS.track;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < state.positions.length; i++) {
    const angle = state.positions[i] * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    ctx.fillStyle = gapColor(state.spacings[i]);
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {ArrayLike<number>} ticks
 * @param {number} span
 * @param {string} color
 */
function drawStrip(ctx, x, y, width, ticks, span, color) {
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 46);
  ctx.lineTo(x + width, y + 46);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < ticks.length; i++) {
    const t = ticks[i];
    if (t < 0 || t > span) continue;
    const px = x + (t / span) * width;
    ctx.moveTo(px, y + 6);
    ctx.lineTo(px, y + 46);
  }
  ctx.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {{busTicks:ArrayLike<number>, levelTicks:ArrayLike<number>, span:number,
 *   ensembleLabel:string, referenceReady:boolean}} state
 */
export function drawLadders(ctx, width, height, state) {
  ctx.clearRect(0, 0, width, height);
  const pad = 16;
  const inner = width - pad * 2;

  ctx.font = '600 11px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('BUSES ON THE LOOP, CUT OPEN AND LAID FLAT', pad, 22);
  drawStrip(ctx, pad, 30, inner, state.busTicks, state.span, COLORS.bus);

  ctx.fillStyle = COLORS.text;
  ctx.fillText(`ENERGY LEVELS OF A RANDOM NUCLEUS (${state.ensembleLabel})`, pad, 128);
  if (state.referenceReady) {
    drawStrip(ctx, pad, 136, inner, state.levelTicks, state.span, COLORS.level);
  } else {
    ctx.fillStyle = COLORS.axis;
    ctx.fillRect(pad, 176, inner, 1);
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('diagonalising random matrices…', pad, 168);
  }

  ctx.fillStyle = COLORS.text;
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${state.span} average gaps across`, pad, height - 8);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {{samples:ArrayLike<number>, reference:ArrayLike<number>, beta:number,
 *   referenceBeta:1|2, referenceReady:boolean}} state
 */
export function drawHistogram(ctx, width, height, state) {
  ctx.clearRect(0, 0, width, height);
  const left = 66;
  const right = width - 18;
  const top = 18;
  const bottom = height - 80;
  const maxS = 3.6;
  const maxY = 1.15;
  const plotW = right - left;
  const plotH = bottom - top;

  /** @param {number} s @returns {number} */
  const px = (s) => left + (s / maxS) * plotW;
  /** @param {number} d @returns {number} */
  const py = (d) => bottom - (Math.min(d, maxY) / maxY) * plotH;

  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 1;
  ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'right';
  for (let g = 0; g <= 3; g++) {
    const y = py((g * maxY) / 3);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillText(((g * maxY) / 3).toFixed(2), left - 10, y + 4);
  }
  ctx.textAlign = 'center';
  for (let s = 0; s <= 3; s++) {
    ctx.fillText(String(s), px(s), bottom + 20);
  }
  ctx.textAlign = 'left';
  ctx.fillText('gap, in units of the average gap', left, bottom + 40);
  ctx.save();
  ctx.translate(13, (top + bottom) / 2 + ctx.measureText('probability density').width / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('probability density', 0, 0);
  ctx.restore();

  if (state.referenceReady && state.reference.length > 0) {
    const ref = histogram(state.reference, { bins: 36, max: maxS });
    ctx.fillStyle = 'rgba(110, 168, 254, 0.16)';
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    for (let i = 0; i < ref.centers.length; i++) ctx.lineTo(px(ref.centers[i]), py(ref.density[i]));
    ctx.lineTo(px(ref.centers[ref.centers.length - 1]), py(0));
    ctx.closePath();
    ctx.fill();
  }

  if (state.samples.length > 0) {
    const hist = histogram(state.samples, { bins: 36, max: maxS });
    const barW = (plotW / maxS) * hist.width;
    ctx.fillStyle = 'rgba(255, 181, 69, 0.72)';
    for (let i = 0; i < hist.centers.length; i++) {
      const h = bottom - py(hist.density[i]);
      if (h <= 0) continue;
      ctx.fillRect(px(hist.centers[i]) - barW / 2 + 0.5, py(hist.density[i]), barW - 1, h);
    }
  }

  /**
   * @param {(s:number)=>number} fn
   * @param {string} color
   * @param {number[]} dash
   */
  const curve = (fn, color, dash) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= 260; i++) {
      const s = (i / 260) * maxS;
      const y = py(fn(s));
      if (i === 0) ctx.moveTo(px(s), y);
      else ctx.lineTo(px(s), y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };

  curve(poissonPdf, COLORS.poisson, [4, 4]);
  curve((s) => gammaSpacingPdf(s, state.beta), COLORS.gamma, [2, 3]);
  curve((s) => wignerPdf(s, state.referenceBeta), COLORS.wigner, []);

  const legend = [
    ['bars: buses now', 'rgba(255, 181, 69, 0.9)'],
    ['nuclear levels', 'rgba(110, 168, 254, 0.55)'],
    [`Wigner \u03b2=${state.referenceBeta}`, COLORS.wigner],
    ['Poisson (no repulsion)', COLORS.poisson],
    ['short-range gas', COLORS.gamma],
  ];
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  let lx = left;
  let ly = height - 26;
  for (const [label, color] of legend) {
    const advance = ctx.measureText(label).width + 40;
    if (lx + advance > right + 30) {
      lx = left;
      ly += 15;
    }
    ctx.fillStyle = color;
    ctx.fillRect(lx, ly - 4, 10, 3);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(label, lx + 15, ly);
    lx += advance;
  }
}
