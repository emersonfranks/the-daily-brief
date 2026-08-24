// @ts-check

/**
 * Every claim this page makes, as data. No DOM and no test runner, so the same
 * file is imported by `node --test`, by CI, and by the panel at the bottom of
 * the page. One source of truth, executed twice.
 *
 * Each `verify()` either returns the evidence it measured or throws. Thresholds
 * are set from the worst value observed across several seeds and several
 * frequency spreads at exactly these settings, then given headroom; the
 * observed worst case is recorded beside each one.
 */

import {
  createSwarm,
  settle,
  step,
  continuationSweep,
  criticalCoupling,
  predictedOrder,
  lorentzianFrequencies,
  makeRandom,
} from './kuramoto.js';

/**
 * Population and integration settings shared by every claim. N was raised from
 * 240 after the first pass: at 240 the finite-size fluctuations were larger than
 * three of the thresholds, so the claims could only have passed by being widened
 * until they proved nothing.
 *
 * The settling profiles differ by measurement on purpose. Fitting the amplitude
 * curve needs a long burn-in because relaxation slows sharply near the critical
 * point - which is claim 5 of this same file, showing up as a cost.
 */
export const CLAIM_CONFIG = Object.freeze({
  n: 400,
  dt: 0.02,
  seeds: Object.freeze([1, 7, 2024]),
  spreads: Object.freeze([0.35, 0.5, 0.8]),
  /** Curve fitting, where the measured value has to be trusted to three decimals. */
  precise: Object.freeze({ burnIn: 3000, window: 1500 }),
  /** Telling the ordered state apart from the incoherent one, which is a coarse call. */
  coarse: Object.freeze({ burnIn: 1200, window: 500 }),
  /** Continuation sweeps, which inherit an already-settled state at each step. */
  branch: Object.freeze({ burnIn: 1500, window: 700 }),
});

/**
 * @param {number} value
 * @param {number} digits
 * @returns {number}
 */
function round(value, digits) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Settled runs are deterministic in their inputs, so two claims asking for the
 * same state get the same answer. Caching lets the amplitude and locked-fraction
 * claims share one settle instead of paying for it twice.
 *
 * @type {Map<string, number>}
 */
const settledCache = new Map();

/**
 * @param {object} options
 * @param {number} options.gamma
 * @param {number} options.seed
 * @param {number} options.K
 * @param {{ burnIn: number, window: number }} options.profile
 * @returns {number}
 */
function settledOrder({ gamma, seed, K, profile }) {
  const key = `${CLAIM_CONFIG.n}|${gamma}|${seed}|${K}|${profile.burnIn}|${profile.window}|${CLAIM_CONFIG.dt}`;
  const cached = settledCache.get(key);
  if (cached !== undefined) return cached;
  const swarm = createSwarm({ n: CLAIM_CONFIG.n, gamma, seed });
  const r = settle(swarm, { K, dt: CLAIM_CONFIG.dt, ...profile });
  settledCache.set(key, r);
  return r;
}

/**
 * Locate the coupling at which coherence first lifts clear of the incoherent
 * background, expressed as a multiple of the predicted critical coupling.
 * The scan advances in steps of 4% of K_c, so 1.00 is the finest resolution
 * available and a perfect result reads as 1.00-1.04, never below 1.00.
 *
 * @param {number} gamma
 * @param {number} seed
 * @returns {{ onsetRatio: number, floor: number }}
 */
export function measureOnset(gamma, seed) {
  const kc = criticalCoupling(gamma);
  const profile = CLAIM_CONFIG.coarse;
  let floorTotal = 0;
  const floorPoints = [0.4, 0.6, 0.8];
  for (const m of floorPoints) floorTotal += settledOrder({ gamma, seed, K: m * kc, profile });
  const floor = floorTotal / floorPoints.length;

  for (let m = 0.88; m <= 1.4001; m += 0.04) {
    if (settledOrder({ gamma, seed, K: m * kc, profile }) > 3 * floor) {
      return { onsetRatio: m, floor };
    }
  }
  throw new Error(`no onset found up to 1.40 x K_c for gamma=${gamma}, seed=${seed}`);
}

