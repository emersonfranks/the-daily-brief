// @ts-check

import { simulateCascade } from "./cascade-model.js";
import { drawWorld } from "./renderer.js";
import { connectClaimsPanel } from "./claims-panel.js";

const reproductionInput = document.querySelector("#reproduction");
const reproductionValue = document.querySelector("[data-r-value]");
const launchButton = document.querySelector("#launch");
const faultCanvas = document.querySelector("#fault-canvas");
const inboxCanvas = document.querySelector("#inbox-canvas");
const eventCount = document.querySelector("[data-event-count]");
const generationCount = document.querySelector("[data-generation-count]");
const regimeLabel = document.querySelector("[data-regime]");
const claimsRoot = document.querySelector("#proof");
const captureMode = new URLSearchParams(window.location.search).has("capture");

if (
  !(reproductionInput instanceof HTMLInputElement) ||
  !(reproductionValue instanceof HTMLElement) ||
  !(launchButton instanceof HTMLButtonElement) ||
  !(faultCanvas instanceof HTMLCanvasElement) ||
  !(inboxCanvas instanceof HTMLCanvasElement) ||
  !(eventCount instanceof HTMLElement) ||
  !(generationCount instanceof HTMLElement) ||
  !(regimeLabel instanceof HTMLElement)
) {
  throw new Error("The cascade controls are incomplete");
}

let seed = captureMode ? 57 : 56;
if (captureMode) reproductionInput.value = "1.28";
let cascade = simulateCascade({ reproduction: Number(reproductionInput.value), seed });
let visibleCount = captureMode ? cascade.events.length : 1;
let animationFrame = 0;

function updateLabels() {
  const reproduction = Number(reproductionInput.value);
  reproductionValue.textContent = reproduction.toFixed(2);
  regimeLabel.textContent = reproduction < 0.95 ? "mostly self-limiting" : reproduction > 1.05 ? "storm-capable" : "on the knife-edge";
}

function render() {
  drawWorld(faultCanvas, cascade, "fault", visibleCount);
  drawWorld(inboxCanvas, cascade, "inbox", visibleCount);
  eventCount.textContent = String(Math.min(visibleCount, cascade.events.length));
  generationCount.textContent = String(cascade.generationCounts.length - 1);
}

function animate() {
  visibleCount = Math.min(cascade.events.length, visibleCount + Math.max(1, Math.ceil(cascade.events.length / 90)));
  render();
  if (visibleCount < cascade.events.length) animationFrame = window.requestAnimationFrame(animate);
}

function launch() {
  window.cancelAnimationFrame(animationFrame);
  seed += 1;
  cascade = simulateCascade({ reproduction: Number(reproductionInput.value), seed });
  visibleCount = 1;
  render();
  animationFrame = window.requestAnimationFrame(animate);
}

reproductionInput.addEventListener("input", updateLabels);
reproductionInput.addEventListener("change", launch);
launchButton.addEventListener("click", launch);
window.addEventListener("resize", render);
document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!(button instanceof HTMLButtonElement)) return;
    reproductionInput.value = button.dataset.preset ?? "1";
    updateLabels();
    launch();
  });
});

if (claimsRoot instanceof HTMLElement) connectClaimsPanel(claimsRoot);
updateLabels();
render();
if (!captureMode) animationFrame = window.requestAnimationFrame(animate);