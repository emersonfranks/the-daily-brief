// @ts-check

import { claims } from "./claims.js";

/**
 * @param {HTMLElement} root
 * @param {HTMLButtonElement} button
 */
export function connectClaimsPanel(root, button) {
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "MEASURING…";
    root.replaceChildren();
    for (const claim of claims) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const row = document.createElement("article");
      try {
        const evidence = claim.verify();
        row.className = "claim-result passed";
        row.innerHTML = `<span class="claim-status">PASS</span><div><h3>${claim.name}</h3><p>${evidence}</p></div>`;
      } catch (error) {
        row.className = "claim-result failed";
        const message = error instanceof Error ? error.message : String(error);
        row.innerHTML = `<span class="claim-status">FAIL</span><div><h3>${claim.name}</h3><p>${message}</p></div>`;
      }
      root.append(row);
    }
    button.disabled = false;
    button.textContent = "RUN AGAIN";
  });
}
