// @ts-check

import { CLAIMS, measure } from './claims.js';

/**
 * Runs the claims in the reader's browser. The simulation is pumped one census at a time so the
 * page keeps painting instead of freezing for two seconds.
 */

const PASS = '\u2713';
const FAIL = '\u2717';

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function mustGet(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element #${id}`);
  return element;
}

const runButton = mustGet('run-claims');
const status = mustGet('claims-status');
const progressBar = mustGet('claims-progress');
const progressFill = mustGet('claims-progress-fill');
const tableBody = mustGet('claims-rows');

/** @type {Map<string, { status: HTMLElement, evidence: HTMLElement }>} */
const rows = new Map();

function buildRows() {
  tableBody.replaceChildren();
  for (const claim of CLAIMS) {
    const row = document.createElement('tr');

    const statusCell = document.createElement('td');
    statusCell.className = 'claim-status';
    statusCell.textContent = '\u00b7';

    const nameCell = document.createElement('td');
    const name = document.createElement('div');
    name.className = 'claim-name';
    name.textContent = claim.name;
    const catches = document.createElement('div');
    catches.className = 'claim-catches';
    catches.textContent = `catches ${claim.catches}`;
    nameCell.append(name, catches);

    const evidenceCell = document.createElement('td');
    evidenceCell.className = 'claim-evidence';
    evidenceCell.textContent = 'not run yet';

    row.append(statusCell, nameCell, evidenceCell);
    tableBody.append(row);
    rows.set(claim.name, { status: statusCell, evidence: evidenceCell });
  }
}

/** @param {number} fraction */
function setProgress(fraction) {
  progressFill.style.width = `${Math.round(fraction * 100)}%`;
}

/** Lets the browser paint between slices of a synchronous simulation. */
function yieldToBrowser() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * @param {import('./claims.js').Claim} claim
 * @param {import('./claims.js').Measurement | null} measurement
 * @returns {boolean}
 */
function verifyInto(claim, measurement) {
  const row = rows.get(claim.name);
  if (!row) return false;
  try {
    const evidence = claim.verify(measurement);
    row.status.textContent = PASS;
    row.status.className = 'claim-status pass';
    row.evidence.textContent = evidence;
    row.evidence.className = 'claim-evidence';
    return true;
  } catch (error) {
    row.status.textContent = FAIL;
    row.status.className = 'claim-status fail';
    row.evidence.textContent = error instanceof Error ? error.message : String(error);
    row.evidence.className = 'claim-evidence failed';
    return false;
  }
}

async function runAll() {
  runButton.setAttribute('disabled', 'true');
  runButton.textContent = 'Running\u2026';
  progressBar.classList.add('busy');
  setProgress(0);
  document.dispatchEvent(new CustomEvent('brief:pause'));

  for (const { status: cell, evidence } of rows.values()) {
    cell.textContent = '\u00b7';
    cell.className = 'claim-status';
    evidence.textContent = 'waiting';
    evidence.className = 'claim-evidence';
  }

  const started = performance.now();
  let passed = 0;

  status.textContent = 'Checking the claims that need no simulation\u2026';
  for (const claim of CLAIMS.filter(c => !c.needsMeasurement)) {
    if (verifyInto(claim, null)) passed++;
  }
  await yieldToBrowser();

  status.textContent = 'Running the simulation from scratch\u2026';
  const iterator = measure();
  let step = iterator.next();
  while (!step.done) {
    setProgress(step.value.sweep / step.value.sweeps);
    await yieldToBrowser();
    step = iterator.next();
  }
  setProgress(1);

  const measurement = step.value;
  status.textContent = 'Checking the measured claims\u2026';
  await yieldToBrowser();
  for (const claim of CLAIMS.filter(c => c.needsMeasurement)) {
    if (verifyInto(claim, measurement)) passed++;
  }

  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const failed = CLAIMS.length - passed;
  status.textContent = failed === 0
    ? `${passed} of ${CLAIMS.length} claims held, in ${seconds}s. Nothing on this page is decoration.`
    : `${failed} of ${CLAIMS.length} claims failed. The page is wrong, and I would like to know.`;
  status.className = failed === 0 ? 'claims-status pass' : 'claims-status fail';

  progressBar.classList.remove('busy');
  runButton.removeAttribute('disabled');
  runButton.textContent = 'Run them again';
  document.dispatchEvent(new CustomEvent('brief:resume'));
}

runButton.addEventListener('click', () => { void runAll(); });
buildRows();
mustGet('claims-count').textContent = String(CLAIMS.length);
