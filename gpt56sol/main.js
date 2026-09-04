// @ts-check

import { networkThroughput, reactions } from './network.js';
import { drawNetwork } from './renderer.js';
import { wireClaims } from './claims-panel.js';

const support = /** @type {HTMLInputElement} */ (document.querySelector('#support'));
const supportReadout = /** @type {HTMLElement} */ (document.querySelector('#support-readout'));
const lineageButtons = [...document.querySelectorAll('[data-lineage]')];
const shockButton = /** @type {HTMLButtonElement} */ (document.querySelector('#shock'));
const resetButton = /** @type {HTMLButtonElement} */ (document.querySelector('#reset'));
const freezeButton = /** @type {HTMLButtonElement} */ (document.querySelector('#freeze'));
const cellCanvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#cell-canvas'));
const townCanvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#town-canvas'));
const flowReadout = /** @type {HTMLElement} */ (document.querySelector('#flow-readout'));
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const claimsRoot = /** @type {HTMLElement} */ (document.querySelector('#claims-results'));
const claimsButton = /** @type {HTMLButtonElement} */ (document.querySelector('#run-claims'));

/** @type {import('./network.js').State} */
const state = { support: 0.58, lineage: 'bacteria', damaged: null };
const query = new URLSearchParams(window.location.search);
const captureMode = query.has('capture');
if (query.has('proof')) document.body.classList.add('proof-only');
let phase = captureMode ? 0.37 : 0;
let running = !captureMode;
let previous = performance.now();

function render() {
  support.value = String(Math.round(state.support * 100));
  supportReadout.textContent = `${Math.round(state.support * 100)}%`;
  const flow = networkThroughput(state);
  flowReadout.textContent = `${Math.round(flow * 100)}%`;
  flowReadout.classList.toggle('warning', flow < 0.99);
  status.textContent = state.damaged === null
    ? 'Every essential job is covered. The flow survives the handoff.'
    : flow < 0.99
      ? 'One local machine is offline. Restore shared support to rescue the flow.'
      : 'The vent / utility grid is covering the broken local machine.';
  lineageButtons.forEach((button) => {
    button.classList.toggle('active', button.getAttribute('data-lineage') === state.lineage);
  });
  drawNetwork(cellCanvas, state, 'cell', phase);
  drawNetwork(townCanvas, state, 'town', phase);
}

function frame(now) {
  if (running) phase = (phase + Math.min(40, now - previous) / 3600) % 1;
  previous = now;
  render();
  requestAnimationFrame(frame);
}

support.addEventListener('input', () => {
  state.support = Number(support.value) / 100;
  render();
});

lineageButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.lineage = /** @type {import('./network.js').Lineage} */ (button.getAttribute('data-lineage'));
    render();
  });
});

shockButton.addEventListener('click', () => {
  state.damaged = state.damaged === null
    ? reactions.findIndex((reaction) => !reaction.inherited)
    : null;
  shockButton.textContent = state.damaged === null ? 'Break one local machine' : 'Repair local machine';
  render();
});

resetButton.addEventListener('click', () => {
  state.support = 0.58;
  state.lineage = 'bacteria';
  state.damaged = null;
  shockButton.textContent = 'Break one local machine';
  render();
});

freezeButton.addEventListener('click', () => {
  running = !running;
  freezeButton.textContent = running ? 'Freeze motion' : 'Resume motion';
});

wireClaims(claimsRoot, claimsButton);
if (captureMode) {
  freezeButton.textContent = 'Resume motion';
  claimsButton.click();
}
render();
requestAnimationFrame(frame);
