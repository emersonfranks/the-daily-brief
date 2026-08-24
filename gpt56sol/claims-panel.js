// @ts-check

import { claims } from "./claims.js";

/**
 * @param {HTMLElement} container
 * @param {HTMLButtonElement} button
 */
export function connectClaimsPanel(container, button) {
  function showReadyState() {
    container.replaceChildren(...claims.map((claim) => {
      const row = document.createElement("article");
      row.className = "claim ready";
      row.innerHTML = `<span class="claim-mark">○</span><div><h3>${claim.name}</h3><p>${claim.catches}</p></div>`;
      return row;
    }));
  }

  function runClaims() {
    button.disabled = true;
    button.textContent = "Running…";
    const rows = claims.map((claim) => {
      const row = document.createElement("article");
      try {
        const evidence = claim.verify();
        row.className = "claim pass";
        row.innerHTML = `<span class="claim-mark">✓</span><div><h3>${claim.name}</h3><p>${evidence}</p></div>`;
      } catch (error) {
        row.className = "claim fail";
        const message = error instanceof Error ? error.message : String(error);
        row.innerHTML = `<span class="claim-mark">×</span><div><h3>${claim.name}</h3><p>${message}</p></div>`;
      }
      return row;
    });
    container.replaceChildren(...rows);
    button.disabled = false;
    button.textContent = "Run again";
  }

  button.addEventListener("click", runClaims);
  showReadyState();
}
