// @ts-check
import { claims, runClaim } from './claims.js';

/**
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function mustGet(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return /** @type {T} */ (el);
}

/**
 * @param {string} key
 * @returns {string}
 */
function humanise(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .toLowerCase();
}

/**
 * @param {import('./claims.js').Claim} claim
 * @param {number} index
 * @returns {HTMLLIElement}
 */
function renderClaim(claim, index) {
  const li = document.createElement('li');
  li.className = 'claim';
  li.id = `claim-${claim.id}`;

  const head = document.createElement('div');
  head.className = 'claim-head';
  const status = document.createElement('span');
  status.className = 'claim-status';
  status.textContent = '· · ·';
  const title = document.createElement('span');
  title.className = 'claim-title';
  title.textContent = `${index + 1}. ${claim.title}`;
  head.append(status, title);

  const catches = document.createElement('p');
  catches.className = 'claim-meta';
  const catchesLabel = document.createElement('b');
  catchesLabel.textContent = 'What it catches: ';
  catches.append(catchesLabel, document.createTextNode(claim.catches));

  const threshold = document.createElement('p');
  threshold.className = 'claim-meta';
  const thresholdLabel = document.createElement('b');
  thresholdLabel.textContent = 'Passes when: ';
  threshold.append(thresholdLabel, document.createTextNode(claim.threshold));

  const evidence = document.createElement('div');
  evidence.className = 'evidence';

  const error = document.createElement('p');
  error.className = 'claim-error';

  li.append(head, catches, threshold, evidence, error);
  return li;
}

/**
 * @param {HTMLElement} li
 * @param {import('./claims.js').ClaimResult} result
 */
function applyResult(li, result) {
  li.classList.remove('pass', 'fail');
  li.classList.add(result.ok ? 'pass' : 'fail');
  const status = li.querySelector('.claim-status');
  if (status) status.textContent = result.ok ? 'PASS' : 'FAIL';

  const evidence = li.querySelector('.evidence');
  if (evidence) {
    evidence.textContent = '';
    for (const [key, value] of Object.entries(result.evidence)) {
      const chip = document.createElement('span');
      const label = document.createElement('i');
      label.textContent = `${humanise(key)} `;
      chip.append(label, document.createTextNode(String(value)));
      evidence.append(chip);
    }
    if (result.ok) {
      const chip = document.createElement('span');
      const label = document.createElement('i');
      label.textContent = 'measured in ';
      chip.append(label, document.createTextNode(`${result.ms} ms`));
      evidence.append(chip);
    }
  }

  const error = li.querySelector('.claim-error');
  if (error) error.textContent = result.ok ? '' : result.error;
}

export function mountClaimsPanel() {
  const list = mustGet('claims-list');
  const button = /** @type {HTMLButtonElement} */ (mustGet('run-claims'));
  const summary = mustGet('claims-summary');

  /** @type {HTMLLIElement[]} */
  const items = claims.map((claim, index) => {
    const li = renderClaim(claim, index);
    list.append(li);
    return li;
  });

  button.addEventListener('click', async () => {
    button.disabled = true;
    summary.className = 'claims-summary';
    let passed = 0;
    const started = Date.now();
    for (let i = 0; i < claims.length; i++) {
      summary.textContent = `Running check ${i + 1} of ${claims.length}…`;
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const result = runClaim(claims[i]);
      if (result.ok) passed++;
      applyResult(items[i], result);
    }
    const elapsed = Date.now() - started;
    const allPassed = passed === claims.length;
    summary.className = `claims-summary ${allPassed ? 'pass' : 'fail'}`;
    summary.textContent = allPassed
      ? `All ${claims.length} checks passed in ${elapsed} ms.`
      : `${claims.length - passed} of ${claims.length} checks FAILED in ${elapsed} ms.`;
    button.disabled = false;
  });
}
