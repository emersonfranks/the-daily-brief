// @ts-check

import { claims } from "./claims.js";

/** @typedef {{ name: string, catches: string, verify: () => string }} Claim */

/** @param {HTMLElement} container @param {Claim[]} claimSet */
export function renderClaims(container, claimSet = claims) {
  container.replaceChildren();

  for (const claim of claimSet) {
    const row = document.createElement("article");
    row.className = "claim";
    const state = document.createElement("span");
    state.className = "claim-state";
    state.textContent = "○";
    const title = document.createElement("h3");
    title.textContent = claim.name;
    const result = document.createElement("p");
    result.textContent = claim.catches;
    row.append(state, title, result);
    container.append(row);

    try {
      const evidence = document.createElement("evidence");
      evidence.textContent = claim.verify();
      result.append(evidence);
      row.classList.add("pass");
      state.textContent = "●";
    } catch (error) {
      const evidence = document.createElement("evidence");
      evidence.textContent = error instanceof Error ? error.message : String(error);
      result.append(evidence);
      row.classList.add("fail");
      state.textContent = "×";
    }
  }
}

/** @param {HTMLElement} container */
export function mountClaimsPanel(container) {
  const button = document.querySelector("#run-claims");
  if (!(button instanceof HTMLButtonElement)) throw new Error("Claims button is missing");
  button.addEventListener("click", () => renderClaims(container));
}