// @ts-check

import { coherence, createOscillators, disturbOscillators, stepOscillators } from "./synchrony.js";
import { drawFireflies, drawGrid } from "./renderer.js";

const fireflyCanvas = document.querySelector("#firefly-canvas");
const gridCanvas = document.querySelector("#grid-canvas");
const couplingInput = document.querySelector("#coupling");
const couplingValue = document.querySelector("#coupling-value");
const fireflyCoherence = document.querySelector("#firefly-coherence");
const gridCoherence = document.querySelector("#grid-coherence");
const regime = document.querySelector("#regime");
const shockButton = document.querySelector("#shock");
const resetButton = document.querySelector("#reset");
const status = document.querySelector("#status");

if (!(fireflyCanvas instanceof HTMLCanvasElement)
  || !(gridCanvas instanceof HTMLCanvasElement)
  || !(couplingInput instanceof HTMLInputElement)
  || !(couplingValue instanceof HTMLElement)
  || !(fireflyCoherence instanceof HTMLOutputElement)
  || !(gridCoherence instanceof HTMLOutputElement)
  || !(regime instanceof HTMLElement)
  || !(shockButton instanceof HTMLButtonElement)
  || !(resetButton instanceof HTMLButtonElement)
  || !(status instanceof HTMLElement)) {
  throw new Error("The synchronization interface is incomplete");
}

let seed = 56;
let oscillators = createOscillators(36, seed);
let coupling = Number(couplingInput.value);
let previousTime = performance.now();
let accumulator = 0;

function updateLabels() {
  const order = coherence(oscillators);
  const percentage = `${Math.round(order * 100)}%`;
  fireflyCoherence.value = percentage;
  gridCoherence.value = percentage;
  couplingValue.textContent = coupling.toFixed(2);
  regime.textContent = coupling < 0.35 ? "DRIFTING" : coupling < 0.85 ? "NEGOTIATING" : "COHERING";
}

function animate(time) {
  const elapsed = Math.min((time - previousTime) / 1000, 0.08);
  previousTime = time;
  accumulator += elapsed;
  while (accumulator >= 1 / 60) {
    oscillators = stepOscillators(oscillators, coupling, 1 / 60);
    accumulator -= 1 / 60;
  }
  drawFireflies(fireflyCanvas, oscillators);
  drawGrid(gridCanvas, oscillators);
  updateLabels();
  requestAnimationFrame(animate);
}

couplingInput.addEventListener("input", () => {
  coupling = Number(couplingInput.value);
  status.textContent = coupling < 0.35
    ? "Individual timing now outruns correction. Watch the phases fan apart."
    : "Coupling pulls every timing error back toward the group mean.";
});

shockButton.addEventListener("click", () => {
  oscillators = disturbOscillators(oscillators, seed + Math.round(performance.now()), 0.4);
  status.textContent = coupling > 0.85
    ? "Forty percent were knocked out of phase. Strong coupling should pull them home."
    : "Forty percent were knocked out of phase. At this coupling, recovery is not assured.";
});

resetButton.addEventListener("click", () => {
  seed += 1;
  oscillators = createOscillators(36, seed);
  coupling = 1.35;
  couplingInput.value = String(coupling);
  status.textContent = "A fresh population starts scattered. Its shared rhythm must emerge again.";
});

requestAnimationFrame(animate);