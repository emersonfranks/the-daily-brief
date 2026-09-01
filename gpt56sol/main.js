// @ts-check

import { createExperiment } from './memory.js';
import { createRenderer } from './renderer.js';
import { wireClaimsPanel } from './claims-panel.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#memory-canvas'));
const amplitudeInput = /** @type {HTMLInputElement} */ (document.querySelector('#amplitude'));
const separationInput = /** @type {HTMLInputElement} */ (document.querySelector('#separation'));
const amplitudeValue = /** @type {HTMLOutputElement} */ (document.querySelector('#amplitude-value'));
const separationValue = /** @type {HTMLOutputElement} */ (document.querySelector('#separation-value'));
const netValue = /** @type {HTMLElement} */ (document.querySelector('#net-value'));
const momentValue = /** @type {HTMLElement} */ (document.querySelector('#moment-value'));
const memoryValue = /** @type {HTMLElement} */ (document.querySelector('#memory-value'));
const directionValue = /** @type {HTMLElement} */ (document.querySelector('#direction-value'));
const orderButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('[data-order]'));
const claimsRoot = /** @type {HTMLElement} */ (document.querySelector('#claims-results'));
const claimsButton = /** @type {HTMLButtonElement} */ (document.querySelector('#run-claims'));
const renderer = createRenderer(canvas);
let order = /** @type {import('./memory.js').PulseOrder} */ ('credit-first');
let currentExperiment = createExperiment({ amplitude: 3, separation: 8, order });

function render() {
  const amplitude = Number(amplitudeInput.value);
  const separation = Number(separationInput.value);
  currentExperiment = createExperiment({ amplitude, separation, order });
  amplitudeValue.value = `${amplitude} units`;
  separationValue.value = `${separation} units`;
  netValue.textContent = currentExperiment.net.toExponential(2);
  momentValue.textContent = currentExperiment.firstMoment.toFixed(2);
  memoryValue.textContent = `${currentExperiment.memory >= 0 ? '+' : ''}${currentExperiment.memory.toFixed(2)}`;
  directionValue.textContent = currentExperiment.memory >= 0 ? 'positive held first' : 'negative held first';
  renderer.draw(currentExperiment);
}

amplitudeInput.addEventListener('input', render);
separationInput.addEventListener('input', render);
for (const button of orderButtons) {
  button.addEventListener('click', () => {
    order = /** @type {import('./memory.js').PulseOrder} */ (button.dataset.order);
    for (const candidate of orderButtons) {
      const selected = candidate === button;
      candidate.classList.toggle('selected', selected);
      candidate.setAttribute('aria-pressed', String(selected));
    }
    render();
  });
}

new ResizeObserver(render).observe(canvas);
wireClaimsPanel(claimsRoot, claimsButton);
render();