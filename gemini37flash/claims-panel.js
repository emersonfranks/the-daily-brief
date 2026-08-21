// @ts-check
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
        <div>
          <h3>Universal Kuramoto Claims & Verification Suite</h3>
          <p class="subtitle">Execute the exact same mathematical assertions running in automated continuous integration directly inside this browser session.</p>
        </div>
        <button id="btn-run-claims" class="primary-btn">Run Verification Suite</button>
      </div>
      <div id="claims-results" class="claims-grid"></div>
    `;

    const btn = this.container.querySelector('#btn-run-claims');
    if (btn) {
      btn.addEventListener('click', () => this.runAll());
    }

    this.renderInitialCards();
  }

  renderInitialCards() {
    const list = this.container.querySelector('#claims-results');
    if (!list) return;

    list.innerHTML = claims.map((c) => `
      <div class="claim-card" id="claim-${c.id}">
        <div class="claim-card-header">
          <span class="claim-title">${c.title}</span>
          <span class="status-badge status-idle">Ready</span>
        </div>
        <div class="claim-desc">${c.description}</div>
        <div class="claim-evidence-block" style="display: none;"></div>
      </div>
    `).join('');
  }

  async runAll() {
    const btn = /** @type {HTMLButtonElement|null} */ (this.container.querySelector('#btn-run-claims'));
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verifying Claims...';
    }

    for (const claim of claims) {
      const card = this.container.querySelector(`#claim-${claim.id}`);
      if (!card) continue;

      const badge = card.querySelector('.status-badge');
      const evidenceEl = card.querySelector('.claim-evidence-block');

      if (badge) {
        badge.className = 'status-badge status-running';
        badge.textContent = 'Running...';
      }

      await new Promise((r) => setTimeout(r, 40));

      try {
        const res = await claim.verify();
        if (badge) {
          badge.className = 'status-badge status-pass';
          badge.textContent = 'Passed';
        }
        if (evidenceEl) {
          evidenceEl.innerHTML = `<pre><code>${JSON.stringify(res.evidence, null, 2)}</code></pre>`;
          // @ts-ignore
          evidenceEl.style.display = 'block';
        }
      } catch (err) {
        if (badge) {
          badge.className = 'status-badge status-fail';
          badge.textContent = 'Failed';
        }
        if (evidenceEl) {
          evidenceEl.innerHTML = `<div class="error-msg">${err instanceof Error ? err.message : String(err)}</div>`;
          // @ts-ignore
          evidenceEl.style.display = 'block';
        }
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Re-Run Verification Suite';
    }
  }
}
