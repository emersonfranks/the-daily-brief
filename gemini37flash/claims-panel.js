// @ts-check

import { claims } from './claims.js';

export class ClaimsPanel {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.container = container;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="claims-header">
        <div class="claims-header-title">
          <h3>Empirical Proof & Verification Suite</h3>
          <p>Execute the exact assertions that prove conservative invariants, critical branching equilibrium, and power-law scaling directly in your browser.</p>
        </div>
        <button id="btn-run-claims" class="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          Run Proof Suite
        </button>
      </div>
      <div id="claims-list" class="claims-grid">
        ${claims
          .map(
            claim => `
          <div class="claim-card" id="${claim.id}">
            <div class="claim-card-top">
              <span class="claim-name">${claim.name}</span>
              <span class="claim-status status-pending">PENDING</span>
            </div>
            <p class="claim-statement">${claim.statement}</p>
            <div class="claim-falsify"><strong>Falsification condition:</strong> ${claim.falsification}</div>
            <div class="claim-results" style="display: none;"></div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    const btn = this.container.querySelector('#btn-run-claims');
    if (btn) {
      btn.addEventListener('click', () => this.runAll());
    }
  }

  async runAll() {
    const btn = /** @type {HTMLButtonElement | null} */ (this.container.querySelector('#btn-run-claims'));
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `Running Proofs...`;
    }

    for (const claim of claims) {
      const card = this.container.querySelector(`#${claim.id}`);
      if (!card) continue;

      const badge = card.querySelector('.claim-status');
      const resultsDiv = /** @type {HTMLElement | null} */ (card.querySelector('.claim-results'));

      if (badge) {
        badge.className = 'claim-status status-running';
        badge.textContent = 'RUNNING';
      }

      await new Promise(r => setTimeout(r, 40));
      const startTime = performance.now();

      try {
        const res = await claim.verify();
        const duration = (performance.now() - startTime).toFixed(1);

        if (badge) {
          badge.className = 'claim-status status-pass';
          badge.textContent = `PASS (${duration}ms)`;
        }

        if (resultsDiv) {
          resultsDiv.style.display = 'block';
          const metricsRows = Object.entries(res.metrics)
            .map(([k, v]) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`)
            .join('');

          resultsDiv.innerHTML = `
            <div class="claim-summary-text">${res.summary}</div>
            <table class="claim-metrics-table">
              <tbody>${metricsRows}</tbody>
            </table>
          `;
        }
      } catch (err) {
        const duration = (performance.now() - startTime).toFixed(1);
        if (badge) {
          badge.className = 'claim-status status-fail';
          badge.textContent = `FAIL (${duration}ms)`;
        }
        if (resultsDiv) {
          resultsDiv.style.display = 'block';
          resultsDiv.innerHTML = `
            <div class="claim-error-text">Error: ${/** @type {Error} */ (err).message}</div>
          `;
        }
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        Re-run Proof Suite
      `;
    }
  }
}
