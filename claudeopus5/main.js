// @ts-check

import { GrainModel, RateAccumulator } from './grain-model.js';
import { createRenderer } from './renderer.js';
import { drawRateChart, drawSideHistogram } from './charts.js';

const CENSUS_INTERVAL = 8;
const WARMUP_SWEEPS = 100;
const RESEED_BELOW = 45;
const PUBLISHED_K = 0.539;

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function mustGet(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element #${id}`);
  return element;
}

/**
 * @param {string} id
 * @returns {HTMLCanvasElement}
 */
function mustGetCanvas(id) {
  const element = mustGet(id);
  if (!(element instanceof HTMLCanvasElement)) throw new Error(`#${id} is not a canvas`);
  return element;
}

const shell = mustGet('shell');
const world = mustGetCanvas('world');
const dividerHandle = mustGet('divider');
const hud = mustGet('hud');
const rateChart = mustGetCanvas('c-rate');
const histogramChart = mustGetCanvas('c-hist');

const model = new GrainModel({ size: 300, seeds: 1000, seed: (Date.now() & 0x7fffffff) || 1 });
const rates = new RateAccumulator();
const renderer = createRenderer(world, model);

const view = { divide: 0.5, fateMode: false, tracked: -1 };
let trackedDiedAt = -1;
let running = true;
let sweepsPerFrame = 2;
/** @type {import('./grain-model.js').Fit | null} */
let currentFit = null;

function restart() {
  model.reset();
  rates.bins.clear();
  currentFit = null;
  view.tracked = -1;
  trackedDiedAt = -1;
}

function updatePanel() {
  mustGet('s-t').textContent = String(model.time);
  mustGet('s-live').textContent = String(model.live);
  mustGet('s-n').textContent = model.live ? model.meanSides.toFixed(3) : '\u2014';
  mustGet('s-dead').textContent = String(model.deaths);
  mustGet('s-k').textContent = currentFit ? currentFit.slope.toFixed(3) : '\u2014';
  mustGet('s-r2').textContent = currentFit ? currentFit.r2.toFixed(4) : '\u2014';
  drawRateChart(rateChart, rates, currentFit);
  drawSideHistogram(histogramChart, model);
}

function updateHud() {
  const tracked = view.tracked;
  if (tracked < 0) {
    hud.innerHTML = '<div class="verdict hold">Click a cell to sentence it.</div>';
    return;
  }
  if (model.area[tracked] === 0) {
    hud.innerHTML = `<div class="verdict shrink">Cell ${tracked} &mdash; DIED at sweep ${trackedDiedAt}.</div>` +
      'It ran out of neighbours. Click another.';
    return;
  }
  const sides = model.sides[tracked];
  const delta = sides - 6;
  const tone = delta > 0 ? 'grow' : delta < 0 ? 'shrink' : 'hold';
  const verdict = delta > 0 ? 'GROWING' : delta < 0 ? 'DYING' : 'HOLDING';
  const k = currentFit ? currentFit.slope : PUBLISHED_K;
  hud.innerHTML = `<div class="verdict ${tone}">Cell ${tracked} &middot; ${sides} sides &middot; ${verdict}</div>` +
    `area ${model.area[tracked]} sites &nbsp;&middot;&nbsp; law says dA/dt = ${(k * delta).toFixed(2)} sites/sweep`;
}

function step() {
  for (let i = 0; i < sweepsPerFrame; i++) {
    model.sweep();
    if (model.time % CENSUS_INTERVAL === 0) {
      model.census();
      if (model.time > WARMUP_SWEEPS) {
        rates.record(model);
        currentFit = rates.fit({ min: 5, max: 9 });
      }
      if (view.tracked >= 0 && model.area[view.tracked] === 0 && trackedDiedAt < 0) {
        trackedDiedAt = model.time;
      }
    }
  }
  if (model.live < RESEED_BELOW) restart();
}

function frame() {
  if (running) step();
  renderer.draw(view);
  updatePanel();
  updateHud();
  requestAnimationFrame(frame);
}

function placeDivider() {
  dividerHandle.style.left = `${view.divide * 100}%`;
}

let dragging = false;
dividerHandle.addEventListener('pointerdown', (event) => {
  dragging = true;
  dividerHandle.setPointerCapture(event.pointerId);
  event.preventDefault();
});
dividerHandle.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const bounds = shell.getBoundingClientRect();
  view.divide = Math.min(0.96, Math.max(0.04, (event.clientX - bounds.left) / bounds.width));
  placeDivider();
});
dividerHandle.addEventListener('pointerup', (event) => {
  dragging = false;
  dividerHandle.releasePointerCapture(event.pointerId);
});

world.addEventListener('click', (event) => {
  const cell = renderer.cellAt(event.clientX, event.clientY);
  if (cell < 0) return;
  view.tracked = cell;
  trackedDiedAt = -1;
});

const playButton = mustGet('b-play');
playButton.addEventListener('click', () => {
  running = !running;
  playButton.textContent = running ? 'Pause' : 'Run';
  playButton.setAttribute('aria-pressed', String(running));
});

const fateButton = mustGet('b-fate');
fateButton.addEventListener('click', () => {
  view.fateMode = !view.fateMode;
  fateButton.setAttribute('aria-pressed', String(view.fateMode));
});

mustGet('b-reset').addEventListener('click', restart);

mustGet('r-speed').addEventListener('input', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement) sweepsPerFrame = Number(target.value);
});

window.addEventListener('resize', renderer.resize);

mustGet('boot').remove();
renderer.resize();
placeDivider();
frame();
