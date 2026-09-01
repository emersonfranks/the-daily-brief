// @ts-check

import { claims } from './claims.js';

/** @param {HTMLElement} root @param {HTMLButtonElement} button */
export function wireClaimsPanel(root, button) {
  button.addEventListener('click', () => {
    root.replaceChildren();
    let passed = 0;
    for (const claim of claims) {
      const row = document.createElement('article');
      row.className = 'claim-row';
      const marker = document.createElement('span');
      marker.className = 'claim-marker';
      const copy = document.createElement('div');
      const name = document.createElement('strong');
      const evidence = document.createElement('p');
      name.textContent = claim.name;
      try {
        evidence.textContent = claim.verify();
        marker.textContent = 'PASS';
        row.dataset.status = 'pass';
        passed += 1;
      } catch (error) {
        evidence.textContent = error instanceof Error ? error.message : String(error);
        marker.textContent = 'FAIL';
        row.dataset.status = 'fail';
      }
      copy.append(name, evidence);
      row.append(marker, copy);
      root.append(row);
    }
    button.textContent = `${passed} / ${claims.length} claims passed`;
  });
}