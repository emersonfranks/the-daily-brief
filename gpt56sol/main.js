// @ts-check

import { analyzePattern } from "./assembly.js";
import { createClaimsPanel } from "./claims-panel.js";
import { createRenderer } from "./renderer.js";

const initialPattern = "01010101";
const canvas = document.querySelector("#comparison-canvas");
const bitControls = document.querySelector("#bit-controls");
const assemblyValue = document.querySelector("#assembly-value");
const waitingValue = document.querySelector("#waiting-value");
const overlapValue = document.querySelector("#overlap-value");
const stepList = document.querySelector("#step-list");
const borderList = document.querySelector("#border-list");
const claimsContainer = document.querySelector("#claims-results");

if (!(canvas instanceof HTMLCanvasElement) || !(bitControls instanceof HTMLElement) || !(assemblyValue instanceof HTMLElement) || !(waitingValue instanceof HTMLElement) || !(overlapValue instanceof HTMLElement) || !(stepList instanceof HTMLElement) || !(borderList instanceof HTMLElement) || !(claimsContainer instanceof HTMLElement)) {
  throw new Error("Required page elements are missing");
}

const renderer = createRenderer(canvas);
let pattern = initialPattern;

function buildBitControls() {
  bitControls.replaceChildren(...[...pattern].map((bit, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `bit bit-${bit}`;
    button.textContent = bit;
    button.setAttribute("aria-label", `Bit ${index + 1}: ${bit}. Toggle it.`);
    button.addEventListener("click", () => {
      pattern = pattern.slice(0, index) + (pattern[index] === "0" ? "1" : "0") + pattern.slice(index + 1);
      render(true);
    });
    return button;
  }));
}

/** @param {boolean} animate */
function render(animate) {
  const analysis = analyzePattern(pattern);
  buildBitControls();
  assemblyValue.textContent = String(analysis.assemblyIndex);
  waitingValue.textContent = String(analysis.waitingTime);
  overlapValue.textContent = analysis.overlapTax === 0 ? "none" : `+${analysis.overlapTax}`;
  stepList.replaceChildren(...analysis.steps.map((step, index) => {
    const item = document.createElement("li");
    item.innerHTML = `<span>${index + 1}</span><code>${step.left}</code><b>+</b><code>${step.right}</code><b>→</b><code>${step.result}</code>`;
    return item;
  }));
  borderList.textContent = analysis.borderLengths.length === 1
    ? "Only the whole pattern matches its own ending. There is no partial reset trap."
    : `Matching prefix lengths: ${analysis.borderLengths.join(", ")}. A near-match can leave the signal partway into another attempt.`;
  renderer.render(analysis, animate);
}

for (const button of document.querySelectorAll("[data-pattern]")) {
  button.addEventListener("click", () => {
    pattern = button.getAttribute("data-pattern") ?? initialPattern;
    render(true);
  });
}

const shuffleButton = document.querySelector("#shuffle-pattern");
if (!(shuffleButton instanceof HTMLButtonElement)) throw new Error("Missing shuffle button");
shuffleButton.addEventListener("click", () => {
  pattern = Array.from({ length: 8 }, () => Math.random() < 0.5 ? "0" : "1").join("");
  render(true);
});

createClaimsPanel(claimsContainer);
render(false);
