// @ts-check

/**
 * Wires the two simulations to the canvases and the controls. This file owns the
 * animation loop and the DOM; the simulations themselves live in `rsa.js` and
 * know nothing about either.
 */

import {
  createKerb,
  createMembrane,
  attemptPark,
  attemptPolitePark,
  attemptAdsorb,
  kerbCoverage,
  membraneCoverage,
  kerbTime,
  membraneTime,
  makeRandom,
  RENYI_CONSTANT,
  DISK_JAMMING_COVERAGE,
  PALASTI_CONJECTURE,
} from './rsa.js';
import { fitCanvas, drawKerb, drawMembrane, drawChart } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

const KERB_LENGTH = 144;
const KERB_ROWS = 6;
const MEMBRANE_SIZE = 24;
const TIME_PER_FRAME = 0.35;
const STALL_TIME = 2000;

/** @param {string} id */
const el = (id) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
};

const kerbCanvas = /** @type {HTMLCanvasElement} */ (el('kerb-canvas'));
const membraneCanvas = /** @type {HTMLCanvasElement} */ (el('membrane-canvas'));
const chartCanvas = /** @type {HTMLCanvasElement} */ (el('chart-canvas'));
const playButton = /** @type {HTMLButtonElement} */ (el('play'));
const stallButton = /** @type {HTMLButtonElement} */ (el('to-stall'));
const resetButton = /** @type {HTMLButtonElement} */ (el('reset'));
const speedInput = /** @type {HTMLInputElement} */ (el('speed'));
const politeInput = /** @type {HTMLInputElement} */ (el('polite'));

const world = {
  kerb: createKerb(KERB_LENGTH),
  membrane: createMembrane(MEMBRANE_SIZE),
  kerbRandom: makeRandom(11),
  membraneRandom: makeRandom(11),
  /** @type {{ aim: number, age: number }[]} */ kerbMisses: [],
  /** @type {{ x: number, y: number, age: number }[]} */ membraneMisses: [],
  /** @type {{ t: number, coverage: number }[]} */ kerbTrace: [],
  /** @type {{ t: number, coverage: number }[]} */ membraneTrace: [],
  time: 0,
  running: true,
  polite: false,
};

function reset() {
  const seed = 11 + Math.floor(Math.random() * 1000);
  world.kerb = createKerb(KERB_LENGTH);
  world.membrane = createMembrane(MEMBRANE_SIZE);
  world.kerbRandom = makeRandom(seed);
  world.membraneRandom = makeRandom(seed + 1);
  world.kerbMisses = [];
  world.membraneMisses = [];
  world.kerbTrace = [];
  world.membraneTrace = [];
  world.time = 0;
}

/** @param {number} dt advance in dimensionless RSA time */
function advance(dt) {
  world.time += dt;
  const kerb = world.kerb;
  const kerbTarget = world.time * kerb.length;
  let guard = 0;
  while (kerb.attempts < kerbTarget && !kerb.jammed && guard < 40000) {
    guard += 1;
    const parked = world.polite
      ? attemptPolitePark(kerb, world.kerbRandom)
      : attemptPark(kerb, world.kerbRandom);
    if (!parked) world.kerbMisses.push({ aim: kerb.lastAim, age: 0 });
  }

  const membrane = world.membrane;
  const perTime = (membrane.size * membrane.size) / (Math.PI * membrane.radius * membrane.radius);
  const membraneTarget = world.time * perTime;
  guard = 0;
  while (membrane.attempts < membraneTarget && guard < 60000) {
    guard += 1;
    if (!attemptAdsorb(membrane, world.membraneRandom)) {
      world.membraneMisses.push({ x: membrane.lastAimX, y: membrane.lastAimY, age: 0 });
    }
  }

  world.kerbMisses = world.kerbMisses.slice(-14).map((m) => ({ ...m, age: m.age + 1 })).filter((m) => m.age < 18);
  world.membraneMisses = world.membraneMisses.slice(-18).map((m) => ({ ...m, age: m.age + 1 })).filter((m) => m.age < 18);

  if (world.time > 0) {
    world.kerbTrace.push({ t: kerbTime(kerb), coverage: kerbCoverage(kerb) });
    world.membraneTrace.push({ t: membraneTime(membrane), coverage: membraneCoverage(membrane) });
    if (world.kerbTrace.length > 4000) world.kerbTrace = world.kerbTrace.filter((_, i) => i % 2 === 0);
    if (world.membraneTrace.length > 4000) world.membraneTrace = world.membraneTrace.filter((_, i) => i % 2 === 0);
  }
}

