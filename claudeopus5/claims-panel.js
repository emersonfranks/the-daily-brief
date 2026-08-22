// @ts-check

import { claims, runClaim } from './claims.js';

/**
 * Render the same claims that `node --test` runs, one row each, with the evidence
 * measured at the moment the reader pressed the button.
 *
 * @param {HTMLElement} host
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} summary
 */
export function mountClaimsPanel(host, button, summary) {
  const render = () => {
    host.replaceChildren();
    summary.textContent = 'running...';
    button.disabled = true;

    // setTimeout rather than requestAnimationFrame: rAF is throttled in background
    // tabs, which left the panel stuck on "running..." forever.
    window.setTimeout(() => {
      let passed = 0;
      const started = performance.now();
      for (const claim of claims) {
        const result = runClaim(claim);
        if (result.passed) passed++;

        const row = document.createElement('article');
        row.className = `claim ${result.passed ? 'pass' : 'fail'}`;

        const head = document.createElement('h4');
        const mark = document.createElement('span');
        mark.className = 'mark';
        mark.textContent = result.passed ? 'PASS' : 'FAIL';
        head.append(mark, document.createTextNode(result.name));

        const catches = document.createElement('p');
        catches.className = 'catches';
        catches.textContent = `Catches: ${result.catches}`;

        const evidence = document.createElement('p');
        evidence.className = 'evidence';
        evidence.textContent = result.evidence;

        row.append(head, catches, evidence);
        host.append(row);
      }

      const elapsed = performance.now() - started;
      summary.textContent = `${passed} of ${claims.length} claims passed, measured in ${elapsed.toFixed(0)} ms in this browser.`;
      summary.className = passed === claims.length ? 'verdict ok' : 'verdict bad';
      button.disabled = false;
      button.textContent = 'Run them again';
    }, 16);
  };

  button.addEventListener('click', render);
}
