// @ts-check
import { CLAIMS } from './claims.js';

/**
 * Mounts and manages the interactive in-browser Claims & Proof Suite panel.
 * @param {HTMLElement} containerEl
 */
export function mountClaimsPanel(containerEl) {
  containerEl.innerHTML = `
    <div class="claims-header">
      <div class="claims-summary-title">
        <h3>Live Empirical Invariant & Proof Suite</h3>
        <p class="text-sm text-muted">
          Every mathematical invariant and behavioral claim below runs directly inside your browser engine.
          Click below to execute the headless solver across all topological testbeds and inspect measured evidence.
        </p>
      </div>
      <button id="run-claims-btn" class="btn btn-primary">
        <span class="btn-icon">⚡</span> Run All Proofs
      </button>
    </div>
    <div id="claims-results-list" class="claims-list"></div>
  `;

  const resultsListEl = containerEl.querySelector('#claims-results-list');
  const runBtn = containerEl.querySelector('#run-claims-btn');

  if (!resultsListEl || !runBtn) return;

  // Initial render of empty/pending cards
  renderClaimsCards(CLAIMS.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    catches: c.catches,
    passed: false,
    evidence: 'Not yet executed — click "Run All Proofs" to measure live.',
    metrics: {},
    status: 'pending'
  })), resultsListEl);

  runBtn.addEventListener('click', async () => {
    runBtn.setAttribute('disabled', 'true');
    runBtn.innerHTML = `<span class="spinner"></span> Running Proofs...`;

    // Reset status to running
    renderClaimsCards(CLAIMS.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      catches: c.catches,
      passed: false,
      evidence: 'Executing simulation in headless state...',
      metrics: {},
      status: 'running'
    })), resultsListEl);

    // Yield to browser UI
    await new Promise(r => setTimeout(r, 60));

    try {
      const results = [];
      for (const claim of CLAIMS) {
        const res = await claim.verify();
        results.push({
          ...res,
          status: res.passed ? 'passed' : 'failed'
        });
      }
      renderClaimsCards(results, resultsListEl);
    } catch (err) {
      console.error('Error running browser claims:', err);
    } finally {
      runBtn.removeAttribute('disabled');
      runBtn.innerHTML = `<span class="btn-icon">⚡</span> Re-run Proof Suite`;
    }
  });
}

/**
 * @param {Array<{id: string, name: string, description: string, catches: string, passed: boolean, evidence: string, metrics: any, status?: string}>} items
 * @param {Element} targetEl
 */
function renderClaimsCards(items, targetEl) {
  targetEl.innerHTML = items.map(item => {
    const statusClass = item.status === 'passed' ? 'status-passed' : (item.status === 'failed' ? 'status-failed' : (item.status === 'running' ? 'status-running' : 'status-pending'));
    const statusLabel = item.status === 'passed' ? 'PASS' : (item.status === 'failed' ? 'FAIL' : (item.status === 'running' ? 'RUNNING' : 'STANDBY'));

    return `
      <div class="claim-card ${statusClass}">
        <div class="claim-card-header">
          <div class="claim-title-group">
            <span class="claim-badge ${statusClass}">${statusLabel}</span>
            <span class="claim-name">${escapeHtml(item.name)}</span>
          </div>
        </div>
        <p class="claim-desc">${escapeHtml(item.description)}</p>
        <div class="claim-catches">
          <span class="catches-tag">Catches:</span> ${escapeHtml(item.catches)}
        </div>
        <div class="claim-evidence">
          <span class="evidence-tag">Measured Evidence:</span>
          <code>${escapeHtml(item.evidence)}</code>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * @param {string} str
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
