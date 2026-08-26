// @ts-check

import { simulateBranching } from "./branching.js";
import { connectClaimsPanel } from "./claims-panel.js";
import { createRenderer } from "./renderer.js";

const canvas = document.querySelector("#cascade-canvas");
const meanInput = document.querySelector("#mean-input");
const meanValue = document.querySelector("#mean-value");
const regimeLabel = document.querySelector("#regime-label");
const eventCount = document.querySelector("#event-count");
const generationCount = document.querySelector("#generation-count");
const replayButton = document.querySelector("#replay-button");
const reseedButton = document.querySelector("#reseed-button");
const claimsRoot = document.querySelector("#claims-results");
const claimsButton = document.querySelector("#claims-button");

if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing cascade canvas");
if (!(meanInput instanceof HTMLInputElement)) throw new Error("Missing reproduction control");
if (!(meanValue instanceof HTMLElement)) throw new Error("Missing reproduction value");
if (!(regimeLabel instanceof HTMLElement)) throw new Error("Missing regime label");
if (!(eventCount instanceof HTMLElement)) throw new Error("Missing event count");
if (!(generationCount instanceof HTMLElement)) throw new Error("Missing generation count");
if (!(replayButton instanceof HTMLButtonElement)) throw new Error("Missing replay button");
if (!(reseedButton instanceof HTMLButtonElement)) throw new Error("Missing reseed button");
if (!(claimsRoot instanceof HTMLElement)) throw new Error("Missing claims results");
if (!(claimsButton instanceof HTMLButtonElement)) throw new Error("Missing claims button");

const renderer = createRenderer(canvas);
let seed = 7400;
let run = simulateBranching({ mean: Number(meanInput.value), seed });
let visibleGeneration = 0;
let animationFrame = 0;
let previousTime = 0;

function updateReadout() {
  const mean = Number(meanInput.value);
  meanValue.textContent = mean.toFixed(2);
  regimeLabel.textContent = mean < 0.97 ? "LIKELY TO FADE" : mean > 1.03 ? "ABLE TO RUN AWAY" : "AT THE TIPPING POINT";
  eventCount.textContent = String(run.nodes.filter((node) => node.generation <= visibleGeneration).length);
  generationCount.textContent = String(visibleGeneration);
}

function rebuild() {
  cancelAnimationFrame(animationFrame);
  run = simulateBranching({ mean: Number(meanInput.value), seed });
  visibleGeneration = 0;
  previousTime = 0;
  updateReadout();
  renderer.render(run, visibleGeneration);
  animationFrame = requestAnimationFrame(animate);
}

/** @param {number} time */
function animate(time) {
  if (!previousTime) previousTime = time;
  if (time - previousTime > 420 && visibleGeneration < run.generations.length - 1) {
    visibleGeneration += 1;
    previousTime = time;
    updateReadout();
    renderer.render(run, visibleGeneration);
  }
  if (visibleGeneration < run.generations.length - 1) animationFrame = requestAnimationFrame(animate);
}

meanInput.addEventListener("input", rebuild);
replayButton.addEventListener("click", rebuild);
reseedButton.addEventListener("click", () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  rebuild();
});
window.addEventListener("resize", () => renderer.render(run, visibleGeneration));
connectClaimsPanel(claimsRoot, claimsButton);
rebuild();
