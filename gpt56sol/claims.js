// @ts-check

import { advance, runStepProtocol, summarize } from "./adaptive-model.js";

/** @type {{ name: string, catches: string, verify: () => string }[]} */
export const claims = [
  {
    name: "A held signal becomes old news",
    catches: "Fails if a sustained fourfold signal keeps producing a strong novelty response.",
    verify() {
      const result = summarize(runStepProtocol());
      if (result.settledFraction >= 0.006) {
        throw new Error(`Retained ${(result.settledFraction * 100).toFixed(3)}% of the peak; expected under 0.600%.`);
      }
      return `Peak ${result.peak.toFixed(4)}; after 12 s ${result.final.toFixed(5)} (${(result.settledFraction * 100).toFixed(3)}% retained).`;
    },
  },
  {
    name: "Fold-change, not absolute level, drives the flare",
    catches: "Fails if equal fourfold changes at different starting levels produce different traces.",
    verify() {
      const lowRange = runStepProtocol({ initialSignal: 1, changedSignal: 4 });
      const highRange = runStepProtocol({ initialSignal: 2, changedSignal: 8 });
      const largestDifference = Math.max(...lowRange.map((sample, index) => Math.abs(sample.response - highRange[index].response)));
      if (largestDifference >= 1e-12) {
        throw new Error(`Trace difference ${largestDifference} exceeded numerical tolerance.`);
      }
      return `Two 4x steps, 1 to 4 and 2 to 8, differed by at most ${largestDifference.toExponential(1)} novelty units.`;
    },
  },
  {
    name: "A new change breaks through adaptation",
    catches: "Fails if adaptation silences the circuit permanently instead of only discounting the current level.",
    verify() {
      const adapted = runStepProtocol().at(-1);
      if (!adapted) {
        throw new Error("The protocol produced no final sample.");
      }
      const repeated = advance(adapted, 4, 0.02).response;
      const changed = advance(adapted, 8, 0.02).response;
      if (changed <= 0.65 || Math.abs(repeated) >= 0.006) {
        throw new Error(`Repeated response ${repeated}; changed response ${changed}.`);
      }
      return `At 12 s, holding 4 produced ${repeated.toFixed(5)}; changing to 8 produced ${changed.toFixed(4)}.`;
    },
  },
];