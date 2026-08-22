// @ts-check

import { createOscillators, coherence, disturbOscillators, measureRun, stepOscillators } from "./synchrony-model.js";

const SEEDS = [11, 29, 47, 83, 101];

export const claims = [
  {
    name: "Coupling produces collective rhythm",
    catches: "The shared model would be only decorative if strong coupling did not reliably align the phases.",
    verify() {
      const values = SEEDS.map((seed) => measureRun(seed, 1.6));
      const worst = Math.min(...values);
      if (worst < 0.9) throw new Error(`Worst coherence ${worst.toFixed(3)} fell below 0.900`);
      return `Five seeds: ${values.map((value) => value.toFixed(3)).join(", ")}; worst ${worst.toFixed(3)}.`;
    },
  },
  {
    name: "Without coupling, the crowd stays dispersed",
    catches: "Natural frequencies alone might accidentally create the apparent synchrony.",
    verify() {
      const values = SEEDS.map((seed) => measureRun(seed, 0));
      const worst = Math.max(...values);
      if (worst > 0.35) throw new Error(`Highest coherence ${worst.toFixed(3)} exceeded 0.350`);
      return `Five seeds: ${values.map((value) => value.toFixed(3)).join(", ")}; highest ${worst.toFixed(3)}.`;
    },
  },
  {
    name: "A disturbed network re-locks",
    catches: "A synchronized state might be fragile rather than self-correcting.",
    verify() {
      const state = createOscillators(48, 47, 1.6);
      for (let index = 0; index < 1600; index += 1) stepOscillators(state, 0.025);
      disturbOscillators(state, Math.PI * 0.9);
      const disturbed = coherence(state);
      for (let index = 0; index < 800; index += 1) stepOscillators(state, 0.025);
      const recovered = coherence(state);
      if (recovered < 0.9 || recovered <= disturbed + 0.2) {
        throw new Error(`Coherence moved from ${disturbed.toFixed(3)} to only ${recovered.toFixed(3)}`);
      }
      return `Coherence fell to ${disturbed.toFixed(3)}, then recovered to ${recovered.toFixed(3)}.`;
    },
  },
];