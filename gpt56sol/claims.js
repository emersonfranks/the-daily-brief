// @ts-check

import { measureCoupling, simulateSynchrony } from "./synchrony.js";

const seeds = Array.from({ length: 64 }, (_, index) => 5600 + index * 7919);

export const claims = [
  {
    name: "Weak influence leaves timing scattered",
    catches: "A weakly coupled population that becomes consistently coherent in this model.",
    verify() {
      const result = measureCoupling(0.25, seeds);
      if (result.meanCoherence >= 0.6) {
        throw new Error(`mean late coherence ${result.meanCoherence.toFixed(3)}`);
      }
      return `Mean late coherence ${result.meanCoherence.toFixed(3)} across ${result.runs} seeds (0 means scattered; 1 means aligned)`;
    },
  },
  {
    name: "Strong influence locks the population",
    catches: "A strongly coupled population that fails to align reliably.",
    verify() {
      const result = measureCoupling(2.8, seeds);
      if (result.minimumCoherence < 0.97 || result.meanCoherence < 0.98) {
        throw new Error(`mean ${result.meanCoherence.toFixed(3)}, minimum ${result.minimumCoherence.toFixed(3)}`);
      }
      return `Mean late coherence ${result.meanCoherence.toFixed(3)}; worst seed ${result.minimumCoherence.toFixed(3)} across ${result.runs} seeds`;
    },
  },
  {
    name: "A locked group absorbs a timing shock",
    catches: "Strong coupling that cannot restore alignment after one quarter of the population is displaced.",
    verify() {
      const recoveryTimes = seeds.map((seed) => {
        const run = simulateSynchrony({ coupling: 2.8, seed, perturbAt: 12 });
        const recovered = run.frames.find((frame) => frame.time > 12 && frame.coherence >= 0.95);
        return recovered ? recovered.time - 12 : Number.POSITIVE_INFINITY;
      });
      const worstRecovery = Math.max(...recoveryTimes);
      if (worstRecovery > 1.2) throw new Error(`worst recovery ${worstRecovery.toFixed(2)} model-seconds`);
      return `All ${seeds.length} seeds returned above 0.95 coherence within ${worstRecovery.toFixed(1)} model-seconds`;
    },
  },
];
