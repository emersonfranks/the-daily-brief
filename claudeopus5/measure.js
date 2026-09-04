// @ts-check

/**
 * Headless measurement run. This exists to be run *before* the prose on the page was written, so
 * the numbers on the page are numbers this file produced rather than numbers that were hoped for.
 *
 * The predictions were written down first, together with what would falsify each:
 *
 *  P1  Uncoupled (Preisach limit): a closed excursion returns the ensemble to the exact state it
 *      left at the turning point. FALSIFIED BY any non-zero mismatch on any seed.
 *  P2  Unfrustrated coupling (every interaction positive): return point memory survives, at every
 *      coupling strength tested. FALSIFIED BY any non-zero mismatch.
 *  P3  Frustrated coupling (mixed signs): return point memory fails above some threshold coupling.
 *      FALSIFIED BY zero mismatch everywhere on the grid, up to the strongest coupling tested.
 *  P4  Avalanches larger than a single switch require interaction. FALSIFIED BY an avalanche of
 *      two or more switches in the uncoupled ensemble under a small drive increment.
 *  P5  Wiping-out: an inner excursion that is later overwritten by a larger one leaves no trace,
 *      so two different histories converge on one state. FALSIFIED BY any mismatch at coupling 0.
 *  P6  Subharmonic response: under repeated identical cycles, some frustrated ensembles need more
 *      than one cycle to repeat themselves. FALSIFIED BY period 1 for every seed and coupling.
 *
 * Run: node claudeopus5/measure.js
 */

import {
  createEnsemble, sweepTo, saturateDown, snapshot, mismatch,
  returnPointExcursion, limitCyclePeriod,
} from './hysterons.js';

const N = 60;
const SEEDS = 40;
const INCREMENT = 0.01;

/**
 * @param {import('./hysterons.js').CouplingKind} kind
 * @param {number} strength
 * @returns {{ worstMismatch: number, failingSeeds: number }}
 */
function rpmSurvey(kind, strength) {
  let worstMismatch = 0;
  let failingSeeds = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const ensemble = createEnsemble({ n: N, seed, kind, couplingStrength: strength });
    const turningPoint = 0.15 + 0.5 * ((seed % 7) / 7);
    const bottom = -0.35 - 0.4 * ((seed % 5) / 5);
    const { mismatched } = returnPointExcursion(ensemble, turningPoint, bottom, INCREMENT);
    if (mismatched > 0) failingSeeds += 1;
    worstMismatch = Math.max(worstMismatch, mismatched);
  }
  return { worstMismatch, failingSeeds };
}

console.log('=== P1/P2/P3  return point memory ===');
const grid = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.6, 0.9];
console.log('kind        coupling   worst mismatch (of 60)   seeds failing (of 40)');
for (const kind of /** @type {const} */ (['none', 'ferro', 'frustrated'])) {
  for (const strength of grid) {
    if (kind === 'none' && strength !== 0) continue;
    if (kind !== 'none' && strength === 0) continue;
    const { worstMismatch, failingSeeds } = rpmSurvey(kind, strength);
    console.log(`${kind.padEnd(11)} ${String(strength).padEnd(10)} ${String(worstMismatch).padEnd(24)} ${failingSeeds}`);
  }
}

console.log('\n=== P4  avalanche sizes over a full up-sweep ===');
console.log('kind        coupling   largest avalanche   mean avalanche   non-convergent sweeps');
for (const kind of /** @type {const} */ (['none', 'ferro', 'frustrated'])) {
  for (const strength of grid) {
    if (kind === 'none' && strength !== 0) continue;
    if (kind !== 'none' && strength === 0) continue;
    let largest = 0;
    let total = 0;
    let count = 0;
    let nonConvergent = 0;
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const ensemble = createEnsemble({ n: N, seed, kind, couplingStrength: strength });
      saturateDown(ensemble);
      const { flips, maxAvalanche, converged } = sweepTo(ensemble, 1.4, INCREMENT);
      largest = Math.max(largest, maxAvalanche);
      for (const f of flips) { total += f; count += 1; }
      if (!converged) nonConvergent += 1;
    }
    const mean = count === 0 ? 0 : total / count;
    console.log(`${kind.padEnd(11)} ${String(strength).padEnd(10)} ${String(largest).padEnd(19)} ${mean.toFixed(3).padEnd(16)} ${nonConvergent}`);
  }
}

console.log('\n=== P5  wiping-out ===');
{
  let worst = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const a = createEnsemble({ n: N, seed, kind: 'none' });
    saturateDown(a);
    sweepTo(a, 0.35, INCREMENT);
    sweepTo(a, -0.2, INCREMENT);
    sweepTo(a, 0.95, INCREMENT);
    sweepTo(a, 0, INCREMENT);
    const b = createEnsemble({ n: N, seed, kind: 'none' });
    saturateDown(b);
    sweepTo(b, 0.95, INCREMENT);
    sweepTo(b, 0, INCREMENT);
    worst = Math.max(worst, mismatch(snapshot(a), snapshot(b)));
  }
  console.log(`histories with and without the wiped inner excursion differ by at most ${worst} of ${N} switches`);
}

console.log('\n=== P6  subharmonic response under repeated identical cycles ===');
console.log('kind        coupling   seeds with period > 1   largest period seen   seeds never repeating');
for (const kind of /** @type {const} */ (['none', 'ferro', 'frustrated'])) {
  for (const strength of grid) {
    if (kind === 'none' && strength !== 0) continue;
    if (kind !== 'none' && strength === 0) continue;
    let subharmonic = 0;
    let largest = 0;
    let never = 0;
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const ensemble = createEnsemble({ n: N, seed, kind, couplingStrength: strength });
      const { period } = limitCyclePeriod(ensemble, -0.5, 0.5, 12, 0.02);
      if (period === 0) never += 1;
      else if (period > 1) subharmonic += 1;
      largest = Math.max(largest, period);
    }
    console.log(`${kind.padEnd(11)} ${String(strength).padEnd(10)} ${String(subharmonic).padEnd(23)} ${String(largest).padEnd(21)} ${never}`);
  }
}
