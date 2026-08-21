// @ts-check

import { createCascade, positiveShare, runSweep, seedPatch, settle } from "./cascade-model.js";

/** @typedef {{ label: string, value: string }} Evidence */
/** @typedef {{ name: string, catches: string, verify: () => Evidence[] }} Claim */

/** @type {Claim[]} */
export const claims = [
  {
    name: "The lattice remembers its route",
    catches: "A model that merely follows the current pressure, with no hysteresis.",
    verify: () => {
      const gaps = [11, 29, 47, 83].map((seed) => {
        const neutral = runSweep(seed).find((point) => Math.abs(point.pressure) < 0.001);
        if (!neutral) throw new Error("Neutral sweep point was not measured");
        return neutral.descending - neutral.ascending;
      });
      const smallestGap = Math.min(...gaps);
      if (smallestGap < 0.7) throw new Error(`Route gap ${smallestGap.toFixed(3)} fell below 0.700`);
      return [
        { label: "smallest neutral route gap", value: `${(smallestGap * 100).toFixed(1)} points` },
        { label: "seeds measured", value: gaps.length.toString() },
      ];
    },
  },
  {
    name: "Pressure eventually overwhelms memory",
    catches: "A frozen lattice that cannot recover or fully flip.",
    verify: () => {
      const cascade = createCascade(28, 101, 0.72, 1);
      settle(cascade, -1.6);
      const afterShock = positiveShare(cascade);
      settle(cascade, 1.6);
      const afterRecovery = positiveShare(cascade);
      if (afterShock > 0.01 || afterRecovery < 0.99) {
        throw new Error(`Extremes measured ${(afterShock * 100).toFixed(1)}% and ${(afterRecovery * 100).toFixed(1)}%`);
      }
      return [
        { label: "positive after negative extreme", value: `${(afterShock * 100).toFixed(1)}%` },
        { label: "positive after recovery", value: `${(afterRecovery * 100).toFixed(1)}%` },
      ];
    },
  },
  {
    name: "The same shock can fizzle or cascade",
    catches: "A model whose local resistance pattern cannot change the reach of a disturbance.",
    verify: () => {
      const spreads = [17, 89].map((seed) => {
        const cascade = createCascade(30, seed, 0.92, 1);
        settle(cascade, -0.35);
        const before = positiveShare(cascade);
        seedPatch(cascade, 15 * 30 + 15, 3.4, -1);
        settle(cascade, -0.35);
        return before - positiveShare(cascade);
      });
      const contrast = spreads[1] - spreads[0];
      if (spreads[0] > 0.12 || spreads[1] < 0.75 || contrast < 0.65) {
        throw new Error(`Shock spreads measured ${spreads.map((spread) => (spread * 100).toFixed(1)).join(" and ")} points`);
      }
      return [
        { label: "same shock, resistant field", value: `${(spreads[0] * 100).toFixed(1)} points` },
        { label: "same shock, fragile field", value: `${(spreads[1] * 100).toFixed(1)} points` },
      ];
    },
  },
];