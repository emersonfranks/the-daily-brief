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
const runLoopButton = required("#run-loop", HTMLButtonElement);
const routeLabel = required("#route-label", HTMLElement);
const observationText = required("#observation-text", HTMLElement);
let loopRunning = false;

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

/**
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * @param {number} target
 * @param {number} step
 * @returns {Promise<void>}
 */
async function movePressure(target, step) {
  while (Math.abs(pressure - target) > 0.001) {
    pressure = Math.abs(target - pressure) < Math.abs(step) ? target : pressure + step;
    pressureInput.value = String(Math.round(pressure * 100));
    settle(cascade, pressure);
    render();
    await wait(28);
  }
}

pressureInput.addEventListener("input", () => {
  if (loopRunning) return;
  pressure = Number(pressureInput.value) / 100;
  settle(cascade, pressure);
  routeLabel.textContent = "FREE EXPLORATION";
  observationText.textContent = "Move away and return to the same setting: with high neighbor influence, the percentage can be different on the return path.";
  render();
});

document.querySelectorAll('input[name="coupling"]').forEach((input) => {
  input.addEventListener("change", () => {
    rebuild();
    const selected = required('input[name="coupling"]:checked', HTMLInputElement);
    routeLabel.textContent = selected.value === "0.35" ? "LOW NEIGHBOR INFLUENCE" : "HIGH NEIGHBOR INFLUENCE";
    observationText.textContent = selected.value === "0.35"
      ? "Tiles respond mostly to outside pressure and their own resistance; collective memory weakens."
      : "Each tile gives substantial weight to nearby choices; clusters resist reversal and memory strengthens.";
  });
});

shockButton.addEventListener("click", async () => {
  if (loopRunning) return;
  shockButton.disabled = true;
  seedPatch(cascade, Math.floor(size / 2) * size + Math.floor(size / 2), 3.6, -1);
  render();
  routeLabel.textContent = "LOCAL SHOCK APPLIED";
  observationText.textContent = "The red center was forced to withdraw or point down. Now its neighbors respond.";
  await wait(650);
  settle(cascade, pressure);
  render();
  const flipped = cascade.state.length - Math.round(positiveShare(cascade) * cascade.state.length);
  routeLabel.textContent = "SHOCK SETTLED";
  observationText.textContent = `${flipped} of ${cascade.state.length} tiles remain withdrawn or down. Outside pressure and neighbor influence determined whether the patch healed or spread.`;
  shockButton.disabled = false;
});

resetButton.addEventListener("click", () => {
  seed = (seed + 0x9e3779b9) >>> 0;
  rebuild(1);
  routeLabel.textContent = "NEW HIDDEN LANDSCAPE";
  observationText.textContent = "Every tile now has a new fixed resistance. The same shock may travel a different distance.";
});

runLoopButton.addEventListener("click", async () => {
  if (loopRunning) return;
  loopRunning = true;
  runLoopButton.disabled = true;
  pressure = 0.8;
  pressureInput.value = "80";
  rebuild(1);
  routeLabel.textContent = "OUTBOUND · FIELD FALLING";
  observationText.textContent = "Crossing neutral for the first time: the aligned crowd is holding its state.";
  await movePressure(0, -0.04);
  const outboundShare = Math.round(positiveShare(cascade) * 100);
  await movePressure(-1, -0.04);
  routeLabel.textContent = "RETURN · FIELD RISING";
  observationText.textContent = "The outside pressure is recovering, but flipped neighbors now reinforce one another.";
  await movePressure(0, 0.04);
  const returnShare = Math.round(positiveShare(cascade) * 100);
  routeLabel.textContent = "HYSTERESIS MEASURED";
  observationText.textContent = `Same neutral pressure, different state: ${outboundShare}% stayed on the way down; ${returnShare}% stayed on the way back.`;
  runLoopButton.textContent = "RUN THE LOOP AGAIN";
  runLoopButton.disabled = false;
  loopRunning = false;
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