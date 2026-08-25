// @ts-check

/**
 * The proof appendix. It imports the same `claims.js` that `node --test` runs,
 * so a reader watching the results here is watching the checks continuous
 * integration performs before this page is allowed to publish.
 */

import { claims } from './claims.js';

/** @param {number} ms */
const yieldToPaint = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {HTMLElement} root
 */
export function mountClaimsPanel(root) {
  const button = document.createElement('button');
  button.className = 'run-claims';
  button.textContent = `Run all ${claims.length} checks`;

  const summary = document.createElement('p');
  summary.className = 'claims-summary';
  summary.textContent = 'Not yet run. Each check re-runs the simulation in your browser and prints what it measured.';

  const list = document.createElement('ol');
  list.className = 'claims-list';

  /** @type {Map<string, HTMLLIElement>} */
  const rows = new Map();
  for (const claim of claims) {
    const item = document.createElement('li');
    item.className = 'claim pending';
    item.innerHTML = `
      <div class="claim-head"><span class="claim-state">waiting</span><span class="claim-title"></span></div>
      <p class="claim-catches"></p>
      <div class="claim-evidence"></div>`;
    const title = item.querySelector('.claim-title');
    const catches = item.querySelector('.claim-catches');
    if (title) title.textContent = claim.title;
    if (catches) catches.textContent = `Catches: ${claim.catches}`;
    rows.set(claim.id, item);
    list.append(item);
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    let passed = 0;
    let failed = 0;
    const started = performance.now();
    for (const claim of claims) {
      const row = rows.get(claim.id);
      if (!row) continue;
      row.className = 'claim running';
      const state = row.querySelector('.claim-state');
      const evidence = row.querySelector('.claim-evidence');
      if (state) state.textContent = 'running';
      if (evidence) evidence.textContent = '';
      summary.textContent = `Running "${claim.title}"…`;
      await yieldToPaint(16);

      try {
        const result = claim.verify();
        passed += 1;
        row.className = 'claim passed';
        if (state) state.textContent = 'passed';
        if (evidence) evidence.append(evidenceTable(result));
      } catch (error) {
        failed += 1;
        row.className = 'claim failed';
        if (state) state.textContent = 'failed';
        if (evidence) {
          const message = document.createElement('p');
          message.className = 'claim-error';
          message.textContent = error instanceof Error ? error.message : String(error);
          evidence.append(message);
        }
      }
      await yieldToPaint(16);
    }
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    summary.textContent = failed === 0
      ? `All ${passed} checks passed in ${seconds}s, measured just now on this machine.`
      : `${passed} passed, ${failed} failed in ${seconds}s. A failure here means a claim on this page is wrong.`;
    summary.className = failed === 0 ? 'claims-summary ok' : 'claims-summary bad';
    button.disabled = false;
    button.textContent = `Run all ${claims.length} checks again`;
  });

  root.append(button, summary, list);
}

/**
 * @param {Record<string, unknown>} result
 * @returns {HTMLElement}
 */
function evidenceTable(result) {
  const table = document.createElement('dl');
  table.className = 'evidence';
  for (const [key, value] of Object.entries(result)) {
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    table.append(dt, dd);
  }
  return table;
}
