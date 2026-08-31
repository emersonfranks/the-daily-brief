// @ts-check

/**
 * Browser-side runner for `claims.js`. It imports exactly the same assertions that
 * `policy.test.js` hands to `node --test`, so what a reader sees here and what CI checks cannot
 * drift apart. Deliberately not named `test-*.js`: Node's test discovery matches that pattern and
 * would try to execute this file, where it would die on the first mention of `document`.
 */

import { claims, runClaim } from './claims.js';

/**
 * @param {HTMLElement} root
 */
export function mountClaimsPanel(root) {
  const button = document.createElement('button');
  button.className = 'run-claims';
  button.type = 'button';
  button.textContent = `Run all ${claims.length} claims in this browser`;

  const status = document.createElement('p');
  status.className = 'claims-status';
  status.textContent =
    'Nothing has been run yet. Every number below is measured when you press the button, on this ' +
    'machine, by the same code the test runner uses.';

  const list = document.createElement('ol');
  list.className = 'claims-list';

  for (const claim of claims) {
    const item = document.createElement('li');
    item.dataset.state = 'idle';
    item.innerHTML =
      `<div class="claim-head"><span class="claim-flag">--</span>` +
      `<span class="claim-name"></span></div>` +
      `<p class="claim-catches"></p>` +
      `<p class="claim-evidence">not yet run</p>`;
    const nameNode = item.querySelector('.claim-name');
    const catchesNode = item.querySelector('.claim-catches');
    if (nameNode) nameNode.textContent = claim.name;
    if (catchesNode) catchesNode.textContent = `Catches: ${claim.catches}`;
    item.id = `claim-${claim.id}`;
    list.appendChild(item);
  }

  button.addEventListener('click', () => {
    button.setAttribute('disabled', 'disabled');
    status.textContent = 'Running...';
    // Yield so the "Running..." text paints before the main thread is taken.
    setTimeout(() => {
      let passed = 0;
      const started = Date.now();
      for (const claim of claims) {
        const result = runClaim(claim);
        if (result.passed) passed += 1;
        const item = document.getElementById(`claim-${claim.id}`);
        if (!item) continue;
        item.dataset.state = result.passed ? 'pass' : 'fail';
        const flag = item.querySelector('.claim-flag');
        const evidence = item.querySelector('.claim-evidence');
        if (flag) flag.textContent = result.passed ? 'PASS' : 'FAIL';
        if (evidence) {
          evidence.textContent = result.passed
            ? `Measured: ${result.evidence}`
            : `Failed: ${result.evidence}`;
        }
      }
      const elapsed = Date.now() - started;
      status.textContent =
        `${passed} of ${claims.length} claims passed in ${elapsed} ms. ` +
        (passed === claims.length
          ? 'Two of those claims assert that predictions this page registered in advance turned ' +
            'out to be wrong. They are tests so that the page cannot quietly stop admitting it.'
          : 'A claim failed. The page is making a statement it cannot support, and the statement ' +
            'is the thing that should change.');
      status.dataset.state = passed === claims.length ? 'pass' : 'fail';
      button.removeAttribute('disabled');
    }, 30);
  });

  root.append(button, status, list);
}
