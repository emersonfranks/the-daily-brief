// @ts-check

import { recoverFromDisturbance, runExperiment } from "./synchrony.js";

const seeds = [11, 29, 47, 71, 97];

function format(value) {
  return value.toFixed(3);
}

export const claims = [
  {
    name: "Coupling creates collective rhythm",
    catches: "Fails if stronger coupling does not produce substantially more phase coherence than weak coupling across every shipped seed.",
    verify() {
      const measurements = seeds.map((seed) => {
        const weak = runExperiment({ seed, coupling: 0.08, seconds: 18 }).meanCoherence;
        const strong = runExperiment({ seed, coupling: 1.35, seconds: 18 }).meanCoherence;
        return { seed, weak, strong, gain: strong - weak };
      });
      const worstGain = Math.min(...measurements.map(({ gain }) => gain));
      if (worstGain <= 0.55) throw new Error(`Worst coherence gain was ${format(worstGain)}, not above 0.550`);
      return `Across 5 seeds, the weakest gain was ${format(worstGain)}; weak coupling stayed at or below ${format(Math.max(...measurements.map(({ weak }) => weak)))} while strong coupling reached at least ${format(Math.min(...measurements.map(({ strong }) => strong)))}.`;
    },
  },
  {
    name: "A shared network repairs a local timing shock",
    catches: "Fails if the strongly coupled population cannot recover high coherence after 40% of its phases are randomized.",
    verify() {
      const measurements = seeds.map((seed) => recoverFromDisturbance(seed, 1.35));
      const lowestRecovery = Math.min(...measurements.map(({ recovered }) => recovered));
      const largestShock = Math.max(...measurements.map(({ disturbed, recovered }) => recovered - disturbed));
      if (lowestRecovery <= 0.9) throw new Error(`Lowest recovered coherence was ${format(lowestRecovery)}, not above 0.900`);
      if (largestShock <= 0.25) throw new Error(`Largest measured recovery was ${format(largestShock)}, not above 0.250`);
      return `After randomizing 40% of phases, every seed recovered above ${format(lowestRecovery)} coherence within 10 simulated seconds; the largest recovery was ${format(largestShock)}.`;
    },
  },
];