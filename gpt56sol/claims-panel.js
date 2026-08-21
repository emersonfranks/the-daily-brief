// @ts-check

import { claims } from "./claims.js";

/**
 * @param {HTMLElement} container
 * @param {HTMLButtonElement} button
 */
export function connectClaimsPanel(container, button) {
  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "MEASURING…";
    container.replaceChildren();
    requestAnimationFrame(() => {
      for (const claim of claims) {
        const result = document.createElement("article");
        result.className = "claim";
        try {
          const evidence = claim.verify();
          result.innerHTML = `<div class="claim-heading"><span>${claim.name}</span><span class="claim-status">PASS</span></div><div class="claim-evidence">${evidence.map((item) => `<div class="evidence"><span>${item.label}</span><strong>${item.value}</strong></div>`).join("")}</div>`;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.innerHTML = `<div class="claim-heading"><span>${claim.name}</span><span class="claim-status">FAIL</span></div><p>${message}</p>`;
        }
        container.append(result);
      }
      button.disabled = false;
      button.textContent = "RUN AGAIN";
    });
  });
}