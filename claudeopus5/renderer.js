// @ts-check

const INK = '#e8e4dc';
const MUTED = '#8b8577';
const TRUTH = '#6f7f8c';
const LIVED = '#e2703a';
const GRID = '#241f1a';

/**
 * @typedef {{ counts: number[], lo: number, hi: number }} Histogram
 */

/**
 * @param {number} bins
 * @param {number} lo
 * @param {number} hi
 * @returns {Histogram}
 */
export function makeHistogram(bins, lo, hi) {
  return { counts: new Array(bins).fill(0), lo, hi };
}

/**
 * @param {Histogram} hist
 * @param {number} value
 */
export function addToHistogram(hist, value) {
  const span = hist.hi - hist.lo;
  const idx = Math.floor(((value - hist.lo) / span) * hist.counts.length);
  if (idx < 0) hist.counts[0] += 1;
  else if (idx >= hist.counts.length) hist.counts[hist.counts.length - 1] += 1;
  else hist.counts[idx] += 1;
}

/**
 * @param {readonly number[]} values
 * @param {number} bins
 * @param {number} lo
 * @param {number} hi
 * @returns {Histogram}
 */
export function histogramOf(values, bins, lo, hi) {
  const hist = makeHistogram(bins, lo, hi);
  for (let i = 0; i < values.length; i++) addToHistogram(hist, values[i]);
  return hist;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D | null}
 */
export function fitCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(canvas.clientWidth, 1);
  const height = Math.max(canvas.clientHeight, 1);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} colour
 * @param {string} [font]
 */
function label(ctx, text, x, y, colour, font) {
  ctx.fillStyle = colour;
  ctx.font = font ?? '11px ui-monospace, monospace';
  ctx.fillText(text, x, y);
}

/**
 * Two overlaid distributions: the population as it is, and the population as it is encountered.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w: number, h: number }} box
 * @param {Histogram} truth
 * @param {Histogram} lived
 * @param {string} truthLabel
 * @param {string} livedLabel
 */
export function drawComparison(ctx, box, truth, lived, truthLabel, livedLabel) {
  const bins = truth.counts.length;
  const barW = box.w / bins;
  const norm = (/** @type {Histogram} */ h) => {
    let total = 0;
    for (let i = 0; i < h.counts.length; i++) total += h.counts[i];
    return total === 0 ? h.counts.map(() => 0) : h.counts.map((c) => c / total);
  };
  const a = norm(truth);
  const b = norm(lived);
  let peak = 0;
  for (let i = 0; i < bins; i++) peak = Math.max(peak, a[i], b[i]);
  if (peak === 0) peak = 1;

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + box.h + 0.5);
  ctx.lineTo(box.x + box.w, box.y + box.h + 0.5);
  ctx.stroke();

  for (let i = 0; i < bins; i++) {
    const ha = (a[i] / peak) * box.h;
    ctx.fillStyle = TRUTH;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(box.x + i * barW, box.y + box.h - ha, Math.max(barW - 1, 1), ha);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = LIVED;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < bins; i++) {
    const hb = (b[i] / peak) * box.h;
    const px = box.x + i * barW + barW / 2;
    const py = box.y + box.h - hb;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  label(ctx, truthLabel, box.x, box.y - 6, TRUTH);
  ctx.textAlign = 'right';
  label(ctx, livedLabel, box.x + box.w, box.y - 6, LIVED);
  ctx.textAlign = 'left';
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {{ gaps: readonly number[], shown: number, focus: number, truth: Histogram, lived: Histogram, arrivalFrac: number }} view
 */
export function drawTimetable(ctx, w, h, view) {
  ctx.clearRect(0, 0, w, h);
  const pad = 14;
  const stripY = 24;
  const stripH = 74;
  const shown = Math.min(view.shown, view.gaps.length);

  let total = 0;
  for (let i = 0; i < shown; i++) total += view.gaps[i];
  const scale = (w - pad * 2) / total;

  label(ctx, `timetable \u2014 first ${shown} gaps of ${view.gaps.length.toLocaleString()}`, pad, 14, MUTED);

  let x = pad;
  for (let i = 0; i < shown; i++) {
    const gw = view.gaps[i] * scale;
    const isFocus = i === view.focus;
    ctx.fillStyle = isFocus ? LIVED : i % 2 === 0 ? '#1d1915' : '#161310';
    ctx.globalAlpha = isFocus ? 0.3 : 1;
    ctx.fillRect(x, stripY, Math.max(gw - 1, 0.5), stripH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = isFocus ? LIVED : '#4a443c';
    ctx.fillRect(x, stripY, 1.5, stripH);
    x += gw;
  }
  ctx.fillStyle = '#4a443c';
  ctx.fillRect(x, stripY, 1.5, stripH);

  if (view.focus >= 0 && view.focus < shown) {
    let ax = pad;
    for (let i = 0; i < view.focus; i++) ax += view.gaps[i] * scale;
    ax += view.gaps[view.focus] * scale * view.arrivalFrac;
    ctx.strokeStyle = LIVED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, stripY - 6);
    ctx.lineTo(ax, stripY + stripH + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ax, stripY - 9, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = LIVED;
    ctx.fill();
  }

  drawComparison(
    ctx,
    { x: pad, y: stripY + stripH + 34, w: w - pad * 2, h: h - (stripY + stripH + 34) - 18 },
    view.truth,
    view.lived,
    'gaps as printed',
    'gaps as waited through',
  );
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {{ degrees: readonly number[], friends: readonly number[], focus: number, picked: number, truth: Histogram, lived: Histogram }} view
 */
export function drawTown(ctx, w, h, view) {
  ctx.clearRect(0, 0, w, h);
  const pad = 14;
  const gridH = 140;
  const boxW = w - pad * 2;
  const count = view.degrees.length;
  const side = Math.max(1, Math.round(Math.sqrt((count * boxW) / gridH)));
  const rows = Math.ceil(count / side);
  const cell = Math.min(boxW / side, gridH / rows);
  const originX = pad + (boxW - cell * side) / 2;
  const originY = 24;

  label(ctx, `${view.degrees.length.toLocaleString()} people \u2014 dot size is friend count`, pad, 14, MUTED);

  let maxDeg = 1;
  for (let i = 0; i < view.degrees.length; i++) maxDeg = Math.max(maxDeg, view.degrees[i]);

  /** @param {number} i */
  const at = (i) => ({ x: originX + (i % side) * cell + cell / 2, y: originY + Math.floor(i / side) * cell + cell / 2 });

  ctx.fillStyle = TRUTH;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < view.degrees.length; i++) {
    const p = at(i);
    const r = 0.6 + (view.degrees[i] / maxDeg) * (cell * 0.45);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (view.focus >= 0) {
    const p = at(view.focus);
    ctx.strokeStyle = LIVED;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let k = 0; k < view.friends.length; k++) {
      const q = at(view.friends[k]);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(cell * 0.4, 2.5), 0, Math.PI * 2);
    ctx.fill();

    if (view.picked >= 0) {
      const q = at(view.picked);
      ctx.fillStyle = LIVED;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(cell * 0.5, 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawComparison(
    ctx,
    { x: pad, y: originY + gridH + 34, w: w - pad * 2, h: h - (originY + gridH + 34) - 18 },
    view.truth,
    view.lived,
    'friend counts, everyone',
    'friend counts, as met',
  );
}
