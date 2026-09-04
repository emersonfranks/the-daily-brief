// @ts-check

/**
 * The browser side of the proof appendix. It imports the same `claims.js` that `node --test` and
 * the publish workflow import, so what a reader watches run here is what CI checked — not a replica
 * that could drift away from it.
 *
 * Deliberately not named `test-*.js`: Node's test discovery matches that pattern and would try to
 * execute this file, where it would die on the first mention of `document`.
 */

import { claims } from './claims.js';

/**
 * @param {HTMLElement} button
 * @param {HTMLElement} output
 */
export function mountClaimsPanel(button, output) {
  button.addEventListener('click', async () => {
    button.setAttribute('disabled', 'true');
    output.textContent = '';
    let passed = 0;

    for (const claim of claims) {
      const card = document.createElement('div');
      card.className = 'claim';
      card.innerHTML = `
        <div class="status">running&hellip;</div>
        <div class="title"></div>
        <div class="catches"></div>
        <div class="evidence">measuring&hellip;</div>`;
      const title = card.querySelector('.title');
      const catches = card.querySelector('.catches');
      if (title) title.textContent = claim.title;
      if (catches) catches.textContent = claim.catches;
      output.appendChild(card);

      // Yield to the browser so each claim visibly runs rather than all appearing at once.
      await new Promise((resolve) => setTimeout(resolve, 30));

      const started = performance.now();
      /** @type {string} */
      let evidence;
      let ok = true;
      try {
        evidence = claim.verify();
      } catch (error) {
        ok = false;
        evidence = error instanceof Error ? error.message : String(error);
      }
      const elapsed = Math.round(performance.now() - started);

      card.className = `claim ${ok ? 'pass' : 'fail'}`;
      const status = card.querySelector('.status');
      const evidenceNode = card.querySelector('.evidence');
      if (status) status.textContent = `${ok ? 'holds' : 'FAILED'} · ${elapsed} ms`;
      if (evidenceNode) evidenceNode.textContent = evidence;
      if (ok) passed += 1;
    }

    const summary = document.createElement('p');
    summary.className = 'hint';
    summary.textContent = `${passed} of ${claims.length} claims re-measured in your browser just now. `
      + 'The same file runs under node --test before this page is allowed to publish.';
    output.appendChild(summary);
    button.removeAttribute('disabled');
  });
}
