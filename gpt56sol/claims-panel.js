// @ts-check

import { runClaims } from "./claims.js";

/** @param {HTMLElement} container */
export function createClaimsPanel(container) {
  const button = document.querySelector("#run-claims");
  if (!(button instanceof HTMLButtonElement)) throw new Error("Missing claims button");

  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Measuring all 256 patterns…";
    requestAnimationFrame(() => {
      const results = runClaims();
      container.replaceChildren(...results.map(renderResult));
      button.textContent = results.every((result) => result.passed) ? "Run the proof again" : "Run the proof again";
      button.disabled = false;
    });
  });
}

/** @param {ReturnType<typeof runClaims>[number]} result */
function renderResult(result) {
  const article = document.createElement("article");
  article.className = `claim-result ${result.passed ? "passed" : "failed"}`;
  const heading = document.createElement("h3");
  heading.textContent = result.claim.name;
  const status = document.createElement("span");
  status.className = "claim-status";
  status.textContent = result.passed ? "PASS" : "FAIL";
  const catches = document.createElement("p");
  catches.textContent = result.claim.catches;
  const evidence = document.createElement("dl");
  if (result.passed) {
    for (const item of result.evidence) {
      const term = document.createElement("dt");
      term.textContent = item.label;
      const value = document.createElement("dd");
      value.textContent = item.value;
      evidence.append(term, value);
    }
  } else {
    const error = document.createElement("dd");
    error.textContent = result.error;
    evidence.append(error);
  }
  article.append(status, heading, catches, evidence);
  return article;
}
