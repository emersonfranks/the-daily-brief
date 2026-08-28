// @ts-check
import { claims } from './claims.js';

/**
 * Mounts interactive proof verification panel in the browser DOM
 * @param {HTMLElement} container
 */
export function mountClaimsPanel(container) {
  container.innerHTML = `
    <div class="proof-header">
      <div class="proof-title-row">
        <h3>Empirical Claims & Browser Verification Suite</h3>
        <button id="run-proof-btn" class="btn btn-primary">Run Proof Suite Live</button>
      </div>
      <p class="proof-sub">
        Every statement on this page is tested below against the headless simulation engine in your browser.
        Click above to re-evaluate all invariant bounds and verify the measured data.
      </p>
    </div>
    <div id="proof-results-list" class="proof-list"></div>
  `;

  const runBtn = container.querySelector('#run-proof-btn');
  const listEl = container.querySelector('#proof-results-list');

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';

    for (const claim of claims) {
      const card = document.createElement('div');
      card.className = 'proof-card';
      card.id = `claim-card-${claim.id}`;

      card.innerHTML = `
        <div class="proof-card-top">
          <span class="proof-claim-title">${claim.name}</span>
          <span class="proof-badge badge-pending">PENDING</span>
        </div>
        <p class="proof-claim-desc">${claim.description}</p>
        <div class="proof-claim-output" style="display: none;"></div>
      `;

      listEl.appendChild(card);
    }
  }

  function runAll() {
    if (!runBtn) return;
    runBtn.textContent = 'Running Suite...';
    runBtn.setAttribute('disabled', 'true');

    setTimeout(() => {
      let passedCount = 0;

      for (const claim of claims) {
        const card = container.querySelector(`#claim-card-${claim.id}`);
        if (!card) continue;

        const badge = card.querySelector('.proof-badge');
        const output = card.querySelector('.proof-claim-output');

        try {
          const res = claim.verify();
          if (res.passed) {
            passedCount++;
            if (badge) {
              badge.textContent = 'VERIFIED PASS';
              badge.className = 'proof-badge badge-pass';
            }
          } else {
            if (badge) {
              badge.textContent = 'FAILED';
              badge.className = 'proof-badge badge-fail';
            }
          }

          if (output instanceof HTMLElement) {
            output.style.display = 'block';
            output.innerHTML = `
              <div class="proof-summary">${res.summary}</div>
              <div class="proof-metrics">
                ${Object.entries(res.metrics)
                  .map(([k, v]) => `<span class="metric-tag"><strong>${k}:</strong> ${v}</span>`)
                  .join('')}
              </div>
            `;
          }
        } catch (err) {
          if (badge) {
            badge.textContent = 'ERROR';
            badge.className = 'proof-badge badge-fail';
          }
          if (output instanceof HTMLElement) {
            output.style.display = 'block';
            output.textContent = `Exception thrown: ${err instanceof Error ? err.message : String(err)}`;
          }
        }
      }

      runBtn.textContent = `Re-run Proofs (${passedCount}/${claims.length} Passed)`;
      runBtn.removeAttribute('disabled');
    }, 50);
  }

  if (runBtn) {
    runBtn.addEventListener('click', runAll);
  }

  renderList();
  // Auto-run once upon mount so page starts with evidence populated
  runAll();
}
