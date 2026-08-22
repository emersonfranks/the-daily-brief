// @ts-check

import {
  DEFAULT_RIG,
  DEFAULT_ROAD,
  analyticEquilibriumCost,
  analyticHarm,
  braessWindow,
  compareRig,
  createRoadState,
  meanTravelTime,
  relaxRoads,
  rosenthalPotential,
} from './braess-model.js';

/**
 * @typedef {object} Claim
 * @property {string} id
 * @property {string} name What is being asserted.
 * @property {string} catches What a failure here would mean.
 * @property {() => string} verify Returns the evidence measured, or throws.
 */

/** @param {number} n @param {number} places @returns {string} */
const fixed = (n, places) => n.toFixed(places);

/**
 * @param {boolean} condition
 * @param {string} message
 * @returns {void}
 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Settle the network at a given demand and return the equilibrium commute.
 * @param {number} drivers
 * @param {boolean} shortcutOpen
 * @returns {{ cost: number, steps: number, converged: boolean }}
 */
function settle(drivers, shortcutOpen) {
  const state = createRoadState(drivers, shortcutOpen);
  const run = relaxRoads(state);
  return { cost: meanTravelTime(state), steps: run.steps, converged: run.converged };
}

/** @type {Claim[]} */
export const claims = [
  {
    id: 'shortcut-harms',
    name: 'At 4000 drivers, opening the free shortcut lengthens every commute',
    catches: 'The central claim. If the shortcut helps here, the page is wrong.',
    verify() {
      const closed = settle(4000, false);
      const open = settle(4000, true);
      assert(closed.converged && open.converged, 'best-response dynamics did not converge');
      assert(
        open.cost > closed.cost,
        `expected the shortcut to harm, measured ${fixed(open.cost, 2)} vs ${fixed(closed.cost, 2)}`,
      );
      return `shut ${fixed(closed.cost, 2)} min -> open ${fixed(open.cost, 2)} min, a ${fixed(open.cost - closed.cost, 2)} min penalty for adding a road that costs nothing to drive`;
    },
  },
  {
    id: 'nash-is-real',
    name: 'The simulation finds the true Nash equilibrium, not an approximation',
    catches:
      'A simulation that merely illustrates the answer instead of solving for it. Checked against a closed form derived by hand.',
    verify() {
      let worst = 0;
      let worstAt = 0;
      for (let n = 100; n <= 12000; n += 100) {
        for (const open of [false, true]) {
          const gap = Math.abs(settle(n, open).cost - analyticEquilibriumCost(n, open));
          if (gap > worst) {
            worst = gap;
            worstAt = n;
          }
        }
      }
      assert(worst <= 0.05, `simulation drifted ${fixed(worst, 4)} min from the closed form`);
      return `240 equilibria solved across 100..12000 drivers; worst disagreement with the closed form ${fixed(worst, 4)} min at N=${worstAt}, entirely explained by drivers being whole numbers`;
    },
  },
  {
    id: 'potential-descends',
    name: 'Every driver who switches lowers the Rosenthal potential',
    catches:
      "Rosenthal's 1973 theorem, which is the reason a pure equilibrium exists at all. One uphill step would break it.",
    verify() {
      let uphill = 0;
      let samples = 0;
      for (const n of [500, 1500, 3000, 4000, 4500, 6000, 9000, 11000]) {
        const state = createRoadState(n, true);
        const run = relaxRoads(state);
        for (let i = 1; i < run.trace.length; i++) {
          samples++;
          if (run.trace[i].potential > run.trace[i - 1].potential + 1e-9) uphill++;
        }
      }
      assert(uphill === 0, `${uphill} of ${samples} steps went uphill`);
      return `${samples} consecutive trace points across 8 demand levels, ${uphill} of them uphill`;
    },
  },
  {
    id: 'descent-hurts',
    name: 'The potential falls while the commute it is supposed to serve rises',
    catches:
      'The mechanism. If both moved the same way there would be no paradox to explain, just a bad road.',
    verify() {
      const state = createRoadState(4000, true);
      const startTime = meanTravelTime(state);
      const startPotential = rosenthalPotential(state);
      relaxRoads(state);
      const endTime = meanTravelTime(state);
      const endPotential = rosenthalPotential(state);
      assert(endPotential < startPotential, 'potential did not fall');
      assert(endTime > startTime, 'commute did not rise');
      const potentialDrop = (100 * (startPotential - endPotential)) / startPotential;
      const timeRise = (100 * (endTime - startTime)) / startTime;
      return `potential fell ${fixed(potentialDrop, 1)}% (${fixed(startPotential, 0)} -> ${fixed(endPotential, 0)}) while the mean commute rose ${fixed(timeRise, 1)}% (${fixed(startTime, 1)} -> ${fixed(endTime, 1)} min)`;
    },
  },
  {
    id: 'demand-window',
    name: 'The paradox needs the right traffic: it vanishes when quiet and when jammed',
    catches:
      'Overclaiming. Braess is usually told as if a free road always hurts. It does not, and this measures where it stops.',
    verify() {
      const quiet = settle(1000, true).cost - settle(1000, false).cost;
      const jammed = settle(10000, true).cost - settle(10000, false).cost;
      const rush = settle(4000, true).cost - settle(4000, false).cost;
      assert(quiet < -1, `expected the shortcut to help at 1000 drivers, measured ${fixed(quiet, 2)}`);
      assert(Math.abs(jammed) < 0.05, `expected no effect at 10000 drivers, measured ${fixed(jammed, 2)}`);
      assert(rush > 1, `expected harm at 4000 drivers, measured ${fixed(rush, 2)}`);
      return `1000 drivers: shortcut SAVES ${fixed(-quiet, 1)} min. 4000 drivers: costs ${fixed(rush, 1)} min. 10000 drivers: ${fixed(jammed, 2)} min, nobody uses it`;
    },
  },
  {
    id: 'window-edges',
    name: 'The harmful window and its worst point sit exactly where the algebra says',
    catches: 'Arithmetic, and a simulation quietly disagreeing with the closed form at the edges.',
    verify() {
      const window = braessWindow();
      let peak = -Infinity;
      let peakAt = 0;
      let low = null;
      let high = null;
      let previous = false;
      for (let n = 100; n <= 12000; n += 50) {
        const harm = settle(n, true).cost - settle(n, false).cost;
        if (harm > peak) {
          peak = harm;
          peakAt = n;
        }
        const harms = harm > 1e-6;
        if (harms !== previous) {
          if (harms) low = n;
          else high = n;
        }
        previous = harms;
      }
      assert(low !== null && Math.abs(low - window.lower) <= 50, `lower edge ${low} vs ${window.lower}`);
      assert(high !== null && Math.abs(high - window.upper) <= 50, `upper edge ${high} vs ${window.upper}`);
      assert(Math.abs(peak - window.peakHarm) <= 0.05, `peak harm ${fixed(peak, 3)} vs ${window.peakHarm}`);
      return `measured window (${low}, ${high}) against predicted (${window.lower}, ${window.upper}); worst case ${fixed(peak, 2)} min at N=${peakAt}, predicted ${fixed(window.peakHarm, 2)} at N=${window.peakDrivers}`;
    },
  },
  {
    id: 'string-lifts',
    name: 'Cutting a string makes the hanging weight rise',
    catches:
      'The mechanical half of the pairing. The rig is solved by descending its energy, with no series-or-parallel case analysis anywhere in the code.',
    verify() {
      const rig = compareRig();
      assert(rig.rise > 0, `weight fell ${fixed(-rig.rise, 2)} cm instead of rising`);
      return `weight hung at ${fixed(rig.linkedDepth, 2)} cm below the ceiling; cut the link and it settles at ${fixed(rig.cutDepth, 2)} cm, a rise of ${fixed(rig.rise, 2)} cm`;
    },
  },
  {
    id: 'rig-is-solved',
    name: 'The rig really is at rest: no node carries a leftover force',
    catches:
      'A solver that stopped early and reported a pretty picture. This one caught a real bug: at 4000 iterations the weight was 0.18 cm off.',
    verify() {
      const rig = compareRig();
      assert(
        rig.worstResidual < 1e-8,
        `largest unbalanced force ${rig.worstResidual.toExponential(2)} N is too big to call this equilibrium`,
      );
      return `largest unbalanced force at any node ${rig.worstResidual.toExponential(2)} N, against a ${DEFAULT_RIG.load} N load`;
    },
  },
  {
    id: 'rig-window',
    name: 'The spring paradox has a window too, and outside it cutting is a bad idea',
    catches:
      'The same overclaim on the mechanical side. Longer side strings reverse the effect; short ones remove it.',
    verify() {
      const slack = compareRig({ ...DEFAULT_RIG, safetyLength: 90 });
      const taut = compareRig({ ...DEFAULT_RIG, safetyLength: 25 });
      assert(slack.rise < -1, `expected the weight to drop with 90 cm strings, measured ${fixed(slack.rise, 2)}`);
      assert(Math.abs(taut.rise) < 1e-6, `expected no change with 25 cm strings, measured ${fixed(taut.rise, 4)}`);
      return `56 cm side strings: cutting lifts ${fixed(compareRig().rise, 2)} cm. 90 cm: cutting DROPS the weight ${fixed(-slack.rise, 2)} cm. 25 cm: ${fixed(taut.rise, 2)} cm, they were carrying the load all along`;
    },
  },
  {
    id: 'no-common-currency',
    name: 'A prediction that failed: the two potentials cannot be compared across a cut',
    catches:
      'My own reasoning. I predicted cutting the link would leave the rig at a higher energy. It does not, and the measurement is published here rather than quietly dropped.',
    verify() {
      const rig = compareRig();
      assert(
        rig.cutEnergy < rig.linkedEnergy,
        `the failed prediction stopped failing: ${fixed(rig.cutEnergy, 2)} vs ${fixed(rig.linkedEnergy, 2)}`,
      );
      const shut = rosenthalPotential(createRoadState(4000, false));
      return `predicted the cut rig would sit higher in energy; measured ${fixed(rig.linkedEnergy, 2)} -> ${fixed(rig.cutEnergy, 2)}, i.e. lower. Cutting a load path is not a move within one landscape, it swaps the landscape. Same on the road: the shut network's potential (${fixed(shut, 0)}) is not comparable to the open one's`;
    },
  },
];

/**
 * @typedef {object} ClaimResult
 * @property {string} id
 * @property {string} name
 * @property {string} catches
 * @property {boolean} passed
 * @property {string} evidence
 */

/**
 * @param {Claim} claim
 * @returns {ClaimResult}
 */
export function runClaim(claim) {
  try {
    return { id: claim.id, name: claim.name, catches: claim.catches, passed: true, evidence: claim.verify() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { id: claim.id, name: claim.name, catches: claim.catches, passed: false, evidence: message };
  }
}

/** @returns {{ road: typeof DEFAULT_ROAD, harmAt4000: number }} */
export function headlineNumbers() {
  return { road: DEFAULT_ROAD, harmAt4000: analyticHarm(4000) };
}
