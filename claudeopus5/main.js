// @ts-check

/**
 * Entry point. Reads the two controls, rebuilds both systems, integrates them and paints.
 */

import {
  modalCovariance,
  varianceShares,
  softVisibility,
  reducedDrive,
  observableCovariance,
  correlationMatrix,
  maxAbsPairCorrelation,
  trace,
  createRun,
} from './modal.js';
import {
  stringSystem,
  communitySystem,
  communityBasis,
  alignmentFromDrivePoint,
  MODES,
  SIGMA_ENV,
  SIGMA_0,
} from './systems.js';
import { drawString, drawTraces, drawBars, drawLaw, AMBER, STEEL } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

const DT = 0.01;
const SUBSTEPS = 8;
/** Frames between history samples, so the trace window spans several tens of time units. */
const SAMPLE_EVERY = 3;
const HISTORY = 260;
const BASIS = communityBasis();

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
}

/**
 * @param {string} id
 * @returns {HTMLCanvasElement}
 */
function canvas(id) {
  return /** @type {HTMLCanvasElement} */ (el(id));
}

const driveInput = /** @type {HTMLInputElement} */ (el('drive'));
const epsInput = /** @type {HTMLInputElement} */ (el('epsilon'));
const freezeButton = el('freeze');

const params = new URLSearchParams(location.search);
if (params.has('drive')) driveInput.value = String(params.get('drive'));
if (params.has('eps')) epsInput.value = String(params.get('eps'));
/** Frames to run before freezing, for reproducible captures. Zero means never. */
const freezeAfter = params.has('freeze') ? Number(params.get('freeze')) || 900 : 0;

/** @param {number} t slider fraction */
const epsilonFrom = (t) => Math.pow(10, -5 + 5 * t);

let frozen = false;
let ticks = 0;

/** @type {number[][]} */
let history = [];

let state = build();

function build() {
  const driveX = Number(driveInput.value) / 3000;
  const epsilon = epsilonFrom(Number(epsInput.value) / 1000);
  const alignment = alignmentFromDrivePoint(driveX);

  const str = stringSystem(epsilon, driveX);
  const com = communitySystem(epsilon, alignment);

  const strC = modalCovariance(str.lambdas, str.p, SIGMA_ENV, SIGMA_0, true);
  const comC = modalCovariance(com.lambdas, com.p, SIGMA_ENV, SIGMA_0, false);
  const comSpecies = observableCovariance(BASIS, comC);

  const comRun = createRun({
    ...com,
    sigmaEnv: SIGMA_ENV,
    sigma0: SIGMA_0,
    seed: 90120260,
    shared: false,
  });

  history = [];
  for (let s = 0; s < HISTORY; s++) {
    for (let t = 0; t < SUBSTEPS * SAMPLE_EVERY; t++) comRun.step(DT);
    history.push(speciesFrom(comRun.amplitudes));
  }

  return {
    driveX,
    epsilon,
    alignment,
    str,
    com,
    strShares: varianceShares(strC),
    comShares: varianceShares(comC),
    strVisibility: softVisibility(strC, str.soft),
    comVisibility: softVisibility(comC, com.soft),
    strG: reducedDrive(str.lambdas, str.p, SIGMA_ENV, SIGMA_0, str.soft),
    comG: reducedDrive(com.lambdas, com.p, SIGMA_ENV, SIGMA_0, com.soft),
    maxCorr: maxAbsPairCorrelation(correlationMatrix(comSpecies)),
    strScale: 1.6 * Math.sqrt(trace(strC)),
    comScale: 1.7 * Math.sqrt(trace(comSpecies) / MODES),
    strRun: createRun({ ...str, sigmaEnv: SIGMA_ENV, sigma0: SIGMA_0, seed: 20260901, shared: true }),
    comRun,
  };
}

/**
 * @param {number[]} amplitudes modal amplitudes of the community
 * @returns {number[]} abundance deviation of each species
 */
function speciesFrom(amplitudes) {
  /** @type {number[]} */
  const species = [];
  for (let i = 0; i < MODES; i++) {
    let v = 0;
    for (let k = 0; k < MODES; k++) v += BASIS[i][k] * amplitudes[k];
    species.push(v);
  }
  return species;
}

function refresh() {
  state = build();
  paintReadouts();
}

/**
 * @param {number} v
 * @returns {string}
 */
function pct(v) {
  if (v >= 0.9995) return '100%';
  if (v < 0.001) return `${(v * 100).toFixed(3)}%`;
  return `${(v * 100).toFixed(1)}%`;
}

function paintReadouts() {
  el('alignmentOut').textContent = state.alignment.toFixed(3);
  el('epsOut').textContent =
    state.epsilon >= 0.01 ? state.epsilon.toFixed(3) : state.epsilon.toExponential(1);
  el('stringShare').textContent = pct(state.strVisibility);
  el('commShare').textContent = pct(state.comVisibility);
  el('maxCorr').textContent = state.maxCorr.toFixed(3);

  const loud = state.comVisibility > 0.5;
  const nearNode = state.alignment < 0.02;
  el('verdict').textContent = loud
    ? 'The soft mode now carries most of the fluctuation. Species move together; the classic ' +
      'warning is loud and an ecologist would see it.'
    : nearNode
      ? 'The community is exactly this close to its tipping point and its instruments say nothing. ' +
        'The soft mode is there; the environment is simply not pushing on it.'
      : 'The soft mode is present but subordinate: most of what you measure is the stiff modes ' +
        'shuffling. Move the drive point to change how much of the warning reaches the surface.';
  el('verdict').className = loud ? 'verdict loud' : nearNode ? 'verdict silent' : 'verdict';
}

function frame() {
  if (!frozen) {
    for (let s = 0; s < SUBSTEPS; s++) {
      state.strRun.step(DT);
      state.comRun.step(DT);
    }
    ticks++;
    if (ticks % SAMPLE_EVERY === 0) {
      history.push(speciesFrom(state.comRun.amplitudes));
      if (history.length > HISTORY) history.shift();
    }
    if (freezeAfter && ticks >= freezeAfter) setFrozen(true);
  }

  drawString(canvas('stringCanvas'), state.strRun.amplitudes, state.strScale, state.driveX);
  drawBars(canvas('stringBars'), state.strShares, state.str.soft, AMBER);
  drawTraces(canvas('commCanvas'), history, state.comScale);
  drawBars(canvas('commBars'), state.comShares, state.com.soft, STEEL);
  drawLaw(canvas('lawCanvas'), [
    { g: state.strG, visibility: state.strVisibility, colour: AMBER, label: 'string' },
    { g: state.comG, visibility: state.comVisibility, colour: STEEL, label: 'community' },
  ]);

  requestAnimationFrame(frame);
}

driveInput.addEventListener('input', refresh);
epsInput.addEventListener('input', refresh);

el('toNode').addEventListener('click', () => {
  driveInput.value = '1000';
  refresh();
});
el('offNode').addEventListener('click', () => {
  driveInput.value = '1500';
  refresh();
});
freezeButton.addEventListener('click', () => {
  setFrozen(!frozen);
});

/** @param {boolean} value */
function setFrozen(value) {
  frozen = value;
  freezeButton.textContent = frozen ? 'resume the simulation' : 'freeze the simulation';
  freezeButton.setAttribute('aria-pressed', String(frozen));
}

mountClaimsPanel(el('claims'));
paintReadouts();
requestAnimationFrame(frame);

if (params.has('proof')) {
  const runAll = el('claims').querySelector('button');
  if (runAll instanceof HTMLButtonElement) runAll.click();
}
