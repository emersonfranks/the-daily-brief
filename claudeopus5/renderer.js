// @ts-check

import { edgeFlows, rigTensions, routeCosts, ROUTE_BOTTOM, ROUTE_SHORTCUT, ROUTE_TOP } from './braess-model.js';

const INK = '#e8e4dc';
const DIM = '#8a8375';
const HOT = '#e0533d';
const COOL = '#4aa8a0';
const FREE = '#c9a227';

/** Normalised node positions in the road panel. */
const NODES = {
  start: [0.09, 0.5],
  a: [0.42, 0.2],
  b: [0.42, 0.8],
  end: [0.91, 0.5],
};

/**
 * How many drivers one animated dot stands for. Fixed so the dot count reads as
 * a share of demand rather than an absolute headcount.
 */
export const DOTS_PER_PANEL = 120;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {[number, number]} normalised
 * @param {number} w
 * @param {number} h
 * @returns {[number, number]}
 */
function place(ctx, normalised, w, h) {
  return [normalised[0] * w, normalised[1] * h];
}

/**
 * Prepare a canvas for crisp drawing on high-density screens.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ ctx: CanvasRenderingContext2D, width: number, height: number }}
 */
export function prepare(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {[number, number]} from
 * @param {[number, number]} to
 * @param {string} colour
 * @param {number} weight
 * @param {boolean} [dashed]
 */
function segment(ctx, from, to, colour, weight, dashed = false) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = weight;
  ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} colour
 * @param {CanvasTextAlign} [align]
 * @param {string} [font]
 */
function label(ctx, text, x, y, colour, align = 'center', font = '12px ui-monospace, monospace') {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** The three route polylines, as normalised node keys. */
const ROUTE_PATHS = [
  ['start', 'a', 'end'],
  ['start', 'b', 'end'],
  ['start', 'a', 'b', 'end'],
];

/**
 * @param {[number, number][]} points
 * @param {number} t Fraction along the whole polyline, 0..1.
 * @returns {[number, number]}
 */
function alongPath(points, t) {
  const lengths = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    const len = Math.hypot(dx, dy);
    lengths.push(len);
    total += len;
  }
  let target = t * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] === 0 ? 0 : Math.min(1, target / lengths[i]);
      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * f,
        points[i][1] + (points[i + 1][1] - points[i][1]) * f,
      ];
    }
    target -= lengths[i];
  }
  return points[points.length - 1];
}

/**
 * Draw the road network: edge loading, route costs, and dots whose speed falls
 * as their route congests.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {import('./braess-model.js').RoadState} state
 * @param {number} phase Animation clock in seconds.
 */
