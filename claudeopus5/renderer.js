// @ts-check

/**
 * All canvas drawing. Knows about pixels and colours and nothing about the physics: it is handed
 * plain numbers by `main.js` and paints them. Keeping it separate is what lets `policy.js` be run
 * headlessly by `node --test`.
 */

const BIO = '#f0b429';
const BIO_DIM = 'rgba(240, 180, 41, 0.28)';
const MACHINE = '#4cc9f0';
const MACHINE_DIM = 'rgba(76, 201, 240, 0.28)';
const INK = '#e8eef5';
const MUTED = 'rgba(232, 238, 245, 0.42)';
const GRID = 'rgba(232, 238, 245, 0.10)';

export const PALETTE = { BIO, MACHINE, INK, MUTED };

/**
 * Size a canvas for the device pixel ratio and return a context scaled to CSS pixels.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ ctx: CanvasRenderingContext2D, width: number, height: number } | null}
 */
export function prepare(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

/**
 * @typedef {object} TrailPoint
 * @property {number} x   World position along the search axis.
 * @property {number} t   Step index when it was recorded.
 * @property {boolean} event  Swimmer: did it tumble here? Optimizer: unused.
 */

/**
 * The bacterium panel: a chemical gradient that brightens to the right, and a cell swimming in it.
 * One horizontal pixel is one unit of the search axis; one dot on the trail is one step.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ x: number, heading: number, trail: TrailPoint[], step: number, scaleWorld: number }} view
 */
export function drawSwimmer(canvas, view) {
  const prepared = prepare(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const midY = height * 0.55;
  const camera = view.x - width / (2 * view.scaleWorld);

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  const left = concentrationAt(camera);
  const right = concentrationAt(camera + width / view.scaleWorld);
  gradient.addColorStop(0, `rgba(240, 180, 41, ${0.03 + 0.20 * left})`);
  gradient.addColorStop(1, `rgba(240, 180, 41, ${0.03 + 0.20 * right})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawFoodSpecks(ctx, width, height, camera, view.scaleWorld);

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = BIO_DIM;
  ctx.beginPath();
  let started = false;
  for (const point of view.trail) {
    const px = (point.x - camera) * view.scaleWorld;
    const py = midY + wiggle(point.t);
    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 122, 89, 0.85)';
  for (const point of view.trail) {
    if (!point.event) continue;
    const px = (point.x - camera) * view.scaleWorld;
    ctx.beginPath();
    ctx.arc(px, midY + wiggle(point.t), 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const cellX = (view.x - camera) * view.scaleWorld;
  const cellY = midY + wiggle(view.step);
  drawCell(ctx, cellX, cellY, view.heading, view.step);
}

/**
 * The optimizer panel: a loss curve falling to the right, and a point descending it.
 * @param {HTMLCanvasElement} canvas
 * @param {{ x: number, trail: TrailPoint[], step: number, scaleWorld: number, lastStep: number }} view
 */
export function drawOptimizer(canvas, view) {
  const prepared = prepare(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const camera = view.x - width / (2 * view.scaleWorld);

  const backdrop = ctx.createLinearGradient(0, 0, 0, height);
  backdrop.addColorStop(0, 'rgba(76, 201, 240, 0.02)');
  backdrop.addColorStop(1, 'rgba(76, 201, 240, 0.10)');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);

  const lossY = (worldX) => {
    const relative = worldX - view.x;
    return height * 0.42 + relative * 0.34 * view.scaleWorld;
  };

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const y = (height * i) / 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(76, 201, 240, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let px = 0; px <= width; px += 4) {
    const worldX = camera + px / view.scaleWorld;
    const y = lossY(worldX);
    if (px === 0) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(76, 201, 240, 0.07)';
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = MACHINE_DIM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (const point of view.trail) {
    const px = (point.x - camera) * view.scaleWorld;
    const py = lossY(point.x) - 9;
    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();

  const ballX = (view.x - camera) * view.scaleWorld;
  const ballY = lossY(view.x) - 9;

  const strideWidth = Math.min(width * 0.45, Math.abs(view.lastStep) * view.scaleWorld);
  if (strideWidth > 1) {
    ctx.strokeStyle = 'rgba(255, 122, 89, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ballX, ballY - 18);
    ctx.lineTo(ballX + Math.sign(view.lastStep) * strideWidth, ballY - 18);
    ctx.stroke();
  }

  ctx.fillStyle = MACHINE;
  ctx.beginPath();
  ctx.arc(ballX, ballY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(76, 201, 240, 0.20)';
  ctx.beginPath();
  ctx.arc(ballX, ballY, 14, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A horizontal meter with a marked target value. Used for the response-amplitude dial, which is
 * the quantity the whole page turns on.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ value: number, max: number, target: number, colour: string, label: string }} view
 */
export function drawMeter(canvas, view) {
  const prepared = prepare(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const barY = height * 0.55;
  const barH = Math.max(8, height * 0.30);

  ctx.fillStyle = 'rgba(232, 238, 245, 0.07)';
  ctx.fillRect(0, barY - barH / 2, width, barH);

  const toX = (v) => (Math.log10(Math.max(0.1, v)) - Math.log10(0.1)) /
    (Math.log10(view.max) - Math.log10(0.1)) * width;

  const filled = Math.min(width, toX(view.value));
  ctx.fillStyle = view.colour;
  ctx.fillRect(0, barY - barH / 2, filled, barH);

  const targetX = toX(view.target);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(targetX, barY - barH / 2 - 5);
  ctx.lineTo(targetX, barY + barH / 2 + 5);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(view.label, 0, 0);
  ctx.textAlign = 'right';
  ctx.fillText(`${view.max}x`, width, 0);
  ctx.textAlign = 'left';
}

/**
 * A rolling strip chart of one scalar per step. This is where each system's signature shows up:
 * the bacterium's turn probability slamming between the 0 and 1 rails, and the optimizer's step
 * length running away. Values are drawn oldest-left, newest-right.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ values: number[], max: number, colour: string, label: string, rail: number | null }} view
 */
export function drawTrace(canvas, view) {
  const prepared = prepare(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const padT = 13;
  const plotH = height - padT - 2;

  ctx.fillStyle = 'rgba(232, 238, 245, 0.04)';
  ctx.fillRect(0, padT, width, plotH);

  const toY = (v) => padT + plotH - Math.min(1, Math.max(0, v / view.max)) * plotH;

  if (view.rail !== null) {
    ctx.strokeStyle = 'rgba(255, 122, 89, 0.55)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    const y = toY(view.rail);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (view.values.length > 1) {
    const dx = width / (view.values.length - 1);
    ctx.strokeStyle = view.colour;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    view.values.forEach((v, i) => {
      const x = i * dx;
      const y = toY(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 122, 89, 0.9)';
    view.values.forEach((v, i) => {
      if (view.rail === null || v < view.rail) return;
      ctx.fillRect(i * dx - 1, padT, 2, 3);
    });
  }

  ctx.fillStyle = MUTED;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(view.label, 0, 0);
  ctx.textAlign = 'right';
  ctx.fillText(view.max >= 10 ? `${view.max}` : view.max.toFixed(1), width, 0);
  ctx.textAlign = 'left';
}

/**
 * @typedef {object} Series
 * @property {string} label
 * @property {string} colour
 * @property {boolean} dashed
 * @property {{ x: number, y: number }[]} points
 */

/**
 * Log-log chart. Used for both sweep figures, so the axes are labelled by the caller.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ series: Series[], xLabel: string, yLabel: string, yMin: number, yMax: number }} view
 */
export function drawLogLog(canvas, view) {
  const prepared = prepare(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const padL = 52;
  const padR = 12;
  const padT = 14;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xs = view.series.flatMap((s) => s.points.map((p) => p.x)).filter((v) => v > 0);
  if (xs.length === 0) return;
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);

  const toX = (v) =>
    padL + ((Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))) * plotW;
  const toY = (v) =>
    padT +
    plotH -
    ((Math.log10(Math.max(view.yMin, v)) - Math.log10(view.yMin)) /
      (Math.log10(view.yMax) - Math.log10(view.yMin))) *
      plotH;

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.fillStyle = MUTED;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  for (let d = Math.ceil(Math.log10(view.yMin)); d <= Math.log10(view.yMax); d += 1) {
    const y = toY(Math.pow(10, d));
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(width - padR, y);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(formatDecade(d), padL - 6, y);
  }
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  for (const v of [0.25, 1, 4, 16]) {
    if (v < xMin || v > xMax) continue;
    const x = toX(v);
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.fillText(String(v), x, padT + plotH + 6);
  }

  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.fillText(view.xLabel, padL + plotW / 2, height - 13);
  ctx.save();
  ctx.translate(11, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(view.yLabel, 0, 0);
  ctx.restore();

  for (const s of view.series) {
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = 2;
    ctx.setLineDash(s.dashed ? [5, 4] : []);
    ctx.beginPath();
    let started = false;
    for (const p of s.points) {
      if (p.x <= 0 || p.y <= 0) continue;
      const px = toX(p.x);
      const py = toY(p.y);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = s.colour;
    for (const p of s.points) {
      if (p.x <= 0 || p.y <= 0) continue;
      ctx.beginPath();
      ctx.arc(toX(p.x), toY(p.y), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** @param {number} d */
function formatDecade(d) {
  if (d === 0) return '1';
  if (d > 0) return String(Math.pow(10, d));
  return `0.${'0'.repeat(-d - 1)}1`;
}

/** Smooth pseudo-random vertical wander so the swim path reads as swimming rather than sliding. */
function wiggle(t) {
  return Math.sin(t * 0.11) * 9 + Math.sin(t * 0.041 + 1.7) * 14;
}

/** Chemoattractant concentration used only for shading. Increases to the right, bounded to [0,1]. */
function concentrationAt(worldX) {
  return 1 / (1 + Math.exp(-worldX / 220));
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {number} camera
 * @param {number} scaleWorld
 */
function drawFoodSpecks(ctx, width, height, camera, scaleWorld) {
  ctx.fillStyle = 'rgba(240, 180, 41, 0.30)';
  const spacing = 37;
  const first = Math.floor(camera / spacing) * spacing;
  for (let worldX = first; worldX < camera + width / scaleWorld + spacing; worldX += spacing) {
    const density = concentrationAt(worldX);
    const count = Math.round(density * 7);
    for (let i = 0; i < count; i += 1) {
      const px = (worldX - camera) * scaleWorld + ((i * 53) % spacing) * scaleWorld * 0.6;
      const py = ((i * 97 + Math.abs(Math.round(worldX))) % Math.round(height));
      ctx.beginPath();
      ctx.arc(px, py, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} heading
 * @param {number} step
 */
function drawCell(ctx, x, y, heading, step) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(heading, 1);

  ctx.strokeStyle = 'rgba(240, 180, 41, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i <= 22; i += 1) {
    const fx = -11 - i * 1.05;
    const fy = Math.sin(step * 0.55 + i * 0.55) * (1.1 + i * 0.20);
    if (i === 0) ctx.moveTo(fx, fy);
    else ctx.lineTo(fx, fy);
  }
  ctx.stroke();

  ctx.fillStyle = BIO;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(3.5, -2, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
