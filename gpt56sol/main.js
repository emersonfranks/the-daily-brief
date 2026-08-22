// @ts-check

import { mountClaimsPanel } from "./claims-panel.js";
import { createRenderer } from "./renderer.js";
import { createOscillators, coherence, disturbOscillators, stepOscillators } from "./synchrony-model.js";

const canvas = document.querySelector("#world");
const coupling = document.querySelector("#coupling");
const couplingValue = document.querySelector("#coupling-value");
const coherenceValue = document.querySelector("#coherence");
const meterFill = document.querySelector("#meter-fill");
const stateLabel = document.querySelector("#state-label");
const shockButton = document.querySelector("#shock");
const freezeButton = document.querySelector("#freeze");
const claimResults = document.querySelector("#claim-results");

if (!(canvas instanceof HTMLCanvasElement) || !(coupling instanceof HTMLInputElement) || !(couplingValue instanceof HTMLOutputElement) || !(coherenceValue instanceof HTMLElement) || !(meterFill instanceof HTMLElement) || !(stateLabel instanceof HTMLElement) || !(shockButton instanceof HTMLButtonElement) || !(freezeButton instanceof HTMLButtonElement) || !(claimResults instanceof HTMLElement)) {
  throw new Error("The experiment interface is incomplete");
}

const state = createOscillators(48, 47, Number(coupling.value));
const render = createRenderer(canvas);
let running = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let previousTime = performance.now();
let accumulator = 0;

coupling.addEventListener("input", () => {
  state.coupling = Number(coupling.value);
  couplingValue.value = state.coupling.toFixed(2);
});

shockButton.addEventListener("click", () => disturbOscillators(state, Math.PI * 0.9));

freezeButton.addEventListener("click", () => {
  running = !running;
  freezeButton.textContent = running ? "Ⅱ" : "▶";
  freezeButton.setAttribute("aria-label", running ? "Pause animation" : "Resume animation");
  freezeButton.title = running ? "Pause animation" : "Resume animation";
});

/** @param {number} time */
function frame(time) {
  const elapsed = Math.min((time - previousTime) / 1000, 0.1);
  previousTime = time;

  if (running) {
    accumulator += elapsed * 6;
    while (accumulator >= 0.025) {
      stepOscillators(state, 0.025);
      accumulator -= 0.025;
    }
  }

  const value = coherence(state);
  const percent = Math.round(value * 100);
  coherenceValue.textContent = `${percent}%`;
  meterFill.style.width = `${percent}%`;
  stateLabel.textContent = value > 0.9 ? "locked" : value > 0.55 ? "gathering" : "scattered";
  render(state);
  requestAnimationFrame(frame);
}

mountClaimsPanel(claimResults);
requestAnimationFrame(frame);