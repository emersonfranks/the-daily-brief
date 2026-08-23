// @ts-check

/**
 * @fileoverview Browser runner and interactive UI component for verifying
 * empirical claims directly on the web page.
 */

import { CLAIMS } from './claims.js';

/**
 * Mounts the claims verification panel inside the specified container.
 * @param {HTMLElement} container
 */
export function mountClaimsPanel(container) {
  container.innerHTML = `
    <div class="claims-header">
      <div class="claims-summary">
        <h3>Live Experimental Proof Suite</h3>
        <p>Run the identical headless verification assertions that govern CI. Every test evaluates real numerical PDE simulations in your browser.</p>
      </div>
      <button id="btn-run-claims" class="btn-primary">▶ Run Proof Suite</button>
    </div>
    <div id="claims-list" class="claims-list"></div>
  `;

  const listEl = /** @type {HTMLElement} */ (container.querySelector('#claims-list'));
  const runBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#btn-run-claims'));

  // Render initial claim cards in pending state
  renderClaimCards(listEl, null);

  runBtn.addEventListener('click', () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Running Simulations...';

    // Small delay to allow UI refresh
    setTimeout(() => {
      const results = CLAIMS.map(claim => {
        try {
          return claim.verify();
        } catch (err) {
          return {
            id: claim.id,
            title: claim.title,
            statement: claim.statement,
            passed: false,
            evidence: `Error thrown during verification: ${err instanceof Error ? err.message : String(err)}`,
            metrics: {}
          };
        }
      });

      renderClaimCards(listEl, results);
      runBtn.disabled = false;
      runBtn.textContent = '↻ Re-run Proof Suite';
    }, 50);
  });
}

/**
 * @param {HTMLElement} listEl
 * @param {import('./claims.js').ClaimResult[] | null} results
 */
function renderClaimCards(listEl, results) {
  listEl.innerHTML = '';

  CLAIMS.forEach((claim, idx) => {
    const res = results ? results[idx] : null;
    const card = document.createElement('div');
    card.className = `claim-card ${res ? (res.passed ? 'passed' : 'failed') : 'pending'}`;

    const badgeClass = res ? (res.passed ? 'badge-pass' : 'badge-fail') : 'badge-pending';
    const badgeText = res ? (res.passed ? 'PASS' : 'FAIL') : 'UNTESTED';

    card.innerHTML = `
      <div class="claim-card-top">
        <span class="claim-title">${claim.title}</span>
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
      <p class="claim-statement">${claim.statement}</p>
      ${
        res
          ? `<div class="claim-evidence">
               <strong>Measured Evidence:</strong> ${res.evidence}
             </div>`
          : `<div class="claim-evidence text-muted">Click "Run Proof Suite" above to execute this numerical experiment live.</div>`
      }
    `;

    listEl.appendChild(card);
  });
}
