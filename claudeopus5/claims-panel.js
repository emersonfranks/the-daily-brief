// @ts-check
/**
 * Browser-side runner for the claim suite.
 *
 * Deliberately not named `test-*.js`: Node's test discovery matches that
 * pattern and would try to execute this file, where it would die on the first
 * mention of `document`.
 *
 * It imports the identical `claims.js` that `network.test.js` hands to
 * `node --test`, so what a reader runs here is what CI runs before the page is
 * allowed to publish. There is no browser-only copy to drift out of step.
 */

import { claims } from './claims.js';

/**
 * @param {HTMLElement} root
 */
export function mountClaimsPanel(root) {
  root.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'claims-bar';

  const button = document.createElement('button');
  button.className = 'run-claims';
  button.type = 'button';
  button.textContent = `Run all ${claims.length} checks in your browser`;

  const summary = document.createElement('p');
  summary.className = 'claims-summary';
  summary.textContent = 'Not run yet.';

  bar.append(button, summary);

  const list = document.createElement('ol');
  list.className = 'claims-list';

  /** @type {Array<{ item: HTMLLIElement, status: HTMLSpanElement, evidence: HTMLParagraphElement }>} */
  const entries = claims.map((claim) => {
    const item = document.createElement('li');
    item.className = 'claim pending';

    const head = document.createElement('div');
    head.className = 'claim-head';

    const status = document.createElement('span');
    status.className = 'claim-status';
    status.textContent = '\u2022';

    const title = document.createElement('span');
    title.className = 'claim-title';
    title.textContent = claim.title;

    head.append(status, title);

    const catches = document.createElement('p');
    catches.className = 'claim-catches';
    catches.textContent = `Catches: ${claim.catches}`;

    const evidence = document.createElement('p');
    evidence.className = 'claim-evidence';
    evidence.textContent = 'Waiting to run.';

    const id = document.createElement('code');
    id.className = 'claim-id';
    id.textContent = claim.id;

    item.append(head, catches, evidence, id);
    list.append(item);
    return { item, status, evidence };
  });

  root.append(bar, list);

  button.addEventListener('click', () => {
    button.disabled = true;
    summary.textContent = 'Running\u2026';
    for (const e of entries) {
      e.item.className = 'claim pending';
      e.status.textContent = '\u2022';
      e.evidence.textContent = 'Running\u2026';
    }

    // Yield once so the "running" state actually paints before the (fast, but
    // synchronous) suite blocks the main thread.
    window.setTimeout(() => {
      let passed = 0;
      const startedAt = performance.now();
      claims.forEach((claim, i) => {
        const entry = entries[i];
        try {
          const evidence = claim.verify();
          entry.item.className = 'claim pass';
          entry.status.textContent = '\u2713';
          entry.evidence.textContent = `Measured: ${evidence}`;
          passed++;
        } catch (error) {
          entry.item.className = 'claim fail';
          entry.status.textContent = '\u2717';
          entry.evidence.textContent = `Failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      });
      const ms = Math.round(performance.now() - startedAt);
      summary.textContent =
        passed === claims.length
          ? `${passed} of ${claims.length} checks passed, in ${ms} ms, on your machine.`
          : `${passed} of ${claims.length} passed \u2014 ${claims.length - passed} FAILED. The page is wrong, not the test.`;
      summary.className = passed === claims.length ? 'claims-summary ok' : 'claims-summary bad';
      button.disabled = false;
      button.textContent = `Run all ${claims.length} checks again`;
    }, 16);
  });
}