/** @param {number} value @param {number} [dp] */
const pct = (value, dp = 1) => `${(value * 100).toFixed(dp)}%`;

function paint() {
  const kerbCtx = fitCanvas(kerbCanvas);
  drawKerb(
    kerbCtx,
    world.kerb,
    KERB_ROWS,
    world.kerbMisses,
    kerbCanvas.getBoundingClientRect().width,
    kerbCanvas.getBoundingClientRect().height,
  );

  const membraneCtx = fitCanvas(membraneCanvas);
  drawMembrane(
    membraneCtx,
    world.membrane,
    world.membraneMisses,
    membraneCanvas.getBoundingClientRect().width,
    membraneCanvas.getBoundingClientRect().height,
  );

  const chartCtx = fitCanvas(chartCanvas);
  drawChart(
    chartCtx,
    [
      { label: 'kerb', colour: '#e8743b', points: world.kerbTrace },
      { label: 'membrane', colour: '#3d8fd1', points: world.membraneTrace },
    ],
    [
      { label: `74.76% kerb`, colour: '#e8743b', value: RENYI_CONSTANT },
      { label: `55.89% Palásti`, colour: '#9d8cd4', value: PALASTI_CONJECTURE, dashed: true },
      { label: `54.71% discs`, colour: '#3d8fd1', value: DISK_JAMMING_COVERAGE },
    ],
    chartCanvas.getBoundingClientRect().width,
    chartCanvas.getBoundingClientRect().height,
  );

  el('kerb-coverage').textContent = pct(kerbCoverage(world.kerb));
  el('kerb-cars').textContent = String(world.kerb.cars.length);
  el('kerb-attempts').textContent = world.kerb.attempts.toLocaleString();
  el('kerb-waste').textContent = pct(1 - kerbCoverage(world.kerb));
  el('membrane-coverage').textContent = pct(membraneCoverage(world.membrane));
  el('membrane-discs').textContent = String(world.membrane.xs.length);
  el('membrane-attempts').textContent = world.membrane.attempts.toLocaleString();
  el('membrane-waste').textContent = pct(1 - membraneCoverage(world.membrane));
  el('clock').textContent = world.time.toFixed(1);
}

function frame() {
  if (world.running) advance(TIME_PER_FRAME * Number(speedInput.value));
  paint();
  requestAnimationFrame(frame);
}

playButton.addEventListener('click', () => {
  world.running = !world.running;
  playButton.textContent = world.running ? 'Pause' : 'Resume';
});

resetButton.addEventListener('click', () => {
  reset();
  paint();
});

stallButton.addEventListener('click', () => {
  const wasRunning = world.running;
  world.running = false;
  stallButton.disabled = true;
  stallButton.textContent = 'Running…';
  const tick = () => {
    for (let i = 0; i < 30 && world.time < STALL_TIME; i += 1) advance(4);
    paint();
    if (world.time < STALL_TIME) {
      requestAnimationFrame(tick);
      return;
    }
    stallButton.disabled = false;
    stallButton.textContent = 'Fast-forward to the stall';
    world.running = wasRunning;
  };
  requestAnimationFrame(tick);
});

politeInput.addEventListener('change', () => {
  world.polite = politeInput.checked;
  // The two rules are different processes, so the street starts again rather
  // than carrying over a layout that the other rule produced.
  reset();
  paint();
});

window.addEventListener('resize', paint);

mountClaimsPanel(el('claims-root'));
// A fresh street on every load: the ceiling should not depend on which one.
reset();
paint();
requestAnimationFrame(frame);
