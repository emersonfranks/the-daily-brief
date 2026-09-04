// @ts-check

import { advance, createCuts, createState, farEdgeMean } from "./transport.js";
import { createRenderer } from "./renderer.js";
import { wireClaims } from "./claims-panel.js";

const slider = /** @type {HTMLInputElement} */ (document.querySelector("#coherence"));
const patternLabel = /** @type {HTMLElement} */ (document.querySelector("#pattern-label"));
const stepLabel = /** @type {HTMLElement} */ (document.querySelector("#step-value"));
const arrivalLabel = /** @type {HTMLElement} */ (document.querySelector("#arrival-value"));
const rockCanvas = /** @type {HTMLCanvasElement} */ (document.querySelector("#rock-canvas"));
const relayCanvas = /** @type {HTMLCanvasElement} */ (document.querySelector("#relay-canvas"));
const resetButton = /** @type {HTMLButtonElement} */ (document.querySelector("#reset"));
const claimsButton = /** @type {HTMLButtonElement} */ (document.querySelector("#run-claims"));
const claimsRoot = /** @type {HTMLElement} */ (document.querySelector("#claim-results"));

const drawRock = createRenderer(rockCanvas, "rock");
const drawRelay = createRenderer(relayCanvas, "relay");
let state = createState(createCuts(Number(slider.value), 23));
let frame = 0;
let running = true;

function reset() {
  state = createState(createCuts(Number(slider.value), 23));
  const percent = Math.round(Number(slider.value) * 100);
  patternLabel.textContent = percent < 25 ? "scattered" : percent > 75 ? "near-seam" : "branching";
  arrivalLabel.textContent = "waiting";
  running = true;
  render();
}

function render() {
  drawRock(state.values, state.cuts);
  drawRelay(state.values, state.cuts);
  stepLabel.textContent = String(state.step);
  const arrival = farEdgeMean(state.values);
  if (arrival >= 0.2 && arrivalLabel.textContent === "waiting") {
    arrivalLabel.textContent = `${state.step} steps`;
  }
}

function loop() {
  frame = requestAnimationFrame(loop);
  if (!running) return;
  for (let count = 0; count < 3; count += 1) state = advance(state);
  render();
  if (state.step >= 1800) running = false;
}

slider.addEventListener("input", reset);
resetButton.addEventListener("click", reset);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelAnimationFrame(frame);
  else loop();
});
wireClaims(claimsRoot, claimsButton);
reset();
if (new URLSearchParams(window.location.search).has("capture")) {
  for (let step = 0; step < 1754; step += 1) state = advance(state);
  running = false;
  render();
} else {
  loop();
}
