// @ts-check
import { CLAIMS } from './claims.js';

/**
 * @param {HTMLElement} container
 */
export function mountClaimsPanel(container) {
  container.innerHTML = `
    <div class="claims-header">
      <div class="claims-summary">
        <h3>Empirical Claims & Browser Test Suite</h3>
        <p>Run the exact same headless assertions that govern CI. Every claim evaluates the mathematical simulation directly in your browser.</p>
      </div>
      <button id="btn-run-claims" class="btn-primary">▶ Run Test Suite</button>
    </div>
    <div id="claims-list" class="claims-list"></div>
  `;

  const listEl = /** @type {HTMLElement} */ (container.querySelector('#claims-list'));
  const runBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#btn-run-claims'));

  renderClaimCards(listEl, null);

  runBtn.addEventListener('click', () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Running Assertions...';

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
            evidence: `Error during verification: ${err instanceof Error ? err.message : String(err)}`,
            metrics: {}
          };
        }
      });

      renderClaimCards(listEl, results);
      runBtn.disabled = false;
      runBtn.textContent = '↻ Re-run Test Suite';
    }, 40);
  });
}

/**
 * @param {HTMLElement} listEl
 * @param {any[] | null} results
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
          : `<div class="claim-evidence text-muted">Click "Run Test Suite" to execute this assertion live.</div>`
      }
    `;

    listEl.appendChild(card);
  });
}
