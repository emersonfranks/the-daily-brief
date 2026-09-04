// @ts-check
import { claims } from './claims.js';

/**
 * Attaches the interactive scientific proof panel to the DOM
 * @param {HTMLElement} container
 */
export function initClaimsPanel(container) {
  container.innerHTML = `
    <div class="proof-header">
      <div class="proof-title-row">
        <h3>🔬 Live Scientific Verification & Empirical Proofs</h3>
        <button id="run-all-claims-btn" class="btn btn-primary">▶ Run All Proofs</button>
      </div>
      <p class="proof-desc">
        Run the exact same deterministic verification suite evaluated in automated continuous integration directly inside your browser. Each test executes the underlying statistical mechanics simulation headlessly and checks the measured invariants against theoretical bounds.
      </p>
    </div>
    <div class="claims-list" id="claims-list-container"></div>
  `;

  const listContainer = /** @type {HTMLElement} */ (container.querySelector('#claims-list-container'));
  const runAllBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#run-all-claims-btn'));

  claims.forEach((claim) => {
    const card = document.createElement('div');
    card.className = 'claim-card';
    card.id = `claim-card-${claim.id}`;
    card.innerHTML = `
      <div class="claim-card-header">
        <div class="claim-card-title-group">
          <span class="claim-badge pending" id="badge-${claim.id}">READY</span>
          <h4 class="claim-card-title">${claim.title}</h4>
        </div>
        <button class="btn btn-sm btn-outline run-single-btn" data-id="${claim.id}">Verify</button>
      </div>
      <p class="claim-hypothesis"><strong>Hypothesis:</strong> ${claim.hypothesis}</p>
      <p class="claim-expected"><strong>Expected:</strong> <code>${claim.expected}</code></p>
      <div class="claim-result" id="result-${claim.id}" style="display: none;">
        <div class="claim-measured" id="measured-${claim.id}"></div>
        <div class="claim-details" id="details-${claim.id}"></div>
      </div>
    `;

    const singleBtn = /** @type {HTMLButtonElement} */ (card.querySelector('.run-single-btn'));
    singleBtn.addEventListener('click', () => runSingleClaim(claim));

    listContainer.appendChild(card);
  });

  runAllBtn.addEventListener('click', async () => {
    runAllBtn.disabled = true;
    runAllBtn.textContent = '⏳ Verifying...';
    for (const claim of claims) {
      await runSingleClaim(claim);
    }
    runAllBtn.disabled = false;
    runAllBtn.textContent = '🔄 Re-Run All Proofs';
  });

  /**
   * @param {import('./claims.js').Claim} claim
   */
  async function runSingleClaim(claim) {
    const badge = /** @type {HTMLElement} */ (document.querySelector(`#badge-${claim.id}`));
    const resultBox = /** @type {HTMLElement} */ (document.querySelector(`#result-${claim.id}`));
    const measuredText = /** @type {HTMLElement} */ (document.querySelector(`#measured-${claim.id}`));
    const detailsText = /** @type {HTMLElement} */ (document.querySelector(`#details-${claim.id}`));

    badge.className = 'claim-badge running';
    badge.textContent = 'TESTING...';

    // Short UI pause so the animation feels responsive
    await new Promise((r) => setTimeout(r, 40));

    try {
      const res = await claim.verify();
      resultBox.style.display = 'block';

      if (res.passed) {
        badge.className = 'claim-badge passed';
        badge.textContent = 'PASSED ✓';
        measuredText.innerHTML = `<strong>Measured Evidence:</strong> <code>${res.measured}</code>`;
        detailsText.textContent = res.details;
      } else {
        badge.className = 'claim-badge failed';
        badge.textContent = 'FAILED ✗';
        measuredText.innerHTML = `<strong>Measured Evidence:</strong> <code>${res.measured}</code>`;
        detailsText.textContent = `Verification condition violated: ${res.details}`;
      }
    } catch (err) {
      resultBox.style.display = 'block';
      badge.className = 'claim-badge failed';
      badge.textContent = 'ERROR ✗';
      measuredText.textContent = 'Exception thrown during execution';
      detailsText.textContent = err instanceof Error ? err.message : String(err);
    }
  }
}
