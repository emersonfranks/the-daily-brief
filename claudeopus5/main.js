// @ts-check
import {
  BusGas, makeRng, ensembleSpacings, sampleLevels, unfoldLevels,
  ksToCdf, poissonCdf, wignerCdf, gammaSpacingCdf, fitExponent, fractionBelow,
} from './spacings.js';
import { setupCanvas, drawRing, drawLadders, drawHistogram } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

const BUS_COUNT = 64;
const STEP_DT = 0.004;
const SUBSTEPS = 6;
const SAMPLE_EVERY = 15;
const SETTLE_FRAMES = 45;
const BUFFER_CAP = 12000;
const LADDER_SPAN = 36;
const DISPLAY_SIZE = 64;

/**
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function mustGet(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return /** @type {T} */ (el);
}

const ringCanvas = mustGet('ring');
const laddersCanvas = mustGet('ladders');
const histogramCanvas = mustGet('histogram');
const betaInput = /** @type {HTMLInputElement} */ (mustGet('beta'));
const betaValue = mustGet('beta-value');
const ensembleSelect = /** @type {HTMLSelectElement} */ (mustGet('ensemble'));
const modeAllPairs = mustGet('mode-allpairs');
const modeNearest = mustGet('mode-nearest');
const resetButton = mustGet('reset');
const verdict = mustGet('verdict');

const stats = {
  samples: mustGet('stat-samples'),
  wigner: mustGet('stat-ks-wigner'),
  poisson: mustGet('stat-ks-poisson'),
  gamma: mustGet('stat-ks-gamma'),
  near: mustGet('stat-near'),
  exponent: mustGet('stat-exponent'),
};

/** @type {{gas:BusGas, beta:number, mode:'nearest'|'allpairs', referenceBeta:1|2,
 *   buffer:Float64Array, filled:number, cursor:number, frame:number, settle:number,
 *   seed:number}} */
const state = {
  gas: new BusGas({ count: BUS_COUNT, beta: 2, mode: 'allpairs', rng: makeRng(20260828) }),
  beta: 2,
  mode: 'allpairs',
  referenceBeta: 2,
  buffer: new Float64Array(BUFFER_CAP),
  filled: 0,
  cursor: 0,
  frame: 0,
  settle: SETTLE_FRAMES,
  seed: 20260828,
};

/** @type {Map<1|2, {spacings:Float64Array, ticks:Float64Array}>} */
const references = new Map();

/**
 * @param {1|2} beta
 * @returns {{spacings:Float64Array, ticks:Float64Array}|undefined}
 */
function reference(beta) {
  return references.get(beta);
}

/**
 * @param {1|2} beta
 * @returns {void}
 */
function computeReference(beta) {
  if (references.has(beta)) return;
  const rng = makeRng(4400 + beta);
  const spacings = ensembleSpacings({ beta, size: 24, samples: 90, rng });
  const unfolded = unfoldLevels(sampleLevels(beta, DISPLAY_SIZE, rng));
  const start = Math.floor((DISPLAY_SIZE - LADDER_SPAN) / 2);
  const ticks = new Float64Array(LADDER_SPAN);
  const base = unfolded[start];
  for (let i = 0; i < LADDER_SPAN; i++) ticks[i] = unfolded[start + i] - base;
  references.set(beta, { spacings, ticks });
  render(true);
}

/** @returns {Float64Array} */
function collected() {
  return state.filled === BUFFER_CAP ? state.buffer : state.buffer.subarray(0, state.filled);
}

function clearSamples() {
  state.filled = 0;
  state.cursor = 0;
  state.settle = SETTLE_FRAMES;
}

/** @param {Float64Array} gaps */
function record(gaps) {
  for (let i = 0; i < gaps.length; i++) {
    state.buffer[state.cursor] = gaps[i];
    state.cursor = (state.cursor + 1) % BUFFER_CAP;
    if (state.filled < BUFFER_CAP) state.filled++;
  }
}

/** @returns {Float64Array} */
function busTicks() {
  const positions = state.gas.positions();
  const ticks = new Float64Array(positions.length);
  const base = positions[0] * BUS_COUNT;
  let n = 0;
  for (let i = 0; i < positions.length; i++) {
    const t = positions[i] * BUS_COUNT - base;
    if (t <= LADDER_SPAN) ticks[n++] = t;
  }
  return ticks.subarray(0, n);
}

/** @param {number} x @returns {string} */
function fmt(x) {
  return Number.isFinite(x) ? x.toFixed(3) : '—';
}

