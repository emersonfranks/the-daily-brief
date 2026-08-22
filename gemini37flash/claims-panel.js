// @ts-check

import { claims } from './claims.js';

/**
 * Mount the interactive claims verification panel into a DOM container.
 * @param {HTMLElement} container
 * @param {HTMLButtonElement} triggerButton
 */
export function mountClaimsPanel(container, triggerButton) {
  // Render claim placeholders
  container.innerHTML = claims
    .map(
      (claim, index) => `
    <div class="claim-card" id="claim-card-${claim.id}">
      <div class="claim-header">
        <span class="claim-number">#${index + 1}</span>
        <h4 class="claim-title">${claim.name}</h4>
        <span class="claim-status status-pending" id="claim-status-${claim.id}">PENDING</span>
      </div>
      <p class="claim-desc">${claim.description}</p>
      <div class="claim-evidence-wrapper" id="claim-evidence-${claim.id}" style="display:none;">
        <div class="claim-message" id="claim-message-${claim.id}"></div>
        <pre class="claim-evidence-json" id="claim-json-${claim.id}"></pre>
      </div>
    </div>
  `
    )
    .join('');

  let isRunning = false;

  async function runAllClaims() {
    if (isRunning) return;
    isRunning = true;
    triggerButton.disabled = true;
    triggerButton.textContent = 'Verifying Mathematical Claims...';

    let passCount = 0;

    for (const claim of claims) {
      const statusEl = document.getElementById(`claim-status-${claim.id}`);
      const evidenceWrapper = document.getElementById(`claim-evidence-${claim.id}`);
      const messageEl = document.getElementById(`claim-message-${claim.id}`);
      const jsonEl = document.getElementById(`claim-json-${claim.id}`);

      if (statusEl) {
        statusEl.className = 'claim-status status-running';
        statusEl.textContent = 'RUNNING';
      }

      // Small yield for UI responsiveness
      await new Promise((r) => setTimeout(r, 40));

      const startTime = performance.now();
      try {
        const result = await claim.verify();
        const duration = (performance.now() - startTime).toFixed(1);

        if (statusEl) {
          statusEl.className = `claim-status ${result.passed ? 'status-passed' : 'status-failed'}`;
          statusEl.textContent = result.passed ? `PASSED (${duration}ms)` : `FAILED (${duration}ms)`;
        }

        if (evidenceWrapper && messageEl && jsonEl) {
          evidenceWrapper.style.display = 'block';
          messageEl.textContent = result.message;
          jsonEl.textContent = JSON.stringify(result.evidence, null, 2);
        }

        if (result.passed) passCount++;
      } catch (err) {
        if (statusEl) {
          statusEl.className = 'claim-status status-failed';
          statusEl.textContent = 'ERROR';
        }
        if (evidenceWrapper && messageEl) {
          evidenceWrapper.style.display = 'block';
          messageEl.textContent = `Exception during claim verification: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
    }

    triggerButton.disabled = false;
    triggerButton.textContent = `Re-run In-Browser Verification (${passCount}/${claims.length} Passed)`;
    isRunning = false;
  }

  triggerButton.addEventListener('click', () => {
    runAllClaims();
  });
}
