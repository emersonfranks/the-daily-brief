// @ts-check

import { measureSeeds } from './network.js';

export const measuredSeeds = [1847, 2903, 4421, 6151, 7919, 9341];

export const claims = [
  {
    name: 'Pruning preserves a healthier remnant',
    catches: 'Fails if isolating fragile nodes does not improve mean health after the shock in every shipped seed.',
    verify() {
      const runs = measureSeeds(measuredSeeds);
      const margins = runs.map((run) => run.prunedHealth - run.connectedHealth);
      const worstMargin = Math.min(...margins);
      if (worstMargin <= 0.12) throw new Error(`Worst health margin ${worstMargin.toFixed(3)} did not clear 0.120`);
      return `6/6 seeds improved; worst mean-health gain ${worstMargin.toFixed(3)}`;
    },
  },
  {
    name: 'The remnant is quieter, not merely smaller',
    catches: 'Fails if post-shock health dispersion is not lower after pruning in every shipped seed.',
    verify() {
      const runs = measureSeeds(measuredSeeds);
      const ratios = runs.map((run) => run.prunedVolatility / run.connectedVolatility);
      const worstRatio = Math.max(...ratios);
      const fewestSurviving = Math.min(...runs.map((run) => run.surviving));
      if (worstRatio >= 0.72 || fewestSurviving < 3) {
        throw new Error(`Worst volatility ratio ${worstRatio.toFixed(3)}; fewest surviving ${fewestSurviving}`);
      }
      return `6/6 seeds quieter; worst pruned/connected volatility ratio ${worstRatio.toFixed(3)}`;
    },
  },
  {
    name: 'Stability costs capability',
    catches: 'Fails if the protected network avoids paying for stability by losing active capacity.',
    verify() {
      const runs = measureSeeds(measuredSeeds);
      const losses = runs.map((run) => run.connectedCapability - run.prunedCapability);
      const smallestLoss = Math.min(...losses);
      const fewestIsolated = Math.min(...runs.map((run) => run.isolated));
      if (smallestLoss <= 0.08 || fewestIsolated < 3) {
        throw new Error(`Smallest capability loss ${smallestLoss.toFixed(3)}; fewest isolated ${fewestIsolated}`);
      }
      return `Every run isolated ≥${fewestIsolated} nodes; smallest capability loss ${smallestLoss.toFixed(3)}`;
    },
  },
];
