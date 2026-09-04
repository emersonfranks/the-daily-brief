// @ts-check
/**
 * All canvas drawing. Knows nothing about the simulation beyond the arrays it
 * is handed, so the domain module can be run headlessly without any of this.
 */

/** @typedef {import('./network.js').Graph} Graph */
/** @typedef {import('./network.js').SweepRow} SweepRow */

const PALETTE = {
  bg: '#0d1117',
  edgeLive: 'rgba(126, 231, 255, 0.30)',
  edgeGiant: 'rgba(126, 231, 255, 0.62)',
  edgeDead: 'rgba(120, 132, 150, 0.07)',
  nodeGiant: '#7ee7ff',
  nodeFringe: '#4a6272',
  nodeGone: '#ff5c7a',
  grid: 'rgba(148, 163, 184, 0.16)',
  text: '#94a3b8',
};

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ ctx: CanvasRenderingContext2D, w: number, h: number }}
 */
export function prepare(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, w, h);
  return { ctx, w, h };
}

/**
 * Draw one network panel.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Graph} graph
 * @param {{ x: Float64Array, y: Float64Array }} pos
 * @param {{
 *   edgeAlive: (edgeIndex: number) => boolean,
 *   nodeGone: (nodeIndex: number) => boolean,
 *   inGiant: (nodeIndex: number) => boolean,
 * }} state
 */
export function drawNetwork(canvas, graph, pos, state) {
  const { ctx, w, h } = prepare(canvas);
  const pad = 14;
  const size = Math.min(w, h) - pad * 2;
  const ox = (w - size) / 2;
  const oy = (h - size) / 2;
  /** @param {number} i */
  const px = (i) => ox + pos.x[i] * size;
  /** @param {number} i */
  const py = (i) => oy + pos.y[i] * size;

  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE.edgeDead;
  ctx.beginPath();
  for (let e = 0; e < graph.edges.length; e++) {
    if (state.edgeAlive(e)) continue;
    const [u, v] = graph.edges[e];
    ctx.moveTo(px(u), py(u));
    ctx.lineTo(px(v), py(v));
  }
  ctx.stroke();

  for (const giantPass of [false, true]) {
    ctx.strokeStyle = giantPass ? PALETTE.edgeGiant : PALETTE.edgeLive;
    ctx.lineWidth = giantPass ? 1.15 : 1;
    ctx.beginPath();
    for (let e = 0; e < graph.edges.length; e++) {
      if (!state.edgeAlive(e)) continue;
      const [u, v] = graph.edges[e];
      if (state.nodeGone(u) || state.nodeGone(v)) continue;
      const isGiant = state.inGiant(u) && state.inGiant(v);
      if (isGiant !== giantPass) continue;
      ctx.moveTo(px(u), py(u));
      ctx.lineTo(px(v), py(v));
    }
    ctx.stroke();
  }

  const maxDeg = Math.max(1, ...graph.degree);
  for (let i = 0; i < graph.n; i++) {
    const r = 1.5 + 3.4 * Math.sqrt(graph.degree[i] / maxDeg);
    const cx = px(i);
    const cy = py(i);
    if (state.nodeGone(i)) {
      ctx.strokeStyle = PALETTE.nodeGone;
      ctx.lineWidth = 1.1;
      const s = r * 0.95;
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = state.inGiant(i) ? PALETTE.nodeGiant : PALETTE.nodeFringe;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The two stacked charts: connected fraction against capacity for all three
 * conditions, and the attack-likeness curve underneath it.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {SweepRow[]} rows descending capacity
 * @param {number} currentCapacity
 */
export function drawCharts(canvas, rows, currentCapacity) {
  const { ctx, w, h } = prepare(canvas);
  const left = 68;
  const right = w - 14;
  const gap = 26;
  const topH = (h - gap - 54) * 0.58;
  const botH = h - gap - 54 - topH;
  const topY = 16;
  const botY = topY + topH + gap;

  const caps = rows.map((r) => r.capacity);
  const minCap = Math.min(...caps);
  const maxCap = Math.max(...caps);
  /** @param {number} c */
  const cx = (c) => left + ((maxCap - c) / (maxCap - minCap)) * (right - left);

  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = PALETTE.text;

  // ---- top chart: connected fraction ----
  /** @param {number} v */
  const ty = (v) => topY + (1 - v) * topH;
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.moveTo(left, ty(v));
    ctx.lineTo(right, ty(v));
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(v * 100)}%`, left - 6, ty(v) + 3);
  }
  ctx.textAlign = 'left';
  ctx.fillText('share of the network still connected in one piece', left + 2, topY - 4);

  /**
   * @param {(r: SweepRow) => number | null} pick
   * @param {string} colour
   * @param {number} width
   * @param {number[]} [dash]
   * @param {(v: number) => number} [scaleY]
   */
  const line = (pick, colour, width, dash = [], scaleY = ty) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    let started = false;
    for (const r of rows) {
      const v = pick(r);
      if (v === null || Number.isNaN(v)) {
        started = false;
        continue;
      }
      const X = cx(r.capacity);
      const Y = scaleY(v);
      if (started) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
      started = true;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Order matters: the teal control goes on last so that where it coincides with
  // the attention curve — which is most of the range, and is the whole finding —
  // its dashes stay visible on top rather than being painted over.
  line((r) => r.attack, '#ff5c7a', 1.6, [5, 4]);
  line((r) => r.attention, '#7ee7ff', 2.8);
  line((r) => r.control, '#5eead4', 1.5, [4, 5]);

  // ---- bottom chart: attack-likeness ----
  /** @param {number} v */
  const alphaY = (v) => {
    const clamped = Math.max(-0.3, Math.min(1.2, v));
    return botY + (1.2 - clamped) / 1.5 * botH;
  };
  ctx.strokeStyle = PALETTE.grid;
  for (const v of [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(left, alphaY(v));
    ctx.lineTo(right, alphaY(v));
    ctx.stroke();
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#5eead4';
  ctx.fillText('bad luck', left - 6, alphaY(0) + 3);
  ctx.fillStyle = '#ff5c7a';
  ctx.fillText('attack', left - 6, alphaY(1) + 3);
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'left';
  ctx.fillText('which of the two the attention network is behaving like', left + 2, botY - 4);

  line((r) => r.attackLikeness, '#facc15', 2.4, [], alphaY);

  // ---- shared x axis and the capacity marker ----
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cx(currentCapacity), topY);
  ctx.lineTo(cx(currentCapacity), botY + botH);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'center';
  for (const c of [maxCap, 30, 20, 14, 10, 6, minCap]) {
    if (c > maxCap || c < minCap) continue;
    ctx.fillText(String(c), cx(c), botY + botH + 16);
  }
  ctx.fillText('attention capacity  (fewer ties each person can sustain  \u2192)', (left + right) / 2, botY + botH + 31);
  ctx.textAlign = 'left';
}

export { PALETTE };
