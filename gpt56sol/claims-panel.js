// @ts-check

import { claims } from './claims.js';

/** @param {HTMLElement} root @param {HTMLButtonElement} button */
export function wireClaims(root, button) {
  button.addEventListener('click', () => {
    root.replaceChildren();
    for (const claim of claims) {
      const item = document.createElement('article');
      item.className = 'claim-result';
      try {
        const evidence = claim.verify();
        item.innerHTML = `<span class="pass">PASS</span><div><strong>${claim.name}</strong><p>${evidence}</p></div>`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        item.innerHTML = `<span class="fail">FAIL</span><div><strong>${claim.name}</strong><p>${message}</p></div>`;
      }
      root.append(item);
    }
  });
}