function updateReadout() {
  const samples = collected();
  stats.samples.textContent = String(samples.length);
  if (samples.length < 400) {
    for (const key of /** @type {const} */ (['wigner', 'poisson', 'gamma', 'near', 'exponent'])) {
      stats[key].textContent = '—';
    }
    verdict.textContent = 'Collecting gaps… the readouts appear once a few hundred have accumulated.';
    return;
  }
  const ksWigner = ksToCdf(samples, (s) => wignerCdf(s, state.referenceBeta));
  const ksPoisson = ksToCdf(samples, poissonCdf);
  const ksGamma = ksToCdf(samples, (s) => gammaSpacingCdf(s, state.beta));
  stats.wigner.textContent = fmt(ksWigner);
  stats.poisson.textContent = fmt(ksPoisson);
  stats.gamma.textContent = fmt(ksGamma);
  stats.near.textContent = `${(fractionBelow(samples, 0.2) * 100).toFixed(1)}%`;
  stats.exponent.textContent = fmt(fitExponent(samples).exponent);

  const options = [
    { label: `the nucleus (Wigner \u03b2=${state.referenceBeta})`, value: ksWigner },
    { label: 'a process with no repulsion at all (Poisson)', value: ksPoisson },
  ];
  if (state.beta >= 0.05) {
    options.push({
      label: 'a gas whose members only feel their neighbours (Gamma)',
      value: ksGamma,
    });
  }
  options.sort((a, b) => a.value - b.value);
  verdict.textContent =
    `Closest match right now: ${options[0].label}, at a distance of ${fmt(options[0].value)} `
    + `against ${fmt(options[1].value)} for the runner-up.`;
}

let ring = setupCanvas(/** @type {HTMLCanvasElement} */ (ringCanvas));
let ladders = setupCanvas(/** @type {HTMLCanvasElement} */ (laddersCanvas));
let plot = setupCanvas(/** @type {HTMLCanvasElement} */ (histogramCanvas));

function resize() {
  ring = setupCanvas(/** @type {HTMLCanvasElement} */ (ringCanvas));
  ladders = setupCanvas(/** @type {HTMLCanvasElement} */ (laddersCanvas));
  plot = setupCanvas(/** @type {HTMLCanvasElement} */ (histogramCanvas));
  render(true);
}

/** @param {boolean} withPlot */
function render(withPlot) {
  const spacings = state.gas.spacings();
  const ref = reference(state.referenceBeta);

  drawRing(ring.ctx, ring.width, ring.height, { positions: state.gas.positions(), spacings });

  drawLadders(ladders.ctx, ladders.width, ladders.height, {
    busTicks: busTicks(),
    levelTicks: ref ? ref.ticks : new Float64Array(0),
    span: LADDER_SPAN,
    ensembleLabel: state.referenceBeta === 2 ? 'GUE' : 'GOE',
    referenceReady: Boolean(ref),
  });

  if (withPlot) {
    drawHistogram(plot.ctx, plot.width, plot.height, {
      samples: collected(),
      reference: ref ? ref.spacings : new Float64Array(0),
      beta: state.beta,
      referenceBeta: state.referenceBeta,
      referenceReady: Boolean(ref),
    });
  }
}

function frame() {
  state.frame++;
  state.gas.step(STEP_DT, SUBSTEPS);

  if (state.settle > 0) state.settle--;
  else if (state.frame % SAMPLE_EVERY === 0) record(state.gas.spacings());

  render(state.frame % 6 === 0);
  if (state.frame % 30 === 0) updateReadout();

  requestAnimationFrame(frame);
}

/** @param {'nearest'|'allpairs'} mode */
function setMode(mode) {
  state.mode = mode;
  state.gas.setMode(mode);
  modeAllPairs.setAttribute('aria-pressed', String(mode === 'allpairs'));
  modeNearest.setAttribute('aria-pressed', String(mode === 'nearest'));
  clearSamples();
}

betaInput.addEventListener('input', () => {
  state.beta = Number(betaInput.value);
  betaValue.textContent = state.beta.toFixed(2);
  state.gas.setBeta(state.beta);
  clearSamples();
});

modeAllPairs.addEventListener('click', () => setMode('allpairs'));
modeNearest.addEventListener('click', () => setMode('nearest'));

ensembleSelect.addEventListener('change', () => {
  const value = Number(ensembleSelect.value) === 1 ? 1 : 2;
  state.referenceBeta = value;
  if (!references.has(value)) {
    window.setTimeout(() => computeReference(value), 0);
  }
});

resetButton.addEventListener('click', () => {
  state.seed += 1;
  state.gas = new BusGas({
    count: BUS_COUNT,
    beta: state.beta,
    mode: state.mode,
    rng: makeRng(state.seed),
  });
  clearSamples();
});

let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resize, 150);
});

betaValue.textContent = state.beta.toFixed(2);
mountClaimsPanel();
requestAnimationFrame(frame);
window.setTimeout(() => computeReference(2), 0);
