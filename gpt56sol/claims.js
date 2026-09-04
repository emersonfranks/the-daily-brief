// @ts-check

import { compareToolkits, measureRescue, measureTransition } from './network.js';

/** @typedef {{ name: string, catches: string, verify: () => string }} Claim */

/** @type {Claim[]} */
export const claims = [
  {
    name: 'Both complete toolkits preserve modeled flow',
    catches: 'A replacement set that leaves an essential reaction uncovered.',
    verify() {
      const runs = ['bacteria', 'archaea'].map((lineage) =>
        measureTransition(/** @type {import('./network.js').Lineage} */ (lineage), 101)
      );
      const worst = Math.min(...runs.map((run) => run.minimum));
      if (worst < 0.999999) throw new Error(`minimum flow fell to ${(worst * 100).toFixed(2)}%`);
      return `202 slider positions across two lineages; worst flow ${(worst * 100).toFixed(1)}%.`;
    }
  },
  {
    name: 'Equivalent jobs do not require shared replacement parts',
    catches: 'Accidentally giving the two modeled lineages the same local machinery.',
    verify() {
      const result = compareToolkits();
      if (result.sharedReplacements !== 0) {
        throw new Error(`${result.sharedReplacements} replacement IDs are shared`);
      }
      return `${result.replacementReactions} modeled takeovers per lineage; 0 replacement IDs shared; ${result.inheritedReactions} inherited steps retained.`;
    }
  },
  {
    name: 'Shared infrastructure rescues one broken local machine',
    catches: 'A damage control that has no causal effect on network flow.',
    verify() {
      const result = measureRescue();
      const monotonic = result.throughputs.every((value, index, values) =>
        index === 0 || value >= values[index - 1]
      );
      if (!monotonic || result.throughputs[0] !== 0 || result.throughputs.at(-1) !== 1) {
        throw new Error(`unexpected rescue curve: ${result.throughputs.join(', ')}`);
      }
      return `With one local catalyst disabled, flow rose ${result.throughputs.map((value) => `${Math.round(value * 100)}%`).join(' -> ')} as shared support rose.`;
    }
  }
];
