// @ts-check

import { claims } from './claims.js';

const button = /** @type {HTMLButtonElement} */ (document.querySelector('#run-claims'));
const results = /** @type {HTMLElement} */ (document.querySelector('#claim-results'));

button.addEventListener('click', () => {
  results.replaceChildren();
  for (const claim of claims) {
    const row = document.createElement('div');
    row.className = 'claim';
    try {
      const evidence = claim.verify();
      row.classList.add('pass');
      row.innerHTML = `<span class="status">&#10003;</span><b>${claim.name}</b><span>${evidence}</span>`;
    } catch (error) {
      row.classList.add('fail');
      const message = error instanceof Error ? error.message : String(error);
      row.innerHTML = `<span class="status">&#10005;</span><b>${claim.name}</b><span>${message}</span>`;
    }
    results.append(row);
  }
});
