// @ts-check
// Browser-side runner. Imports the SAME claims.js that node --test runs and
// renders each result with the evidence it measured. Named claims-panel.js, not
// test-*.js, so Node never tries to execute it as a test.

import { claims } from './claims.js';

/** @param {HTMLElement | null} root */
export function mountClaimsPanel(root) {
  if (!root) return;
  const list = document.createElement('div');
  list.className = 'claimlist';
  root.appendChild(list);

  const rows = claims.map((claim) => {
    const row = document.createElement('div');
    row.className = 'claim';
    row.innerHTML = `
      <div class="claim-head">
        <span class="dot"></span>
        <span class="claim-name">${claim.name}</span>
      </div>
      <div class="claim-catch">${claim.catches}</div>
      <div class="claim-evidence">not run</div>`;
    list.appendChild(row);
    return { claim, row };
  });

  const btn = document.createElement('button');
  btn.className = 'runbtn';
  btn.textContent = 'Run all checks in your browser';
  root.insertBefore(btn, list);

  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Measuring…';
    // Let the label paint before the synchronous Monte-Carlo work runs.
    setTimeout(() => {
      let passed = 0;
      for (const { claim, row } of rows) {
        const ev = /** @type {HTMLElement} */ (row.querySelector('.claim-evidence'));
        try {
          const result = claim.verify();
          const parts = Object.entries(result).map(([k, v]) => `${k} = ${v}`);
          ev.textContent = parts.join('   ·   ');
          row.classList.remove('fail');
          row.classList.add('pass');
          passed++;
        } catch (err) {
          ev.textContent = String(err instanceof Error ? err.message : err);
          row.classList.remove('pass');
          row.classList.add('fail');
        }
      }
      btn.disabled = false;
      btn.textContent = `Re-run  (${passed}/${rows.length} passed)`;
    }, 30);
  });
}