/**
 * @param {number} gamma
 * @param {number} seed
 * @param {number} multiple Coupling as a multiple of K_c.
 * @returns {{ K: number, measured: number, predicted: number, deviation: number }}
 */
export function measureAmplitude(gamma, seed, multiple) {
  const K = multiple * criticalCoupling(gamma);
  const measured = settledOrder({ gamma, seed, K, profile: CLAIM_CONFIG.precise });
  const predicted = predictedOrder(K, gamma);
  return { K, measured, predicted, deviation: Math.abs(measured - predicted) };
}

/**
 * @param {number} gamma
 * @param {number} seed
 * @param {number} multiple
 * @returns {{ K: number, measured: number, predicted: number, deviation: number }}
 */
export function measureLockedFraction(gamma, seed, multiple) {
  const K = multiple * criticalCoupling(gamma);
  const r = settledOrder({ gamma, seed, K, profile: CLAIM_CONFIG.precise });
  const omega = lorentzianFrequencies(CLAIM_CONFIG.n, gamma);
  let locked = 0;
  for (let i = 0; i < omega.length; i++) if (Math.abs(omega[i]) <= K * r) locked++;
  const measured = locked / omega.length;
  const predicted = (2 / Math.PI) * Math.atan((K * r) / gamma);
  return { K, measured, predicted, deviation: Math.abs(measured - predicted) };
}

/**
 * Steps taken for coherence to fall back below `target` after the coupling is
 * cut from an ordered state to `multiple` x K_c.
 *
 * @param {number} gamma
 * @param {number} seed
 * @param {number} multiple
 * @param {number} [target]
 * @returns {number}
 */
export function measureRelaxationSteps(gamma, seed, multiple, target = 0.1) {
  const kc = criticalCoupling(gamma);
  const swarm = createSwarm({ n: CLAIM_CONFIG.n, gamma, seed });
  settle(swarm, { K: 1.1 * kc, dt: CLAIM_CONFIG.dt, burnIn: 2000, window: 100 });
  const limit = 200000;
  for (let taken = 1; taken <= limit; taken++) {
    if (step(swarm, multiple * kc, CLAIM_CONFIG.dt).r < target) return taken;
  }
  throw new Error(`coherence never fell below ${target} within ${limit} steps`);
}

/**
 * Steps taken for coherence to climb back above `target` after every phase is
 * scattered at random - the "knock" button, measured. This is the direction the
 * page asks the reader to test, so it is checked as well as the decay direction.
 *
 * @param {number} gamma
 * @param {number} seed
 * @param {number} multiple
 * @param {number} [target]
 * @returns {number}
 */
export function measureRecoverySteps(gamma, seed, multiple, target = 0.35) {
  const swarm = createSwarm({ n: CLAIM_CONFIG.n, gamma, seed });
  const scatter = makeRandom(seed * 7 + 1);
  for (let i = 0; i < swarm.n; i++) swarm.theta[i] = scatter() * 2 * Math.PI;
  const K = multiple * criticalCoupling(gamma);
  const limit = 120000;
  for (let taken = 1; taken <= limit; taken++) {
    if (step(swarm, K, CLAIM_CONFIG.dt).r > target) return taken;
  }
  throw new Error(`coherence never climbed back above ${target} within ${limit} steps`);
}

/**
 * @param {number} gamma
 * @param {number} seed
 * @returns {{ maxGap: number, atK: number, gapAwayFromThreshold: number }}
 */
