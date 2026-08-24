// @ts-check

import { advance, createState } from "./adaptive-model.js";
import { connectClaimsPanel } from "./claims-panel.js";
import { createRenderer } from "./renderer.js";

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector("#worlds"));
const slider = /** @type {HTMLInputElement} */ (document.querySelector("#signal"));
const signalValue = /** @type {HTMLOutputElement} */ (document.querySelector("#signal-value"));
const responseValue = /** @type {HTMLElement} */ (document.querySelector("#response-value"));
const readoutState = /** @type {HTMLElement} */ (document.querySelector("#readout-state"));
const freezeButton = /** @type {HTMLButtonElement} */ (document.querySelector("#freeze"));
const claimResults = /** @type {HTMLElement} */ (document.querySelector("#claim-results"));
const runClaimsButton = /** @type {HTMLButtonElement} */ (document.querySelector("#run-claims"));
const pageMode = new URLSearchParams(window.location.search);
const renderer = createRenderer(canvas);
let signal = 1;
let adaptiveState = createState(signal);
let history = Array.from({ length: 120 }, () => 0);
let previousTime = performance.now();
let phase = 0;
let frozen = false;

function setSignal(value) {
  signal = Math.max(0.25, Math.min(8, value));
  slider.value = String(signal);
  signalValue.value = `${signal.toFixed(2)}×`;
  document.querySelectorAll("[data-signal]").forEach((button) => {
    button.classList.toggle("active", Number(button.getAttribute("data-signal")) === signal);
  });
}

function updateReadout() {
  const response = adaptiveState.response;
  responseValue.textContent = `${response >= 0 ? "+" : ""}${response.toFixed(3)}`;
  readoutState.textContent = Math.abs(response) < 0.04 ? "LEVEL NOW FAMILIAR" : response > 0 ? "INCREASE DETECTED" : "DECREASE DETECTED";
}

function animate(time) {
  const elapsedSeconds = Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;
  if (!frozen) {
    adaptiveState = advance(adaptiveState, signal, Math.max(elapsedSeconds, 0.001));
    phase += elapsedSeconds;
    history.push(adaptiveState.response);
    if (history.length > 120) history.shift();
    updateReadout();
  }
  renderer.render({ signal, ...adaptiveState, history, phase });
  requestAnimationFrame(animate);
}

slider.addEventListener("input", () => setSignal(Number(slider.value)));
document.querySelectorAll("[data-signal]").forEach((button) => {
  button.addEventListener("click", () => setSignal(Number(button.getAttribute("data-signal"))));
});
freezeButton.addEventListener("click", () => {
  frozen = !frozen;
  freezeButton.textContent = frozen ? "▶" : "Ⅱ";
  freezeButton.title = frozen ? "Resume animation" : "Freeze animation";
  freezeButton.setAttribute("aria-label", freezeButton.title);
});

connectClaimsPanel(claimResults, runClaimsButton);
if (pageMode.has("proof")) runClaimsButton.click();
setSignal(1);
requestAnimationFrame(animate);
window.setTimeout(() => setSignal(4), 650);
if (pageMode.has("capture")) {
  window.setTimeout(() => {
    adaptiveState = advance(adaptiveState, signal, 0.02);
    history.push(adaptiveState.response);
    updateReadout();
    frozen = true;
    freezeButton.textContent = "▶";
    freezeButton.title = "Resume animation";
    freezeButton.setAttribute("aria-label", freezeButton.title);
  }, 800);
}
