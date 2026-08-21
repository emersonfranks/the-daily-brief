// @ts-check

import { createCascade, positiveShare, seedPatch, settle } from "./cascade-model.js";
import { connectClaimsPanel } from "./claims-panel.js";
import { drawBank, drawMagnet, drawTrace } from "./renderer.js";

/**
 * @template {HTMLElement} T
 * @param {string} selector
 * @param {{ new (): T }} type
 * @returns {T}
 */
function required(selector, type) {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const size = 34;
let seed = 2654435761;
let pressure = 0.8;
let cascade = createCascade(size, seed, 0.72, 1);

const magnetCanvas = required("#magnet-canvas", HTMLCanvasElement);
const bankCanvas = required("#bank-canvas", HTMLCanvasElement);
const traceCanvas = required("#trace-canvas", HTMLCanvasElement);
const pressureInput = required("#pressure", HTMLInputElement);
const pressureOutput = required("#pressure-output", HTMLOutputElement);
const magnetShare = required("#magnet-share", HTMLElement);
const bankShare = required("#bank-share", HTMLElement);
const shockButton = required("#shock", HTMLButtonElement);
const resetButton = required("#reset", HTMLButtonElement);

function render() {
  drawMagnet(magnetCanvas, cascade.state, cascade.resistance, cascade.size);
  drawBank(bankCanvas, cascade.state, cascade.resistance, cascade.size);
  const share = positiveShare(cascade);
  magnetShare.textContent = `${Math.round(share * 100)}%`;
  bankShare.textContent = `${Math.round(share * 100)}%`;
  pressureOutput.textContent = pressure > 0 ? `+${Math.round(pressure * 100)}` : `${Math.round(pressure * 100)}`;
}

function rebuild(initialState = /** @type {1 | -1} */ (pressure >= 0 ? 1 : -1)) {
  const selected = required('input[name="coupling"]:checked', HTMLInputElement);
  cascade = createCascade(size, seed, Number(selected.value), initialState);
  settle(cascade, pressure);
  render();
}

pressureInput.addEventListener("input", () => {
  pressure = Number(pressureInput.value) / 100;
  settle(cascade, pressure);
  render();
});

document.querySelectorAll('input[name="coupling"]').forEach((input) => {
  input.addEventListener("change", () => rebuild());
});

shockButton.addEventListener("click", () => {
  seedPatch(cascade, Math.floor(size / 2) * size + Math.floor(size / 2), 3.6, -1);
  settle(cascade, pressure);
  render();
});

resetButton.addEventListener("click", () => {
  seed = (seed + 0x9e3779b9) >>> 0;
  rebuild(1);
});

const resizeObserver = new ResizeObserver(() => {
  render();
  drawTrace(traceCanvas);
});
resizeObserver.observe(magnetCanvas);
resizeObserver.observe(traceCanvas);

connectClaimsPanel(required("#claim-results", HTMLElement), required("#run-claims", HTMLButtonElement));
settle(cascade, pressure);
render();
drawTrace(traceCanvas);