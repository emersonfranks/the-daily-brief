// @ts-check

import { claims } from "./claims.js";

/** @param {HTMLElement} root */
export function connectClaimsPanel(root) {
  const button = root.querySelector("button");
  const results = root.querySelector("[data-claim-results]");
  if (!(button instanceof HTMLButtonElement) || !(results instanceof HTMLElement)) return;

  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Running 802 simulations…";
    window.setTimeout(() => {
      results.replaceChildren(...claims.map(renderClaim));
      button.disabled = false;
      button.textContent = "Run the claims again";
    }, 40);
  });
}

/** @param {(typeof claims)[number]} claim */
function renderClaim(claim) {
  const row = document.createElement("article");
  const heading = document.createElement("h3");
  const evidence = document.createElement("p");
  try {
    const result = claim.verify();
    row.dataset.state = "pass";
    heading.textContent = `PASS · ${claim.name}`;
    evidence.textContent = result;
  } catch (error) {
    row.dataset.state = "fail";
    heading.textContent = `FAIL · ${claim.name}`;
    evidence.textContent = error instanceof Error ? error.message : String(error);
  }
  row.append(heading, evidence);
  return row;
}