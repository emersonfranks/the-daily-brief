// @ts-check

import { claims } from './claims.js';

/**
 * @param {HTMLElement} container
 */
export function initClaimsPanel(container) {
  container.innerHTML = `
    <div class="claims-header">
      <div class="claims-summary">
        <h3>Experimental Verification Suite</h3>
        <p>Run the 4 formal claims directly in your browser against live numerical integrations.</p>
      </div>
      <button id="run-all-claims-btn" class="btn btn-primary">Run In-Browser Tests</button>
    </div>
    <div id="claims-list" class="claims-list"></div>
  `;

  const listEl = /** @type {HTMLElement} */ (container.querySelector('#claims-list'));
  const runBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#run-all-claims-btn'));

  renderEmptyList();

  function renderEmptyList() {
    listEl.innerHTML = claims
      .map(
        (c, idx) => `
      <div class="claim-card" id="claim-card-${idx}">
        <div class="claim-top">
          <span class="claim-index">CLAIM 0${idx + 1}</span>
          <h4 class="claim-title">${c.name}</h4>
          <span class="claim-status status-pending">UNTESTED</span>
        </div>
        <div class="claim-desc">${c.description}</div>
        <div class="claim-evidence" id="claim-evidence-${idx}">Awaiting execution...</div>
      </div>
    `
      )
      .join('');
  }

  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Running tests...';

    for (let idx = 0; idx < claims.length; idx++) {
      const c = claims[idx];
      const card = /** @type {HTMLElement} */ (document.getElementById(`claim-card-${idx}`));
      const statusBadge = /** @type {HTMLElement} */ (card.querySelector('.claim-status'));
      const evidenceEl = /** @type {HTMLElement} */ (document.getElementById(`claim-evidence-${idx}`));

      statusBadge.className = 'claim-status status-running';
      statusBadge.textContent = 'MEASURING...';

      await new Promise((r) => setTimeout(r, 40));

      const t0 = performance.now();
      try {
        const evidence = await c.verify();
        const duration = (performance.now() - t0).toFixed(1);
        statusBadge.className = 'claim-status status-passed';
        statusBadge.textContent = `PASS (${duration}ms)`;
        evidenceEl.className = 'claim-evidence evidence-pass';
        evidenceEl.textContent = `Measured Evidence: ${evidence}`;
      } catch (err) {
        const duration = (performance.now() - t0).toFixed(1);
        statusBadge.className = 'claim-status status-failed';
        statusBadge.textContent = `FAIL (${duration}ms)`;
        evidenceEl.className = 'claim-evidence evidence-fail';
        evidenceEl.textContent = `Failure: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    runBtn.disabled = false;
    runBtn.textContent = 'Re-Run All Tests';
  });
}
