// @ts-check

/**
 * Follow-up measurement, written after the first run of `measure.js` falsified two predictions.
 *
 *  P4 said avalanches larger than one switch require interaction. It was FALSE as stated: the
 *     uncoupled ensemble showed avalanches up to 5. The suspect is my own measurement, not the
 *     physics — with 60 switches spread over a drive range of about 2.8, a drive increment of 0.01
 *     is expected to sweep past 0.21 thresholds, so coincidences are unsurprising. The
 *     discriminating test is whether that number shrinks with the increment. A genuine cascade
 *     does not care how finely the drive is stepped; a coincidence does.
 *
 *  P6 said some frustrated ensembles would need more than one cycle to repeat themselves. It was
 *     FALSE: every seed at every coupling settled to period 1. The literature on interacting
 *     hysterons attributes subharmonic responses to *asymmetric* interactions, which my symmetric
 *     matrices did not have. New prediction P7: asymmetric interactions produce periods above 1.
 *     FALSIFIED BY period 1 everywhere, in which case the conclusion is about my model, not about
 *     the published result.
 *
 * Run: node claudeopus5/measure2.js
 */

import { createEnsemble, sweepTo, saturateDown, returnPointExcursion, limitCyclePeriod } from './hysterons.js';

const N = 60;
const SEEDS = 40;

console.log('=== P4 revisited: does the uncoupled avalanche size shrink with the drive increment? ===');
console.log('kind        coupling   increment   largest   mean     flips per unit drive');
for (const [kind, strength] of /** @type {[import('./hysterons.js').CouplingKind, number][]} */ ([
  ['none', 0], ['ferro', 0.6], ['frustrated', 0.6],
])) {
  for (const increment of [0.02, 0.005, 0.001, 0.00025]) {
    let largest = 0;
    let total = 0;
    let count = 0;
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const ensemble = createEnsemble({ n: N, seed, kind, couplingStrength: strength });
      saturateDown(ensemble);
      const { flips, maxAvalanche } = sweepTo(ensemble, 1.4, increment);
      largest = Math.max(largest, maxAvalanche);
      for (const f of flips) { total += f; count += 1; }
    }
    const mean = count === 0 ? 0 : total / count;
    console.log(`${kind.padEnd(11)} ${String(strength).padEnd(10)} ${String(increment).padEnd(11)} ${String(largest).padEnd(9)} ${mean.toFixed(3).padEnd(8)} ${(total / SEEDS / 3.4).toFixed(1)}`);
  }
}

console.log('\n=== P3 refined: where exactly does frustration break return point memory? ===');
console.log('coupling   seeds failing (of 40)   worst mismatch (of 60)');
for (const strength of [0.20, 0.25, 0.30, 0.32, 0.34, 0.36, 0.38, 0.40, 0.5, 0.7, 1.0, 1.4]) {
  let failing = 0;
  let worst = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const ensemble = createEnsemble({ n: N, seed, kind: 'frustrated', couplingStrength: strength });
    const { mismatched } = returnPointExcursion(ensemble, 0.15 + 0.5 * ((seed % 7) / 7), -0.35 - 0.4 * ((seed % 5) / 5), 0.01);
    if (mismatched > 0) failing += 1;
    worst = Math.max(worst, mismatched);
  }
  console.log(`${String(strength).padEnd(10)} ${String(failing).padEnd(23)} ${worst}`);
}

console.log('\n=== P7: do asymmetric interactions break return point memory, and produce subharmonics? ===');
console.log('coupling   RPM: seeds failing   worst mismatch   period>1 seeds   largest period');
for (const strength of [0.05, 0.1, 0.2, 0.3, 0.4, 0.6, 0.9]) {
  let failing = 0;
  let worst = 0;
  let subharmonic = 0;
  let largestPeriod = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const a = createEnsemble({ n: N, seed, kind: 'asymmetric', couplingStrength: strength });
    const { mismatched } = returnPointExcursion(a, 0.15 + 0.5 * ((seed % 7) / 7), -0.35 - 0.4 * ((seed % 5) / 5), 0.01);
    if (mismatched > 0) failing += 1;
    worst = Math.max(worst, mismatched);

    const b = createEnsemble({ n: N, seed, kind: 'asymmetric', couplingStrength: strength });
    const { period } = limitCyclePeriod(b, -0.5, 0.5, 12, 0.02);
    if (period > 1) subharmonic += 1;
    largestPeriod = Math.max(largestPeriod, period);
  }
  console.log(`${String(strength).padEnd(10)} ${String(failing).padEnd(20)} ${String(worst).padEnd(16)} ${String(subharmonic).padEnd(16)} ${largestPeriod}`);
}
