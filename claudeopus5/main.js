// @ts-check

/**
 * Wires the simulation to the page. Holds no physics of its own: everything
 * numeric comes from `kuramoto.js`, so what the reader watches and what the
 * tests check are the same code.
 */

import { createSwarm, step, coherence, criticalCoupling, lorentzianFrequencies, makeRandom } from './kuramoto.js';
import { createRenderer } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

const POPULATION = 320;
const DT = 0.02;
// Five steps a frame puts a settle at roughly three seconds of watching. Two was
// faithful and unusable: dragging the slider meant waiting twelve seconds to find
// out whether anything had happened.
const STEPS_PER_FRAME = 5;
// 300 frames x 5 steps x dt = 30 seconds of simulated time, matching the caption.
const HISTORY_LENGTH = 300;

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function need(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element #${id}`);
  return element;
}

const couplingInput = /** @type {HTMLInputElement} */ (need('coupling'));
const spreadInput = /** @type {HTMLInputElement} */ (need('spread'));
const freezeInput = /** @type {HTMLInputElement} */ (need('freeze'));
const marker = need('coupling-marker');

const outputs = {
  coupling: need('coupling-out'),
  spread: need('spread-out'),
  r: need('r-value'),
  k: need('k-value'),
  kc: need('kc-value'),
  locked: need('locked-value'),
  status: need('status'),
};

const renderer = createRenderer({
  fireflies: /** @type {HTMLCanvasElement} */ (need('fireflies')),
  rotors: /** @type {HTMLCanvasElement} */ (need('rotors')),
  trace: /** @type {HTMLCanvasElement} */ (need('trace')),
  n: POPULATION,
});

let gamma = Number(spreadInput.value);
let coupling = Number(couplingInput.value);
let swarm = createSwarm({ n: POPULATION, gamma, seed: 11 });
/** @type {number[]} */
let history = [];
const scatterPhases = makeRandom(99);

function syncMarker() {
  const critical = criticalCoupling(gamma);
  const max = Number(couplingInput.max);
  marker.style.left = `${Math.min(100, (critical / max) * 100)}%`;
  outputs.kc.textContent = critical.toFixed(2);
}

/**
 * Replace the natural frequencies in place, keeping the phases the swarm has
 * already reached so the reader sees the threshold move rather than the whole
 * picture restarting.
 */
function applySpread() {
  const omega = lorentzianFrequencies(POPULATION, gamma);
  swarm.omega.set(omega);
  Object.assign(swarm, { gamma });
  syncMarker();
}

/**
 * @param {number} r
 * @returns {{ text: string, state: string }}
 */
function describeGrid(r) {
  if (r >= 0.55) return { text: 'grid synchronised \u00b7 swarm in unison', state: 'locked' };
  if (r >= 0.2) return { text: 'grid straining \u00b7 partial rhythm', state: 'strained' };
  return { text: 'grid dark \u00b7 every clock its own way', state: 'dark' };
}

function render() {
  const field = coherence(swarm.theta);
  history.push(field.r);
  if (history.length > HISTORY_LENGTH) history.shift();

  const mask = renderer.draw(
    { theta: swarm.theta, omega: swarm.omega, K: coupling, r: field.r, psi: field.psi, history },
    criticalCoupling(gamma),
  );

  let locked = 0;
  for (let i = 0; i < mask.length; i++) locked += mask[i];

  outputs.r.textContent = field.r.toFixed(2);
  outputs.k.textContent = coupling.toFixed(2);
  outputs.locked.textContent = `${Math.round((locked / POPULATION) * 100)}%`;

  const status = describeGrid(field.r);
  outputs.status.textContent = status.text;
  outputs.status.dataset.state = status.state;
}

function frame() {
  if (!freezeInput.checked) {
    for (let i = 0; i < STEPS_PER_FRAME; i++) step(swarm, coupling, DT);
  }
  render();
  requestAnimationFrame(frame);
}

couplingInput.addEventListener('input', () => {
  coupling = Number(couplingInput.value);
  outputs.coupling.textContent = coupling.toFixed(2);
});

spreadInput.addEventListener('input', () => {
  gamma = Number(spreadInput.value);
  outputs.spread.textContent = gamma.toFixed(2);
  applySpread();
});

need('knock').addEventListener('click', () => {
  for (let i = 0; i < swarm.n; i++) swarm.theta[i] = scatterPhases() * 2 * Math.PI;
});

need('reset').addEventListener('click', () => {
  swarm = createSwarm({ n: POPULATION, gamma, seed: 11 });
  history = [];
});

outputs.coupling.textContent = coupling.toFixed(2);
outputs.spread.textContent = gamma.toFixed(2);
syncMarker();
mountClaimsPanel({
  list: need('claims-list'),
  button: /** @type {HTMLButtonElement} */ (need('run-claims')),
  summary: need('claims-summary'),
});
// Paint once before the loop starts, so a page opened in a background tab shows a
// composed frame rather than an empty canvas until it is focused.
render();
window.addEventListener('resize', render);
requestAnimationFrame(frame);
