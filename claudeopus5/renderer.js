// @ts-check

/**
 * Canvas drawing. Every function here takes numbers and paints them; none of them knows what a
 * mode means or how one is computed.
 */

export const AMBER = '#f0c368';
export const STEEL = '#7f9dc4';
const INK = '#e9e6df';
const DIM = '#565b66';
const GRID = '#1c212b';

/**
 * Resize a canvas to its CSS box at device resolution and return a context in CSS pixels.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ ctx: CanvasRenderingContext2D, w: number, h: number } | null}
 */
export function prepare(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/**
 * The string itself: its instantaneous shape, where it is being driven, and where the third
 * harmonic's nodes sit.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number[]} amplitudes modal amplitudes
 * @param {number} scale divisor bringing the displacement into view
 * @param {number} driveX drive position in (0, 1)
 */
export function drawString(canvas, amplitudes, scale, driveX) {
  const p = prepare(canvas);
  if (!p) return;
  const { ctx, w, h } = p;
  const mid = h / 2;
  const pad = 18;
  const span = w - pad * 2;
  const amp = h * 0.34;

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, mid);
  ctx.lineTo(w - pad, mid);
  ctx.stroke();

  for (const nodeX of [1 / 3, 2 / 3]) {
    const px = pad + nodeX * span;
    ctx.strokeStyle = 'rgba(240,195,104,0.30)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(px, mid - amp);
    ctx.lineTo(px, mid + amp);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = 'rgba(240,195,104,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 160; i++) {
    const x = i / 160;
    const y = mid - Math.sin(3 * Math.PI * x) * amp * 0.55;
    if (i === 0) ctx.moveTo(pad + x * span, y);
    else ctx.lineTo(pad + x * span, y);
  }
  ctx.stroke();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i <= 220; i++) {
    const x = i / 220;
    let y = 0;
    for (let k = 0; k < amplitudes.length; k++) {
      y += amplitudes[k] * Math.SQRT2 * Math.sin((k + 1) * Math.PI * x);
    }
    const py = mid - Math.max(-1.4, Math.min(1.4, y / scale)) * amp;
    if (i === 0) ctx.moveTo(pad + x * span, py);
    else ctx.lineTo(pad + x * span, py);
  }
  ctx.stroke();

  const dx = pad + driveX * span;
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(dx, mid, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(240,195,104,0.18)';
  ctx.beginPath();
  ctx.arc(dx, mid, 12, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Scrolling abundance traces, one per species.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number[][]} history history[t][species], oldest first
 * @param {number} scale
 */
export function drawTraces(canvas, history, scale) {
  const p = prepare(canvas);
  if (!p) return;
  const { ctx, w, h } = p;
  if (history.length < 2) return;
  const pad = 10;
  const species = history[0].length;
  const lane = (h - pad * 2) / species;

  for (let s = 0; s < species; s++) {
    const base = pad + lane * (s + 0.5);
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, base);
    ctx.lineTo(w, base);
    ctx.stroke();

    ctx.strokeStyle = STEEL;
    ctx.globalAlpha = 0.55 + 0.45 * (1 - s / species);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let t = 0; t < history.length; t++) {
      const x = (t / (history.length - 1)) * w;
      const v = Math.max(-1.3, Math.min(1.3, history[t][s] / scale));
      const y = base - v * lane * 0.44;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/**
 * Share of the fluctuation carried by each mode, with the near-critical one picked out.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number[]} shares
 * @param {number} soft index to highlight
 * @param {string} accent
 */
export function drawBars(canvas, shares, soft, accent) {
  const p = prepare(canvas);
  if (!p) return;
  const { ctx, w, h } = p;
  const pad = 16;
  const n = shares.length;
  const slot = (w - pad * 2) / n;
  const barW = Math.min(slot * 0.56, 26);
  const top = 10;
  const floor = h - 20;

  ctx.strokeStyle = GRID;
  ctx.beginPath();
  ctx.moveTo(pad, floor + 0.5);
  ctx.lineTo(w - pad, floor + 0.5);
  ctx.stroke();

  for (let k = 0; k < n; k++) {
    const cx = pad + slot * (k + 0.5);
    const hgt = Math.max(1, shares[k] * (floor - top));
    ctx.fillStyle = k === soft ? accent : 'rgba(233,230,223,0.26)';
    ctx.fillRect(cx - barW / 2, floor - hgt, barW, hgt);
    ctx.fillStyle = k === soft ? accent : DIM;
    ctx.font = '600 10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(k + 1), cx, h - 6);
  }
}

/**
 * The shared law: visibility against reduced drive, with a live marker for each system.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ g: number, visibility: number, colour: string, label: string }[]} markers
 */
export function drawLaw(canvas, markers) {
  const p = prepare(canvas);
  if (!p) return;
  const { ctx, w, h } = p;
  const padL = 46;
  const padR = 16;
  const padT = 14;
  const padB = 30;
  const lo = -7;
  const hi = 7;

  /** @param {number} g */
  const gx = (g) => {
    const l = Math.max(lo, Math.min(hi, Math.log10(Math.max(g, 1e-12))));
    return padL + ((l - lo) / (hi - lo)) * (w - padL - padR);
  };
  /** @param {number} v */
  const vy = (v) => padT + (1 - v) * (h - padT - padB);

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  for (const v of [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(padL, vy(v));
    ctx.lineTo(w - padR, vy(v));
    ctx.stroke();
    ctx.fillStyle = DIM;
    ctx.font = '600 10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(v.toFixed(1), padL - 8, vy(v) + 3);
  }
  for (let l = lo; l <= hi; l += 2) {
    const x = gx(Math.pow(10, l));
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, h - padB);
    ctx.stroke();
    ctx.fillStyle = DIM;
    ctx.textAlign = 'center';
    ctx.fillText(`1e${l}`, x, h - padB + 14);
  }

  ctx.strokeStyle = 'rgba(233,230,223,0.55)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i <= 300; i++) {
    const l = lo + (i / 300) * (hi - lo);
    const g = Math.pow(10, l);
    const x = gx(g);
    const y = vy(g / (1 + g));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  for (const m of markers) {
    const x = gx(m.g);
    const y = vy(m.visibility);
    ctx.fillStyle = m.colour;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#06070a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