export function drawRoads(canvas, state, phase) {
  const { ctx, width, height } = prepare(canvas);
  const pos = /** @type {Record<string, [number, number]>} */ ({});
  for (const [key, value] of Object.entries(NODES)) {
    pos[key] = place(ctx, /** @type {[number, number]} */ (value), width, height);
  }

  const flows = edgeFlows(state.counts);
  const costs = routeCosts(state.counts, state.params);
  const total = state.counts[0] + state.counts[1] + state.counts[2];
  const busiest = Math.max(flows.startToA, flows.bToEnd, 1);

  /** @param {number} flow @returns {string} */
  const congestionColour = (flow) => {
    const heat = Math.min(1, flow / (state.params.capacity * state.params.fixedCost));
    const r = Math.round(74 + (224 - 74) * heat);
    const g = Math.round(168 + (83 - 168) * heat);
    const b = Math.round(160 + (61 - 160) * heat);
    return `rgb(${r},${g},${b})`;
  };
  /** @param {number} flow @returns {number} */
  const congestionWeight = (flow) => 2 + 9 * (flow / busiest);

  segment(ctx, pos.start, pos.a, congestionColour(flows.startToA), congestionWeight(flows.startToA));
  segment(ctx, pos.b, pos.end, congestionColour(flows.bToEnd), congestionWeight(flows.bToEnd));
  segment(ctx, pos.a, pos.end, DIM, 3);
  segment(ctx, pos.start, pos.b, DIM, 3);

  if (state.shortcutOpen) {
    segment(ctx, pos.a, pos.b, FREE, 4);
  } else {
    segment(ctx, pos.a, pos.b, '#4a4640', 2, true);
  }

  label(ctx, `${(flows.startToA / state.params.capacity).toFixed(0)} min`, (pos.start[0] + pos.a[0]) / 2 - 6, (pos.start[1] + pos.a[1]) / 2 - 14, congestionColour(flows.startToA));
  label(ctx, 'jams', (pos.start[0] + pos.a[0]) / 2 - 6, (pos.start[1] + pos.a[1]) / 2 - 1, DIM, 'center', '10px ui-monospace, monospace');
  label(ctx, `${(flows.bToEnd / state.params.capacity).toFixed(0)} min`, (pos.b[0] + pos.end[0]) / 2 + 6, (pos.b[1] + pos.end[1]) / 2 + 14, congestionColour(flows.bToEnd));
  label(ctx, 'jams', (pos.b[0] + pos.end[0]) / 2 + 6, (pos.b[1] + pos.end[1]) / 2 + 27, DIM, 'center', '10px ui-monospace, monospace');
  label(ctx, `${state.params.fixedCost} min fixed`, (pos.a[0] + pos.end[0]) / 2 + 10, (pos.a[1] + pos.end[1]) / 2 - 16, DIM, 'center', '10px ui-monospace, monospace');
  label(ctx, `${state.params.fixedCost} min fixed`, (pos.start[0] + pos.b[0]) / 2 - 10, (pos.start[1] + pos.b[1]) / 2 + 18, DIM, 'center', '10px ui-monospace, monospace');
  label(
    ctx,
    state.shortcutOpen ? 'the free shortcut' : 'shortcut closed',
    pos.a[0] + 58,
    (pos.a[1] + pos.b[1]) / 2,
    state.shortcutOpen ? FREE : '#5f5a52',
    'center',
    '11px ui-monospace, monospace',
  );

  const routeColours = [COOL, COOL, FREE];
  for (let route = 0; route < 3; route++) {
    if (state.counts[route] === 0 || total === 0) continue;
    const dots = Math.max(1, Math.round((state.counts[route] / total) * DOTS_PER_PANEL));
    const points = ROUTE_PATHS[route].map((key) => pos[key]);
    const speed = 0.16 / Math.max(0.2, costs[route] / 60);
    ctx.save();
    ctx.fillStyle = routeColours[route];
    for (let i = 0; i < dots; i++) {
      const t = ((i / dots + phase * speed) % 1 + 1) % 1;
      const [x, y] = alongPath(/** @type {[number, number][]} */ (points), t);
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const [key, name] of /** @type {[string, string][]} */ ([['start', 'HOME'], ['a', 'A'], ['b', 'B'], ['end', 'WORK']])) {
    const [x, y] = pos[key];
    ctx.save();
    ctx.fillStyle = '#15130f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, name.length > 1 ? 22 : 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    label(ctx, name, x, y, INK, 'center', '11px ui-monospace, monospace');
  }

  const rows = [
    [`via A  ${state.counts[ROUTE_TOP].toString().padStart(5)} drivers`, costs[0], COOL],
    [`via B  ${state.counts[ROUTE_BOTTOM].toString().padStart(5)} drivers`, costs[1], COOL],
  ];
  if (state.shortcutOpen) {
    rows.push([`shortcut ${state.counts[ROUTE_SHORTCUT].toString().padStart(3)} drivers`, costs[2], FREE]);
  }
  rows.forEach((row, i) => {
    const y = height - 46 + i * 15;
    label(ctx, String(row[0]), 12, y, /** @type {string} */ (row[2]), 'left', '11px ui-monospace, monospace');
    label(ctx, `${/** @type {number} */ (row[1]).toFixed(1)} min`, width - 12, y, /** @type {string} */ (row[2]), 'right', '11px ui-monospace, monospace');
  });
}

/** Depth in cm mapped onto the rig canvas. */
const RIG_MAX_DEPTH = 132;

/**
 * @param {number} depth
 * @param {number} height
 * @returns {number}
 */
function depthToY(depth, height) {
  const top = 26;
  return top + (depth / RIG_MAX_DEPTH) * (height - top - 42);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y0
 * @param {number} y1
 * @param {string} colour
 */
function coil(ctx, x, y0, y1, colour) {
  const turns = 9;
  const span = y1 - y0;
  const amplitude = Math.max(5, Math.min(15, 150 / Math.max(span, 12)) * 1.6);
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  const lead = Math.min(10, span * 0.12);
  ctx.lineTo(x, y0 + lead);
  const body = span - lead * 2;
  for (let i = 0; i <= turns * 2; i++) {
    const t = i / (turns * 2);
    ctx.lineTo(x + (i % 2 === 0 ? -amplitude : amplitude), y0 + lead + body * t);
  }
  ctx.lineTo(x, y1 - lead);
  ctx.lineTo(x, y1);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw the spring-and-string rig at its settled geometry, with a ghost line
 * marking where the weight sits in the other configuration.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {import('./braess-model.js').RigState} state
 * @param {number} ghostDepth Weight depth in the opposite configuration.
 */
export function drawRig(canvas, state, ghostDepth) {
  const { ctx, width, height } = prepare(canvas);
  const p = state.params;
  const mid = width * 0.5;
  const side = Math.min(96, width * 0.3);
  const ceilingY = depthToY(0, height);
  const tensions = rigTensions(state);

  ctx.save();
  ctx.strokeStyle = '#4a4640';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(mid - side - 26, ceilingY);
  ctx.lineTo(mid + side + 26, ceilingY);
  ctx.stroke();
  for (let x = mid - side - 26; x < mid + side + 26; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, ceilingY);
    ctx.lineTo(x - 7, ceilingY - 7);
    ctx.stroke();
  }
  ctx.restore();

  const yP = depthToY(state.lowerSpringTop, height);
  const yQ = depthToY(state.upperSpringBottom, height);
  const yW = depthToY(state.weight, height);
  const yGhost = depthToY(ghostDepth, height);

  segment(ctx, [mid - side, yGhost], [mid + side, yGhost], '#5f5a52', 1, true);
  label(
    ctx,
    state.linkIntact ? 'where it goes if you cut' : 'where it hung before',
    mid + side + 4,
    yGhost,
    '#7d776d',
    'left',
    '10px ui-monospace, monospace',
  );

  const tautColour = (tension) => (tension > 0.01 ? HOT : '#4a4640');
  segment(ctx, [mid - side, ceilingY], [mid - side, yQ], tautColour(tensions.safetyTop), tensions.safetyTop > 0.01 ? 2 : 1.2, tensions.safetyTop <= 0.01);
  segment(ctx, [mid - side, yQ], [mid, yQ], tautColour(tensions.safetyTop), tensions.safetyTop > 0.01 ? 2 : 1.2, tensions.safetyTop <= 0.01);
  segment(ctx, [mid + side, yP], [mid + side, yW], tautColour(tensions.safetyBottom), tensions.safetyBottom > 0.01 ? 2 : 1.2, tensions.safetyBottom <= 0.01);
  segment(ctx, [mid, yP], [mid + side, yP], tautColour(tensions.safetyBottom), tensions.safetyBottom > 0.01 ? 2 : 1.2, tensions.safetyBottom <= 0.01);

  coil(ctx, mid, ceilingY, yP, COOL);
  coil(ctx, mid, yQ, yW, COOL);

  if (state.linkIntact) {
    segment(ctx, [mid, yP], [mid, yQ], HOT, 3);
    label(ctx, 'link', mid + 16, (yP + yQ) / 2, HOT, 'left', '10px ui-monospace, monospace');
  } else {
    ctx.save();
    ctx.strokeStyle = '#5f5a52';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mid - 7, yP + 4);
    ctx.lineTo(mid + 7, yP + 12);
    ctx.moveTo(mid - 7, yQ - 12);
    ctx.lineTo(mid + 7, yQ - 4);
    ctx.stroke();
    ctx.restore();
    label(ctx, 'CUT', mid + 16, (yP + yQ) / 2, '#7d776d', 'left', '10px ui-monospace, monospace');
  }

  ctx.save();
  ctx.fillStyle = '#15130f';
  ctx.strokeStyle = FREE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(mid - 26, yW, 52, 26);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  label(ctx, `${p.load} N`, mid, yW + 13, FREE, 'center', '11px ui-monospace, monospace');

  label(ctx, `depth ${state.weight.toFixed(1)} cm`, mid, height - 14, INK, 'center', '12px ui-monospace, monospace');
  label(ctx, `each spring pulls ${tensions.upperSpring.toFixed(1)} N / ${tensions.lowerSpring.toFixed(1)} N`, mid, height - 30, DIM, 'center', '10px ui-monospace, monospace');
}
