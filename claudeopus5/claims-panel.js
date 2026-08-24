// @ts-check

/**
 * Browser side of the proof appendix. Imports the same `claims.js` that
 * `node --test` runs, so a reader clicking the button executes the assertions CI
 * executes rather than a replica that could drift away from them.
 *
 * Deliberately not named test-*.js: Node's test runner would pick that pattern up
 * and try to run this file, which dies on the first mention of `document`.
 */

import { claims } from './claims.js';

/** @returns {Promise<void>} Lets the browser paint between claims. */
function yieldToPaint() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * @param {object} options
 * @param {HTMLElement} options.list
 * @param {HTMLButtonElement} options.button
 * @param {HTMLElement} options.summary
 */
export function mountClaimsPanel({ list, button, summary }) {
  /** @type {Map<string, HTMLElement>} */
  const bodies = new Map();

  for (const claim of claims) {
    const item = document.createElement('li');
    item.className = 'claim';
    item.dataset.state = 'idle';

    const title = document.createElement('h3');
    title.textContent = claim.title;

    const catches = document.createElement('p');
    catches.className = 'catches';
    catches.innerHTML = `<b>What a failure would mean.</b> ${claim.catches}`;

    const bound = document.createElement('p');
    bound.className = 'bound';
    bound.innerHTML = `<b>Threshold.</b> ${claim.bound}`;

    const body = document.createElement('div');
    body.className = 'claim-evidence';
    body.textContent = 'not run yet';

    item.append(title, catches, bound, body);
    list.append(item);
    bodies.set(claim.id, item);
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    let passed = 0;
    let failed = 0;

    for (const claim of claims) {
      const item = /** @type {HTMLElement} */ (bodies.get(claim.id));
      const body = /** @type {HTMLElement} */ (item.querySelector('.claim-evidence'));
      item.dataset.state = 'running';
      body.textContent = 'measuring\u2026';
      summary.textContent = `running ${claim.title.toLowerCase()}\u2026`;
      await yieldToPaint();

      try {
        const evidence = claim.verify();
        item.dataset.state = 'pass';
        body.replaceChildren(...evidence.map(renderRow));
        passed++;
      } catch (error) {
        item.dataset.state = 'fail';
        const message = document.createElement('p');
        message.className = 'evidence-fail';
        message.textContent = error instanceof Error ? error.message : String(error);
        body.replaceChildren(message);
        failed++;
      }
      await yieldToPaint();
    }

    summary.textContent = failed === 0
      ? `${passed} of ${claims.length} claims verified against a live run`
      : `${failed} of ${claims.length} claims FAILED on this run`;
    summary.dataset.state = failed === 0 ? 'pass' : 'fail';
    button.disabled = false;
    button.textContent = 'run all claims again';
  });
}

/**
 * @param {{ label: string, value: string, ok?: boolean }} row
 * @returns {HTMLElement}
 */
function renderRow(row) {
  const line = document.createElement('p');
  line.className = 'evidence-row';
  const label = document.createElement('span');
  label.className = 'evidence-label';
  label.textContent = row.label;
  const value = document.createElement('span');
  value.className = 'evidence-value';
  value.textContent = row.value;
  line.append(label, value);
  return line;
}
