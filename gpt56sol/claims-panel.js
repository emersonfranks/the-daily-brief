// @ts-check

import { claims } from "./claims.js";

/** @param {HTMLElement} root @param {HTMLButtonElement} button */
export function wireClaims(root, button) {
  button.addEventListener("click", () => {
    root.replaceChildren();
    let passed = 0;
    for (const claim of claims) {
      const item = document.createElement("article");
      item.className = "claim-result";
      try {
        const evidence = claim.verify();
        item.innerHTML = `<span class="pass">PASS</span><div><b>${claim.name}</b><p>${evidence}</p></div>`;
        passed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        item.innerHTML = `<span class="fail">FAIL</span><div><b>${claim.name}</b><p>${message}</p></div>`;
      }
      root.append(item);
    }
    button.textContent = `${passed}/${claims.length} claims passed`;
  });
}
