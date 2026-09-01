// @ts-check
import { claims } from './claims.js';

/**
 * Initializes the interactive Claims Verification Panel in the browser
 * @param {HTMLElement} container
 */
export function initClaimsPanel(container) {
  container.innerHTML = `
    <div class="claims-header">
      <div class="claims-summary">
        <h3>Experimental Verification Suite</h3>
        <p>Run the page's automated test suite directly in your browser. Each claim tests a core physical property of double-diffusive fingering convection against headless simulation measurements.</p>
      </div>
      <div class="claims-actions">
        <button id="run-claims-btn" class="btn btn-primary">Run Verification Suite</button>
      </div>
    </div>
    <div class="claims-status-banner" id="claims-global-status" style="display: none;">
      <span class="status-indicator"></span>
      <span class="status-text">Ready to run 5 scientific claims.</span>
    </div>
    <div class="claims-grid" id="claims-list">
      ${claims.map((claim, idx) => `
        <div class="claim-card" id="claim-card-${claim.id}">
          <div class="claim-card-header">
            <span class="claim-number">#${idx + 1}</span>
            <span class="claim-title">${claim.title}</span>
            <span class="claim-badge badge-pending" id="badge-${claim.id}">Pending</span>
          </div>
          <p class="claim-catches"><strong>Catches:</strong> ${claim.catches}</p>
          <div class="claim-evidence" id="evidence-${claim.id}">
            <em>Click "Run Verification Suite" to measure.</em>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const runBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#run-claims-btn'));
  const statusBanner = /** @type {HTMLElement} */ (container.querySelector('#claims-global-status'));
  const statusText = /** @type {HTMLElement} */ (statusBanner.querySelector('.status-text'));

  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Running Tests...';
    statusBanner.style.display = 'flex';
    statusBanner.className = 'claims-status-banner status-running';
    statusText.textContent = 'Executing numerical simulations headlessly across 5 physical regimes...';

    let allPassed = true;
    const startTime = performance.now();

    for (const claim of claims) {
      const badge = container.querySelector(`#badge-${claim.id}`);
      const evidenceEl = container.querySelector(`#evidence-${claim.id}`);
      const card = container.querySelector(`#claim-card-${claim.id}`);

      if (badge) {
        badge.className = 'claim-badge badge-running';
        badge.textContent = 'Running...';
      }
      if (evidenceEl) {
        evidenceEl.innerHTML = '<span class="spinner-inline"></span> Computing differential scalar advection-diffusion...';
      }
      if (card) {
        card.className = 'claim-card card-running';
      }

      // Small yield for UI repaint
      await new Promise(r => setTimeout(r, 40));

      const t0 = performance.now();
      try {
        const result = await claim.verify();
        const t1 = performance.now();
        const duration = (t1 - t0).toFixed(0);

        if (badge) {
          badge.className = 'claim-badge badge-pass';
          badge.textContent = `PASS (${duration}ms)`;
        }
        if (evidenceEl) {
          evidenceEl.innerHTML = `<span class="evidence-icon">✓</span> <strong>Measured Evidence:</strong> ${result.evidence}`;
        }
        if (card) {
          card.className = 'claim-card card-pass';
        }
      } catch (err) {
        allPassed = false;
        const t1 = performance.now();
        const duration = (t1 - t0).toFixed(0);

        if (badge) {
          badge.className = 'claim-badge badge-fail';
          badge.textContent = `FAIL (${duration}ms)`;
        }
        if (evidenceEl) {
          evidenceEl.innerHTML = `<span class="evidence-icon fail">✗</span> <strong>Failure:</strong> ${/** @type {Error} */ (err).message}`;
        }
        if (card) {
          card.className = 'claim-card card-fail';
        }
      }
    }

    const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
    runBtn.disabled = false;
    runBtn.textContent = 'Re-run Verification Suite';

    if (allPassed) {
      statusBanner.className = 'claims-status-banner status-success';
      statusText.innerHTML = `<strong>All 5 physical claims verified successfully</strong> in ${totalTime}s. Measured dynamics strictly match theoretical predictions.`;
    } else {
      statusBanner.className = 'claims-status-banner status-failed';
      statusText.innerHTML = `<strong>Verification failed</strong> in ${totalTime}s. One or more assertions did not reproduce.`;
    }
  });
}
