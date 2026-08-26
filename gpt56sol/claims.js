// @ts-check

import { measureRegime } from "./branching.js";

const seeds = Array.from({ length: 96 }, (_, index) => 7400 + index * 7919);

export const claims = [
  {
    name: "Below one, cascades disappear",
    catches: "A subcritical process that persists too often or grows too large.",
    verify() {
      const result = measureRegime(0.72, seeds);
      if (result.extinctionRate < 0.94 || result.meanTotal >= 8) {
        throw new Error(`extinction ${result.extinctionRate.toFixed(3)}, mean total ${result.meanTotal.toFixed(2)}`);
      }
      return `${(result.extinctionRate * 100).toFixed(1)}% extinct by generation 14; ${result.meanTotal.toFixed(2)} mean events across ${result.runs} seeds`;
    },
  },
  {
    name: "Above one, some cascades sustain",
    catches: "A supercritical process that fails to survive or separate from the quiet regime.",
    verify() {
      const quiet = measureRegime(0.72, seeds);
      const active = measureRegime(1.28, seeds);
      if (active.survivalRate < 0.22 || active.meanTotal < quiet.meanTotal * 8) {
        throw new Error(`survival ${active.survivalRate.toFixed(3)}, growth ratio ${(active.meanTotal / quiet.meanTotal).toFixed(2)}`);
      }
      return `${(active.survivalRate * 100).toFixed(1)}% alive at generation 14; ${(active.meanTotal / quiet.meanTotal).toFixed(1)}x the subcritical mean`;
    },
  },
  {
    name: "Crossing the threshold raises survival",
    catches: "A seeded measurement whose survival trend does not increase with reproduction.",
    verify() {
      const means = [0.6, 0.9, 1.1, 1.4];
      const rates = means.map((mean) => measureRegime(mean, seeds).survivalRate);
      if (rates.some((rate, index) => index > 0 && rate < rates[index - 1])) {
        throw new Error(`survival rates ${rates.map((rate) => rate.toFixed(3)).join(", ")}`);
      }
      return means.map((mean, index) => `${mean.toFixed(1)} → ${(rates[index] * 100).toFixed(1)}%`).join(" · ");
    },
  },
];
