// @ts-check

/**
 * @fileoverview Browser verification panel module.
 * Imports claims.js and renders live interactive verification buttons and evidence cards in the browser.
 */

import { claims } from './claims.js';

export class ClaimsPanel {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.container = container;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="claims-header">
        <div class="claims-summary-title">Empirical Claims & Live Browser Verification Suite</div>
        <p class="claims-intro">
          Each assertion below represents a core scientific prediction of nonreciprocal active matter and ecological dual dynamics.
          Run the tests live in your browser to measure the physical observables and verify the evidence.
        </p>
        <button id="btn-run-all-claims" class="btn-primary">▶ Run Complete Verification Suite</button>
      </div>
      <div class="claims-grid" id="claims-cards-container"></div>
    `;

    const cardsContainer = /** @type {HTMLElement} */ (this.container.querySelector('#claims-cards-container'));
    const btnRunAll = /** @type {HTMLButtonElement} */ (this.container.querySelector('#btn-run-all-claims'));

    claims.forEach((claim, idx) => {
      const card = document.createElement('div');
      card.className = 'claim-card';
      card.id = `claim-card-${claim.id}`;
      card.innerHTML = `
        <div class="claim-card-header">
          <span class="claim-badge">Claim ${idx + 1}</span>
          <h4 class="claim-name">${claim.name}</h4>
        </div>
        <div class="claim-catches"><strong>Protects Against:</strong> ${claim.catches}</div>
        <div class="claim-status-row">
          <button class="btn-secondary btn-verify-single" data-claim-id="${claim.id}">Verify Claim</button>
          <span class="claim-status-indicator" id="status-${claim.id}">Status: Untested</span>
        </div>
        <div class="claim-measured-box" id="measured-${claim.id}" style="display: none;">
          <div class="measured-title">Measured Live Evidence:</div>
          <div class="measured-data" id="data-${claim.id}"></div>
          <div class="measured-details" id="details-${claim.id}"></div>
        </div>
      `;
      cardsContainer.appendChild(card);
    });

    // Wire single-test buttons
    this.container.querySelectorAll('.btn-verify-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const claimId = /** @type {HTMLElement} */ (e.target).getAttribute('data-claim-id');
        if (claimId) this.runClaim(claimId);
      });
    });

    btnRunAll.addEventListener('click', () => {
      this.runAll();
    });
  }

  /**
   * Run a single claim test and display measured output.
   * @param {string} claimId
   */
  async runClaim(claimId) {
    const claim = claims.find(c => c.id === claimId);
    if (!claim) return;

    const statusEl = this.container.querySelector(`#status-${claim.id}`);
    const boxEl = /** @type {HTMLElement} */ (this.container.querySelector(`#measured-${claim.id}`));
    const dataEl = this.container.querySelector(`#data-${claim.id}`);
    const detailsEl = this.container.querySelector(`#details-${claim.id}`);

    if (statusEl) {
      statusEl.textContent = 'Running measurement...';
      statusEl.className = 'claim-status-indicator running';
    }

    // Small delay to allow UI refresh
    await new Promise(r => setTimeout(r, 40));

    try {
      const result = claim.verify();
      if (statusEl) {
        statusEl.textContent = result.passed ? '✔ PASSED' : '✖ FAILED';
        statusEl.className = `claim-status-indicator ${result.passed ? 'passed' : 'failed'}`;
      }
      if (boxEl && dataEl && detailsEl) {
        boxEl.style.display = 'block';
        dataEl.textContent = result.measured;
        detailsEl.textContent = result.details;
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = '✖ ERROR';
        statusEl.className = 'claim-status-indicator failed';
      }
      if (boxEl && dataEl) {
        boxEl.style.display = 'block';
        dataEl.textContent = `Exception: ${/** @type {Error} */ (err).message}`;
      }
    }
  }

  /**
   * Run all claims sequentially.
   */
  async runAll() {
    for (const claim of claims) {
      await this.runClaim(claim.id);
    }
  }
}
