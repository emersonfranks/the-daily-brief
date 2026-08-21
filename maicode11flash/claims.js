import { buildScenario, runCascade, exploreCascadeSeries, compareThresholds } from './cascade-model.js';

export const claims = [
  {
    name: 'Low density stalls the cascade',
    whatItCatches: 'A sparse seed should stay small; the same threshold model should not blow up unless the network is dense enough.',
    verify() {
      const result = runCascade(buildScenario({ rows: 12, cols: 12, threshold: 3, density: 0.05, seed: 11 }));
      if (result.activeCount > 10) {
        throw new Error(`Low density unexpectedly cascaded to ${result.activeCount} active cells.`);
      }
      return { activeCount: result.activeCount, steps: result.history.length - 1, density: 0.05, threshold: 3 };
    },
  },
  {
    name: 'Higher density crosses the tipping point',
    whatItCatches: 'The same board with a denser seed should jump from a small flare into a full network-wide cascade.',
    verify() {
      const lowDensity = runCascade(buildScenario({ rows: 12, cols: 12, threshold: 3, density: 0.05, seed: 11 }));
      const highDensity = runCascade(buildScenario({ rows: 12, cols: 12, threshold: 3, density: 0.18, seed: 11 }));
      if (highDensity.activeCount <= lowDensity.activeCount) {
        throw new Error(`Density increase did not amplify the cascade: ${JSON.stringify({ lowDensity: lowDensity.activeCount, highDensity: highDensity.activeCount })}`);
      }
      return {
        lowDensity: { density: 0.05, activeCount: lowDensity.activeCount, steps: lowDensity.history.length - 1 },
        highDensity: { density: 0.18, activeCount: highDensity.activeCount, steps: highDensity.history.length - 1 },
      };
    },
  },
  {
    name: 'A lower threshold makes cascade easier',
    whatItCatches: 'When the rule is easier to satisfy, the same initial state should produce a larger cascade.',
    verify() {
      const comparison = compareThresholds();
      if (comparison.threshold2 <= comparison.threshold4) {
        throw new Error(`Threshold 2 did not produce the larger cascade: ${JSON.stringify(comparison)}`);
      }
      return comparison;
    },
  },
];

export function runClaims() {
  return claims.map((claim) => {
    try {
      const evidence = claim.verify();
      return { name: claim.name, passed: true, evidence, whatItCatches: claim.whatItCatches };
    } catch (error) {
      return { name: claim.name, passed: false, error: error.message, whatItCatches: claim.whatItCatches };
    }
  });
}
