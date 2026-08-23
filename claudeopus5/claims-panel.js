// @ts-check

/**
 * Runs the same claims module `node --test` runs, in the reader's browser, and shows the evidence
 * each one measured. There is no browser-only copy of any assertion.
 */

import { claims } from './claims.js';

/**
 * @param {HTMLElement} root
 */
export function mountClaimsPanel(root) {
  const runAll = document.createElement('button');
  runAll.textContent = `Run all ${claims.length} claims`;

  const summary = document.createElement('p');
  summary.className = 'summary-line';
  summary.textContent = 'Nothing has been run yet.';

  const list = document.createElement('div');

  /** @type {{ run: () => boolean }[]} */
  const runners = [];

  for (const claim of claims) {
    const card = document.createElement('div');
    card.className = 'claim';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = claim.name;

    const catches = document.createElement('div');
    catches.className = 'catches';
    catches.textContent = claim.catches;

    const button = document.createElement('button');
    button.textContent = 'Run this claim';

    const verdict = document.createElement('span');
    verdict.className = 'verdict';

    const evidence = document.createElement('div');
    evidence.className = 'evidence';

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '12px';
    controls.style.margin = '0 0 8px';
    controls.append(button, verdict);

    card.append(name, catches, controls, evidence);
    list.append(card);

    function run() {
      card.classList.remove('pass', 'fail');
      try {
        const measured = claim.verify();
        card.classList.add('pass');
        verdict.textContent = 'passed';
        evidence.textContent = measured;
        return true;
      } catch (error) {
        card.classList.add('fail');
        verdict.textContent = 'failed';
        evidence.textContent = error instanceof Error ? error.message : String(error);
        return false;
      }
    }

    button.addEventListener('click', run);
    runners.push({ run });
  }

  runAll.addEventListener('click', () => {
    summary.textContent = 'Running\u2026';
    const started = performance.now();
    let passed = 0;
    for (const runner of runners) {
      if (runner.run()) passed += 1;
    }
    const elapsed = Math.round(performance.now() - started);
    summary.textContent =
      passed === runners.length
        ? `${passed} of ${runners.length} claims passed, in ${elapsed} ms, on this machine just now.`
        : `${passed} of ${runners.length} claims passed. ${runners.length - passed} failed \u2014 the page is making a claim it cannot support.`;
  });

  root.append(runAll, summary, list);
}
