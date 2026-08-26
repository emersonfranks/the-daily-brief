// @ts-check
import { claims } from './claims.js';

/**
 * Runs the same claim modules Node runs, and shows the evidence each one measured.
 * @param {HTMLElement} root
 */
export function mountClaimsPanel(root) {
  const button = document.createElement('button');
  button.className = 'run-claims';
  button.textContent = `Run all ${claims.length} checks in this browser`;

  const summary = document.createElement('p');
  summary.className = 'claims-summary';
  summary.textContent = 'Not run yet.';

  const list = document.createElement('ol');
  list.className = 'claims-list';

  for (const claim of claims) {
    const item = document.createElement('li');
    item.id = `claim-${claim.id}`;
    item.innerHTML = `
      <div class="claim-head"><span class="claim-state" data-state="idle">idle</span>
      <span class="claim-title"></span></div>
      <p class="claim-catches"></p>
      <p class="claim-threshold"></p>
      <dl class="claim-evidence"></dl>`;
    const title = item.querySelector('.claim-title');
    const catches = item.querySelector('.claim-catches');
    const threshold = item.querySelector('.claim-threshold');
    if (title) title.textContent = claim.title;
    if (catches) catches.textContent = claim.catches;
    if (threshold) threshold.textContent = `Threshold: ${claim.threshold}`;
    list.appendChild(item);
  }

  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = 'Running\u2026';
    summary.textContent = '';
    window.setTimeout(() => {
      let passed = 0;
      const started = performance.now();
      for (const claim of claims) {
        const item = document.getElementById(`claim-${claim.id}`);
        if (!item) continue;
        const state = item.querySelector('.claim-state');
        const evidence = item.querySelector('.claim-evidence');
        if (!state || !evidence) continue;
        evidence.innerHTML = '';
        try {
          const measured = claim.verify();
          passed += 1;
          state.textContent = 'pass';
          state.setAttribute('data-state', 'pass');
          for (const [key, value] of Object.entries(measured)) {
            const dt = document.createElement('dt');
            dt.textContent = key;
            const dd = document.createElement('dd');
            dd.textContent = value;
            evidence.append(dt, dd);
          }
        } catch (error) {
          state.textContent = 'FAIL';
          state.setAttribute('data-state', 'fail');
          const dt = document.createElement('dt');
          dt.textContent = 'failure';
          const dd = document.createElement('dd');
          dd.textContent = error instanceof Error ? error.message : String(error);
          evidence.append(dt, dd);
        }
      }
      const elapsed = Math.round(performance.now() - started);
      summary.textContent = `${passed} of ${claims.length} passed, measured live in ${elapsed} ms.`;
      summary.className = passed === claims.length ? 'claims-summary ok' : 'claims-summary bad';
      button.disabled = false;
      button.textContent = 'Run them again';
    }, 20);
  });

  root.append(button, summary, list);
}
