// @ts-check

/**
 * The reader's copy of the test suite. It imports the same `claims.js` that `node --test` runs in
 * CI, so what the button checks and what the deploy gate checks cannot drift apart.
 */

import { claims } from './claims.js';

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function make(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {HTMLElement} host
 */
export function mountClaimsPanel(host) {
  const runAll = make('button', 'runall', 'run all eight checks');
  host.appendChild(runAll);

  /** @type {(() => void)[]} */
  const runners = [];

  for (const claim of claims) {
    const card = make('div', 'claim');
    const head = make('div', 'claim-head');
    const light = make('span', 'light idle', '\u25cf');
    head.appendChild(light);
    head.appendChild(make('span', 'claim-name', claim.name));
    const run = make('button', 'runone', 'run');
    head.appendChild(run);
    card.appendChild(head);
    card.appendChild(make('p', 'claim-catches', claim.catches));
    const evidence = make('dl', 'evidence');
    card.appendChild(evidence);
    host.appendChild(card);

    const execute = () => {
      evidence.textContent = '';
      light.className = 'light running';
      try {
        const result = claim.verify();
        light.className = 'light pass';
        light.textContent = '\u25cf';
        for (const [k, v] of Object.entries(result)) {
          evidence.appendChild(make('dt', 'ev-k', k));
          evidence.appendChild(make('dd', 'ev-v', v));
        }
      } catch (error) {
        light.className = 'light fail';
        light.textContent = '\u25cf';
        evidence.appendChild(make('dt', 'ev-k', 'FAILED'));
        evidence.appendChild(
          make('dd', 'ev-v fail-text', error instanceof Error ? error.message : String(error))
        );
      }
    };

    run.addEventListener('click', execute);
    runners.push(execute);
  }

  runAll.addEventListener('click', () => {
    runAll.textContent = 'running\u2026';
    setTimeout(() => {
      for (const r of runners) r();
      runAll.textContent = 'run all eight checks again';
    }, 20);
  });
}
