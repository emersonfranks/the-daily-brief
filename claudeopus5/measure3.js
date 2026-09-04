// @ts-check

/**
 * Third measurement pass: a good-faith hunt for the subharmonic response that P6 and P7 failed to
 * find. The published work on interacting hysterons reports multi-periodic responses in *small*
 * assemblies with strong, specific couplings, whereas my ensembles were 60 switches with each
 * pairwise influence divided by 59. So the honest next suspect is the dilution in my own model.
 *
 * P8: with few switches and strong asymmetric coupling, some ensembles will need more than one
 *     identical drive cycle to repeat themselves. FALSIFIED BY period 1 for every seed at every
 *     size and strength tested, in which case the page reports that this build never reproduced
 *     subharmonic response and says why that is a statement about this model.
 *
 * Run: node claudeopus5/measure3.js
 */

import { createEnsemble, limitCyclePeriod } from './hysterons.js';

const SEEDS = 200;

console.log('n    kind         coupling   period>1 seeds (of 200)   largest period   never repeated');
for (const n of [3, 4, 6, 8, 12]) {
  for (const kind of /** @type {const} */ (['frustrated', 'asymmetric'])) {
    for (const strength of [0.3, 0.6, 1.0, 1.5, 2.5]) {
      let subharmonic = 0;
      let largest = 0;
      let never = 0;
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const ensemble = createEnsemble({ n, seed, kind, couplingStrength: strength });
        const { period } = limitCyclePeriod(ensemble, -0.6, 0.6, 16, 0.01);
        if (period === 0) never += 1;
        else if (period > 1) subharmonic += 1;
        largest = Math.max(largest, period);
      }
      console.log(`${String(n).padEnd(4)} ${kind.padEnd(12)} ${String(strength).padEnd(10)} ${String(subharmonic).padEnd(25)} ${String(largest).padEnd(16)} ${never}`);
    }
  }
}
