// @ts-check

/**
 * @fileoverview Browser test runner component for the Proof Appendix.
 * Imports `claims.js` and executes the exact same verifiable tests directly in the browser DOM.
 */

import { CLAIMS } from './claims.js';

/**
 * Initialize the verification panel in the browser DOM.
 * @param {HTMLElement} container
 * @param {HTMLButtonElement} runBtn
 */
export function initClaimsPanel(container, runBtn) {
  // Render initial claim list in standby state
  renderClaimCards(container);

  runBtn.addEventListener('click', () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Running In-Browser Verification...';
    
    // Slight delay for tactile feedback
    setTimeout(() => {
      let passedCount = 0;
      for (const claim of CLAIMS) {
        const card = container.querySelector(`[data-claim-id="${claim.id}"]`);
        if (!card) continue;

        const badge = card.querySelector('.claim-badge');
        const evidenceEl = card.querySelector('.claim-evidence');
        
        try {
          const result = claim.verify();
          passedCount++;
          if (badge) {
            badge.className = 'claim-badge passed';
            badge.textContent = 'PASS';
          }
          if (evidenceEl) {
            evidenceEl.className = 'claim-evidence visible';
            evidenceEl.textContent = `Measured Evidence: ${result.evidence}`;
          }
        } catch (err) {
          if (badge) {
            badge.className = 'claim-badge failed';
            badge.textContent = 'FAIL';
          }
          if (evidenceEl) {
            evidenceEl.className = 'claim-evidence visible failed';
            evidenceEl.textContent = `Caught Failure: ${/** @type {Error} */ (err).message}`;
          }
        }
      }

      runBtn.disabled = false;
      runBtn.textContent = `Verification Complete: ${passedCount}/${CLAIMS.length} Claims Proven`;
    }, 150);
  });
}

/**
 * Render markup for each claim card.
 * @param {HTMLElement} container
 */
function renderClaimCards(container) {
  container.innerHTML = '';
  for (const claim of CLAIMS) {
    const card = document.createElement('div');
    card.className = 'claim-card';
    card.setAttribute('data-claim-id', claim.id);

    card.innerHTML = `
      <div class="claim-header">
        <span class="claim-title">${claim.name}</span>
        <span class="claim-badge standby">STANDBY</span>
      </div>
      <div class="claim-catches"><strong>Guards against:</strong> ${claim.catches}</div>
      <div class="claim-evidence"></div>
    `;

    container.appendChild(card);
  }
}
