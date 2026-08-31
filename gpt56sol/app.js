// @ts-check

import { runScenario } from './network.js';
import { createNetworkRenderer } from './renderer.js';

const ecologyCanvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#ecology'));
const softwareCanvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#software'));
const stressInput = /** @type {HTMLInputElement} */ (document.querySelector('#stress'));
const pruningInput = /** @type {HTMLInputElement} */ (document.querySelector('#prune'));
const stressOutput = /** @type {HTMLOutputElement} */ (document.querySelector('#stress-output'));
const progress = /** @type {HTMLElement} */ (document.querySelector('#progress'));
const phase = /** @type {HTMLElement} */ (document.querySelector('#phase'));
const pauseButton = /** @type {HTMLButtonElement} */ (document.querySelector('#pause'));
const replayButton = /** @type {HTMLButtonElement} */ (document.querySelector('#replay'));
const ecologyRenderer = createNetworkRenderer(ecologyCanvas, 'ecology');
const softwareRenderer = createNetworkRenderer(softwareCanvas, 'software');

let frame = 0;
let running = true;
let previousTime = 0;
let ecologicalRun = runScenario(6151, 'connected');
let softwareRun = runScenario(6151, 'pruned');

function rebuild() {
  const scale = Number(stressInput.value) / 100;
  const policy = pruningInput.checked ? 'pruned' : 'connected';
  ecologicalRun = runScenario(6151, 'connected', scale);
  softwareRun = runScenario(6151, policy, scale);
  stressOutput.value = `${stressInput.value}%`;
  frame = 0;
  running = true;
  pauseButton.innerHTML = '&#10074;&#10074;';
  pauseButton.setAttribute('aria-label', 'Pause experiment');
  pauseButton.title = 'Pause experiment';
}

function render() {
  ecologyRenderer.draw(ecologicalRun, frame);
  softwareRenderer.draw(softwareRun, frame);
  const ecologicalSnapshot = ecologicalRun.snapshots[frame];
  const softwareSnapshot = softwareRun.snapshots[frame];
  if (!ecologicalSnapshot || !softwareSnapshot) return;
  const stage = frame < 45 ? 'baseline' : frame < 95 ? 'stress pulse' : 'remnant';
  phase.textContent = stage;
  progress.style.width = `${frame / (ecologicalRun.snapshots.length - 1) * 100}%`;
  const readings = new Map([
    ['eco-active', String(ecologicalSnapshot.active)],
    ['eco-health', ecologicalSnapshot.meanHealth.toFixed(2)],
    ['soft-active', String(softwareSnapshot.active)],
    ['soft-health', softwareSnapshot.meanHealth.toFixed(2)],
  ]);
  for (const [id, value] of readings) {
    const target = document.querySelector(`#${id}`);
    if (target) target.textContent = value;
  }
}

/** @param {number} time */
function animate(time) {
  if (running && time - previousTime > 36) {
    frame = Math.min(frame + 1, ecologicalRun.snapshots.length - 1);
    previousTime = time;
    if (frame === ecologicalRun.snapshots.length - 1) running = false;
  }
  render();
  requestAnimationFrame(animate);
}

stressInput.addEventListener('input', rebuild);
pruningInput.addEventListener('change', rebuild);
replayButton.addEventListener('click', rebuild);
pauseButton.addEventListener('click', () => {
  running = !running;
  pauseButton.innerHTML = running ? '&#10074;&#10074;' : '&#9654;';
  pauseButton.setAttribute('aria-label', running ? 'Pause experiment' : 'Resume experiment');
  pauseButton.title = running ? 'Pause experiment' : 'Resume experiment';
});
requestAnimationFrame(animate);
