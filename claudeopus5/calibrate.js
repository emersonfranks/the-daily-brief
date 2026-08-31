// @ts-check

/**
 * Headless calibration sweep. Not part of the page; run with `node claudeopus5/calibrate.js`.
 * Its job is to produce the numbers that `claims.js` thresholds and the page copy are set from,
 * so that neither is chosen by taste.
 */

import { sweepNoise, fitTail, SEEDS, runEnsemble } from './policy.js';

const STEPS = 4000;

/**
 * @param {string} label
 * @param {import('./policy.js').SweepPoint[]} sweep
 */
function report(label, sweep) {
  console.log(`\n=== ${label} ===`);
  for (const p of sweep) {
    console.log(
      `sigma=${p.noise.toFixed(3).padStart(7)}  eff=${p.efficiency.toFixed(4).padStart(8)}` +
        `  scale=${p.meanScale.toFixed(3).padStart(7)}` +
        `  stride=${p.meanStepSize.toFixed(3).padStart(7)}` +
        `  respRms=${p.responseRms.toFixed(3).padStart(8)}` +
        `  sat=${p.saturation.toFixed(3)}`
    );
  }
  const tail = fitTail(sweep, 1.0);
  console.log(
    `fit(>=1): exponent=${tail.exponent.toFixed(3)} r2=${tail.r2.toFixed(4)} n=${tail.points}`
  );
  const first = sweep[0];
  const last = sweep[sweep.length - 1];
  console.log(`stride ratio across ladder = ${(last.meanStepSize / first.meanStepSize).toFixed(2)}x`);
  console.log(`response RMS ratio across ladder = ${(last.responseRms / first.responseRms).toFixed(2)}x`);
}

for (const system of /** @type {const} */ (['swimmer', 'optimizer'])) {
  for (const adaptive of [true, false]) {
    report(`${system} adaptive=${adaptive}`, sweepNoise({ system, adaptive }, SEEDS, STEPS));
  }
}

console.log('\n=== swimmer run lengths and saturation ===');
for (const noise of [0.25, 1, 4, 16]) {
  for (const adaptive of [true, false]) {
    const e = runEnsemble({ system: 'swimmer', adaptive, noise }, SEEDS, STEPS);
    const runLen = e.trials.reduce((a, t) => a + t.meanRunLength, 0) / e.trials.length;
    const sat = e.trials.reduce((a, t) => a + t.saturation, 0) / e.trials.length;
    console.log(
      `sigma=${String(noise).padStart(5)} adaptive=${String(adaptive).padStart(5)}` +
        `  runLength=${runLen.toFixed(2).padStart(7)}  saturation=${sat.toFixed(4)}`
    );
  }
}
