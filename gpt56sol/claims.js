// @ts-check

import { measureRegime, simulateCascade } from "./cascade-model.js";

const seeds = Array.from({ length: 200 }, (_, index) => index + 1);

export const claims = [
  {
    name: "Below the threshold, every measured cascade stayed small",
    catches: "Fails if any of the 200 fixed subcritical runs reaches 40 events.",
    verify() {
      const result = measureRegime(0.72, seeds);
      if (result.maximum >= 40) throw new Error(`Largest cascade was ${result.maximum}`);
      return `R 0.72 · mean ${result.mean.toFixed(3)} · largest ${result.maximum} · 0 of 200 reached 40`;
    },
  },
  {
    name: "Above the threshold, large cascades became a real risk",
    catches: "Fails if fewer than 30% of the same seeds reach 40 events at R 1.28.",
    verify() {
      const result = measureRegime(1.28, seeds);
      if (result.largeCascadeRate < 0.3) {
        throw new Error(`Large-cascade rate was ${(result.largeCascadeRate * 100).toFixed(1)}%`);
      }
      return `R 1.28 · mean ${result.mean.toFixed(3)} · median ${result.median} · ${(result.largeCascadeRate * 100).toFixed(1)}% reached 40`;
    },
  },
  {
    name: "Crossing one changed the tail, not every outcome",
    catches: "Fails unless the high-R mean is 15× larger while its median remains below 10.",
    verify() {
      const low = measureRegime(0.72, seeds);
      const high = measureRegime(1.28, seeds);
      const ratio = high.mean / low.mean;
      if (ratio < 15 || high.median >= 10) {
        throw new Error(`Mean ratio ${ratio.toFixed(2)}×; high-R median ${high.median}`);
      }
      return `mean ratio ${ratio.toFixed(2)}× · high-R median ${high.median} · storms remain uncertain`;
    },
  },
  {
    name: "Both worlds receive exactly the same event tree",
    catches: "Fails if rerunning the seeded process changes its topology.",
    verify() {
      const first = simulateCascade({ reproduction: 1.12, seed: 56 });
      const second = simulateCascade({ reproduction: 1.12, seed: 56 });
      if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("Seeded trees diverged");
      return `seed 56 · ${first.events.length} shared events · ${first.generationCounts.length - 1} generations`;
    },
  },
];