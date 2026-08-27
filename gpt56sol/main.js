// @ts-check

import { connectClaimsPanel } from "./claims-panel.js";
import { createRenderer } from "./renderer.js";
import { simulateSynchrony } from "./synchrony.js";

const canvas = document.querySelector("#synchrony-canvas");
const couplingInput = document.querySelector("#coupling-input");
const couplingValue = document.querySelector("#coupling-value");
const regimeLabel = document.querySelector("#regime-label");
const coherenceValue = document.querySelector("#coherence-value");
const resetButton = document.querySelector("#reset-button");
const shockButton = document.querySelector("#shock-button");
const claimsRoot = document.querySelector("#claims-results");
const claimsButton = document.querySelector("#claims-button");

if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing synchrony canvas");
if (!(couplingInput instanceof HTMLInputElement)) throw new Error("Missing coupling control");
if (!(couplingValue instanceof HTMLElement)) throw new Error("Missing coupling value");
if (!(regimeLabel instanceof HTMLElement)) throw new Error("Missing regime label");
if (!(coherenceValue instanceof HTMLElement)) throw new Error("Missing coherence value");
if (!(resetButton instanceof HTMLButtonElement)) throw new Error("Missing reset button");
if (!(shockButton instanceof HTMLButtonElement)) throw new Error("Missing shock button");
if (!(claimsRoot instanceof HTMLElement)) throw new Error("Missing claims results");
if (!(claimsButton instanceof HTMLButtonElement)) throw new Error("Missing claims button");

const renderer = createRenderer(canvas);
const playbackMilliseconds = 310;
let run = simulateSynchrony({ coupling: Number(couplingInput.value), seed: 5600 });
let startedAt = performance.now();
let animationFrame = 0;
let shocked = false;
let currentFrame = run.frames[0];

function updateLabels() {
  const coupling = Number(couplingInput.value);
  couplingValue.textContent = coupling.toFixed(2);
  regimeLabel.textContent = coupling < 0.55 ? "MOSTLY SCATTERED" : coupling < 1.25 ? "CLUSTERS FORMING" : "LOCKING TOGETHER";
}

/** @param {number | undefined} perturbAt */
function rebuild(perturbAt) {
  run = simulateSynchrony({ coupling: Number(couplingInput.value), seed: 5600, perturbAt });
  shocked = perturbAt !== undefined;
  startedAt = performance.now() - (perturbAt === undefined ? 0 : (perturbAt - 0.15) * playbackMilliseconds);
  updateLabels();
}

/** @param {number} time */
function animate(time) {
  const modelTime = Math.max(0, (time - startedAt) / playbackMilliseconds) % 20;
  const frameIndex = Math.min(run.frames.length - 1, Math.floor(modelTime * 10));
  currentFrame = run.frames[frameIndex];
  const shockVisible = shocked && modelTime >= 7.85 && modelTime <= 9.2;
  renderer.render(currentFrame.phases, currentFrame.coherence, shockVisible);
  coherenceValue.textContent = currentFrame.coherence.toFixed(2);
  animationFrame = requestAnimationFrame(animate);
}

couplingInput.addEventListener("input", () => rebuild(undefined));
resetButton.addEventListener("click", () => rebuild(undefined));
shockButton.addEventListener("click", () => rebuild(8));
window.addEventListener("resize", () => renderer.render(currentFrame.phases, currentFrame.coherence, false));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelAnimationFrame(animationFrame);
  else {
    startedAt = performance.now();
    animationFrame = requestAnimationFrame(animate);
  }
});
connectClaimsPanel(claimsRoot, claimsButton);
updateLabels();
animationFrame = requestAnimationFrame(animate);
