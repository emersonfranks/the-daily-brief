// @ts-check
// Entry point. Owns UI state, builds a fixed random field per panel (so dragging
// the slider only ever *adds* sites — a monotone "rising" view), and calls the
// tested model for every physics decision.

import { analyze, spanningMask, spanningProbability, estimateThreshold, makeRng } from './percolation-model.js';
import { drawLattice, fitCanvas } from './renderer.js';
import { drawCurve } from './charts.js';
import { mountClaimsPanel } from './claims-panel.js';

/** @type {import('./renderer.js').Palette} */
const ROCK = { ground: '#241f1a', filled: '#4a4034', span: '#3f8dff', spanEdge: '#bcdcff' };
/** @type {import('./renderer.js').Palette} */
const FOREST = { ground: '#1a140c', filled: '#2f7d3f', span: '#ff7a2f', spanEdge: '#ffd59e' };

const rockCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('rock'));
const forestCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('forest'));
const chartCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('chart'));
const rockCtx = /** @type {CanvasRenderingContext2D} */ (rockCanvas.getContext('2d'));
const forestCtx = /** @type {CanvasRenderingContext2D} */ (forestCanvas.getContext('2d'));
const chartCtx = /** @type {CanvasRenderingContext2D} */ (chartCanvas.getContext('2d'));

const slider = /** @type {HTMLInputElement} */ (document.getElementById('density'));
const pOut = /** @type {HTMLElement} */ (document.getElementById('pval'));
const verdict = /** @type {HTMLElement} */ (document.getElementById('verdict'));
const rockStat = /** @type {HTMLElement} */ (document.getElementById('rockstat'));
const forestStat = /** @type {HTMLElement} */ (document.getElementById('foreststat'));
const thrOut = /** @type {HTMLElement} */ (document.getElementById('thrval'));

const state = {
  L: 48,
  p: 0.45,
  seedA: 1234,
  seedB: 8765,
  /** @type {Float32Array} */ fieldA: new Float32Array(0),
  /** @type {Float32Array} */ fieldB: new Float32Array(0),
  /** @type {number[]} */ ps: [],
  /** @type {number[]} */ probs: [],
  threshold: 0.593,
};

/** @param {number} seed @param {number} L */
function buildField(seed, L) {
  const rng = makeRng(seed);
  const f = new Float32Array(L * L);
  for (let i = 0; i < f.length; i++) f[i] = rng();
  return f;
}

/** @param {Float32Array} field @param {number} p */
function gridFromField(field, p) {
  const g = new Uint8Array(field.length);
  for (let i = 0; i < field.length; i++) g[i] = field[i] < p ? 1 : 0;
  return g;
}

function rebuildStructure() {
  const L = state.L;
  fitCanvas(rockCanvas, L, 380);
  fitCanvas(forestCanvas, L, 380);
  state.fieldA = buildField(state.seedA, L);
  state.fieldB = buildField(state.seedB, L);
  state.threshold = estimateThreshold(L, 120, makeRng(state.seedA ^ (L * 7919)));
  thrOut.textContent = state.threshold.toFixed(3);
  // Spanning-probability curve for this size (Monte Carlo).
  const steps = 60;
  const trials = L >= 72 ? 30 : 45;
  state.ps = [];
  state.probs = [];
  const rng = makeRng(20260821 ^ L);
  for (let s = 0; s <= steps; s++) {
    const p = s / steps;
    state.ps.push(p);
    state.probs.push(spanningProbability(L, p, trials, rng));
  }
}

function render() {
  const { L, p } = state;
  const gridA = gridFromField(state.fieldA, p);
  const gridB = gridFromField(state.fieldB, p);
  const maskA = spanningMask(gridA, L);
  const maskB = spanningMask(gridB, L);
  drawLattice(rockCtx, gridA, maskA, L, ROCK);
  drawLattice(forestCtx, gridB, maskB, L, FOREST);

  const a = analyze(gridA, L);
  const b = analyze(gridB, L);
  pOut.textContent = p.toFixed(3);
  rockStat.textContent = a.spans ? 'fluid breaks through' : 'no path — sealed';
  rockStat.className = 'stat ' + (a.spans ? 'on' : 'off');
  forestStat.textContent = b.spans ? 'fire crosses' : 'burn dies out';
  forestStat.className = 'stat ' + (b.spans ? 'on' : 'off');

  const both = a.spans && b.spans;
  const neither = !a.spans && !b.spans;
  verdict.textContent = both
    ? 'BOTH CONNECTED'
    : neither
      ? 'BOTH SEALED'
      : 'ON THE EDGE — one crossed, one did not';
  verdict.className = 'verdict ' + (both ? 'both' : neither ? 'none' : 'edge');

  drawCurve(chartCtx, state.ps, state.probs, p, state.threshold);
}

slider.addEventListener('input', () => {
  state.p = Number(slider.value) / 1000;
  render();
});

document.querySelectorAll('[data-size]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.L = Number(/** @type {HTMLElement} */ (btn).dataset.size);
    document.querySelectorAll('[data-size]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    rebuildStructure();
    render();
  });
});

document.getElementById('reseed')?.addEventListener('click', () => {
  state.seedA = (Math.random() * 1e9) | 0;
  state.seedB = (Math.random() * 1e9) | 0;
  rebuildStructure();
  render();
});

document.querySelectorAll('.accordion > button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const panel = btn.parentElement;
    panel?.classList.toggle('open');
  });
});

// Chart canvas is fixed-size in CSS pixels; set backing store once.
chartCanvas.width = 560;
chartCanvas.height = 200;

mountClaimsPanel(document.getElementById('claims-root'));

rebuildStructure();
render();