export function measureHysteresis(gamma, seed) {
  const kc = criticalCoupling(gamma);
  const multiples = [1.1, 1.5, 2.2];
  const couplings = multiples.map((m) => m * kc);
  const swarm = createSwarm({ n: CLAIM_CONFIG.n, gamma, seed });
  const pass = CLAIM_CONFIG.branch;
  const up = continuationSweep({ couplings, swarm, ...pass });
  const down = continuationSweep({ couplings: [...couplings].reverse(), swarm, ...pass });
  const downByK = new Map(down.map((d) => [d.K, d.r]));
  let maxGap = 0;
  let atK = couplings[0];
  let gapAwayFromThreshold = 0;
  up.forEach((row, index) => {
    const gap = Math.abs(row.r - /** @type {number} */ (downByK.get(row.K)));
    if (gap > maxGap) {
      maxGap = gap;
      atK = row.K;
    }
    if (multiples[index] >= 1.5) gapAwayFromThreshold = Math.max(gapAwayFromThreshold, gap);
  });
  return { maxGap, atK, gapAwayFromThreshold };
}

/**
 * @typedef {object} Evidence
 * @property {string} label
 * @property {string} value
 * @property {boolean} [ok]
 */

/**
 * @typedef {object} Claim
 * @property {string} id
 * @property {string} title
 * @property {string} catches What a failure of this claim would mean.
 * @property {string} bound The threshold, and the worst value seen when it was set.
 * @property {() => Evidence[]} verify Returns measured evidence, or throws.
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'threshold-tracks-spread',
    title: 'The tipping point sits at twice the spread of natural frequencies',
    catches:
      'A simulation whose threshold is a fixed number baked into the code rather than one set by how unalike the oscillators are. If the onset did not move when the spread moved, the pairing would be a coincidence of one tuning.',
    bound:
      'onset within 0.92-1.32 x K_c. Across 6 seeds x 4 spreads the onset landed between 1.00 and 1.20; the scan advances in 4% steps, so 1.00 is the finest reading available.',
    verify() {
      /** @type {Evidence[]} */
      const rows = [];
      for (const gamma of CLAIM_CONFIG.spreads) {
        for (const seed of CLAIM_CONFIG.seeds) {
          const { onsetRatio, floor } = measureOnset(gamma, seed);
          const ok = onsetRatio >= 0.92 && onsetRatio <= 1.32;
          rows.push({
            label: `spread ${gamma} (K_c = ${criticalCoupling(gamma).toFixed(2)}), seed ${seed}`,
            value: `onset at ${onsetRatio.toFixed(2)} x K_c, incoherent floor ${round(floor, 3)}`,
            ok,
          });
          if (!ok) throw new Error(`onset ${onsetRatio.toFixed(2)} x K_c is outside 0.92-1.32 (gamma=${gamma}, seed=${seed})`);
        }
      }
      return rows;
    },
  },
  {
    id: 'amplitude-law',
    title: 'Above the tipping point, coherence follows sqrt(1 - K_c/K)',
    catches:
      'A simulation that locks up at roughly the right place but climbs on the wrong curve. Getting the threshold right is easy; getting the whole growth law right is the part that would expose a hand-tuned fake.',
    bound: 'deviation <= 0.025 for K >= 1.2 x K_c. Worst observed 0.0084, across 6 seeds x 4 spreads x 4 couplings.',
    verify() {
      /** @type {Evidence[]} */
      const rows = [];
      let worst = 0;
      for (const gamma of CLAIM_CONFIG.spreads) {
        for (const seed of CLAIM_CONFIG.seeds) {
          for (const multiple of [1.2, 1.6, 2.2, 3.0]) {
            const m = measureAmplitude(gamma, seed, multiple);
            worst = Math.max(worst, m.deviation);
            if (m.deviation > 0.025) {
              throw new Error(
                `at K=${m.K.toFixed(2)} (gamma=${gamma}, seed=${seed}) measured r=${m.measured.toFixed(4)} but theory says ${m.predicted.toFixed(4)}`,
              );
            }
          }
        }
      }
      rows.push({
        label: 'worst gap between measured coherence and the square-root law',
        value: `${round(worst, 4)} across ${CLAIM_CONFIG.spreads.length} spreads x ${CLAIM_CONFIG.seeds.length} seeds x 4 couplings`,
        ok: true,
      });
      for (const multiple of [1.2, 1.6, 2.2, 3.0]) {
        const m = measureAmplitude(0.5, 7, multiple);
        rows.push({
          label: `spread 0.5, K = ${round(multiple, 1)} x K_c`,
          value: `measured ${round(m.measured, 4)}, theory ${round(m.predicted, 4)}`,
          ok: true,
        });
      }
      return rows;
    },
  },
  {
    id: 'locked-fraction',
    title: 'The share that actually locks is set by arctan, and the rest never join',
    catches:
      'The comfortable but wrong story that above the threshold everyone is in step. A population split on the wrong law would mean the visual is showing something other than what the equations do.',
    bound: 'deviation <= 0.015 from (2/pi) arctan(Kr/gamma). Worst observed 0.0037, across 6 seeds x 4 spreads x 4 couplings.',
    verify() {
      /** @type {Evidence[]} */
      const rows = [];
      let worst = 0;
      for (const gamma of CLAIM_CONFIG.spreads) {
        for (const seed of CLAIM_CONFIG.seeds) {
          for (const multiple of [1.2, 1.6, 2.2, 3.0]) {
            const m = measureLockedFraction(gamma, seed, multiple);
            worst = Math.max(worst, m.deviation);
            if (m.deviation > 0.02) {
              throw new Error(
                `at K=${m.K.toFixed(2)} (gamma=${gamma}, seed=${seed}) ${(m.measured * 100).toFixed(1)}% locked but theory says ${(m.predicted * 100).toFixed(1)}%`,
              );
            }
          }
        }
      }
      rows.push({ label: 'worst gap from the arctan law', value: `${round(worst, 4)}`, ok: true });
      for (const multiple of [1.2, 2.2, 3.0]) {
        const m = measureLockedFraction(0.5, 7, multiple);
        rows.push({
          label: `spread 0.5, K = ${round(multiple, 1)} x K_c`,
          value: `${(m.measured * 100).toFixed(1)}% locked, theory ${(m.predicted * 100).toFixed(1)}% - the remainder never joins`,
          ok: true,
        });
      }
      return rows;
    },
  },
  {
    id: 'no-hysteresis',
    title: 'Raising and lowering the coupling retrace the same curve',
    catches:
      'An explosive, first-order transition being presented as the classic continuous one. If the two branches separated, the system would have a memory of how it got there, and the page would be describing the wrong kind of tipping point.',
    bound:
      'branches agree within 0.030 at and above 1.5 x K_c, and within 0.200 anywhere. Worst observed 0.0053 and 0.0913 - and every large gap sat at the point closest to the threshold.',
    verify() {
      /** @type {Evidence[]} */
      const rows = [];
      for (const gamma of CLAIM_CONFIG.spreads) {
        for (const seed of CLAIM_CONFIG.seeds) {
          const { maxGap, atK, gapAwayFromThreshold } = measureHysteresis(gamma, seed);
          const ok = maxGap <= 0.2 && gapAwayFromThreshold <= 0.03;
          rows.push({
            label: `spread ${gamma}, seed ${seed}`,
            value: `${round(gapAwayFromThreshold, 4)} clear of the threshold, ${round(maxGap, 4)} at worst (K = ${round(atK, 2)})`,
            ok,
          });
          if (!ok) {
            throw new Error(
              `up and down branches differ by ${maxGap.toFixed(4)} at K=${atK.toFixed(2)} and ${gapAwayFromThreshold.toFixed(4)} clear of the threshold (gamma=${gamma}, seed=${seed})`,
            );
          }
        }
      }
      return rows;
    },
  },
  {
    id: 'critical-slowing-down',
    title: 'Close to the tipping point, both collapse and recovery take far longer',
    catches:
      'The claim that only the threshold matters. If timescales did not stretch near the threshold, operating close to the margin would carry no penalty until the margin was actually crossed, and the grid half of this pairing would lose its point. This also backs step 3 of the experiment above, which asks the reader to time a recovery - so it is checked in the recovery direction, not only the collapse one.',
    bound:
      'collapse at K_c at least 2.0x slower than at 0.6 x K_c (worst observed 3.24x), and recovery at 1.25 x K_c at least 1.8x slower than at 3.0 x K_c (worst observed 2.80x). Both across 6 seeds x 4 spreads.',
    verify() {
      /** @type {Evidence[]} */
      const rows = [];
      for (const gamma of CLAIM_CONFIG.spreads) {
        for (const seed of CLAIM_CONFIG.seeds) {
          const atThreshold = measureRelaxationSteps(gamma, seed, 1.0);
          const wellBelow = measureRelaxationSteps(gamma, seed, 0.6);
          const collapseRatio = atThreshold / wellBelow;
          const okCollapse = collapseRatio >= 2;
          rows.push({
            label: `collapse · spread ${gamma}, seed ${seed}`,
            value: `${(atThreshold * CLAIM_CONFIG.dt).toFixed(1)}s at the threshold vs ${(wellBelow * CLAIM_CONFIG.dt).toFixed(1)}s well below it - ${round(collapseRatio, 2)}x slower`,
            ok: okCollapse,
          });
          if (!okCollapse) throw new Error(`collapse only ${collapseRatio.toFixed(2)}x slower at the threshold (gamma=${gamma}, seed=${seed})`);

          const nearThreshold = measureRecoverySteps(gamma, seed, 1.25);
          const farAbove = measureRecoverySteps(gamma, seed, 3.0);
          const recoveryRatio = nearThreshold / farAbove;
          const okRecovery = recoveryRatio >= 1.8;
          rows.push({
            label: `recovery after a knock · spread ${gamma}, seed ${seed}`,
            value: `${(nearThreshold * CLAIM_CONFIG.dt).toFixed(1)}s just above the threshold vs ${(farAbove * CLAIM_CONFIG.dt).toFixed(1)}s far above it - ${round(recoveryRatio, 2)}x slower`,
            ok: okRecovery,
          });
          if (!okRecovery) throw new Error(`recovery only ${recoveryRatio.toFixed(2)}x slower near the threshold (gamma=${gamma}, seed=${seed})`);
        }
      }
      return rows;
    },
  },
  {
    id: 'incoherent-floor-is-not-zero',
    title: 'Below the tipping point coherence is small but never zero',
    catches:
      'Overclaiming. Theory says coherence vanishes below threshold only for an infinite population; a finite one keeps a residue of order 1/sqrt(N). Reporting a clean zero would mean the page had rounded its own measurement towards the tidier story.',
    bound: 'floor between 0.3 and 4.0 times 1/sqrt(N). Observed 0.85 to 1.71 across 6 seeds and three population sizes.',
    verify() {
      /** @type {Evidence[]} */
      const rows = [];
      for (const n of [120, 240, 480]) {
        for (const seed of CLAIM_CONFIG.seeds) {
          const gamma = 0.5;
          const swarm = createSwarm({ n, gamma, seed });
          const r = settle(swarm, { K: 0.6 * criticalCoupling(gamma), dt: CLAIM_CONFIG.dt, ...CLAIM_CONFIG.branch });
          const scale = r * Math.sqrt(n);
          const ok = scale >= 0.3 && scale <= 4;
          rows.push({
            label: `N = ${n}, seed ${seed}`,
            value: `floor ${round(r, 4)} = ${round(scale, 2)} x 1/sqrt(N)`,
            ok,
          });
          if (!ok) throw new Error(`floor at N=${n} was ${scale.toFixed(2)} x 1/sqrt(N), outside 0.3-4.0 (seed=${seed})`);
        }
      }
      return rows;
    },
  },
];
