// @ts-check

/**
 * Every claim this page makes, as data.
 *
 * Each entry has a name, the thing it would catch if the page were wrong, and a `verify()` that
 * returns the evidence it actually measured or throws. There is no DOM here and no `node:test`,
 * so `policy.test.js` and `claims-panel.js` import exactly the same assertions and the browser
 * cannot drift from what CI checks.
 *
 * Thresholds are set from the calibration sweep in `calibrate.js`: eight seeds at 4000 steps,
 * take the worst seed, then widen. The widening factor is stated on each threshold.
 */

import {
  DEFAULTS,
  SEEDS,
  fitTail,
  noiseLadder,
  runEnsemble,
  sweepNoise,
} from './policy.js';

/** Steps per trial for every published figure. */
export const STEPS = 4000;

/** Noise level above which the tail fits are taken. Below this the gradient still dominates. */
export const TAIL_MIN = 1.0;

/** @type {Map<string, import('./policy.js').SweepPoint[]>} */
const sweepCache = new Map();

/**
 * Memoised sweep, so a panel running nine claims does not redo the same 416,000 steps nine times.
 * @param {import('./policy.js').System} system
 * @param {boolean} adaptive
 * @returns {import('./policy.js').SweepPoint[]}
 */
export function cachedSweep(system, adaptive) {
  const key = `${system}:${adaptive}`;
  let sweep = sweepCache.get(key);
  if (!sweep) {
    sweep = sweepNoise({ system, adaptive }, SEEDS, STEPS);
    sweepCache.set(key, sweep);
  }
  return sweep;
}

/** Analytic amplitude of the raw measurement: sqrt(G^2 + sigma^2). */
function rawAmplitude(noise) {
  return Math.sqrt(DEFAULTS.gradient * DEFAULTS.gradient + noise * noise);
}

/**
 * @param {boolean} ok
 * @param {string} message
 */
function assert(ok, message) {
  if (!ok) throw new Error(message);
}

/**
 * @typedef {object} Claim
 * @property {string} id
 * @property {string} name        What is being asserted, in the smallest form that is true.
 * @property {string} catches     What a failure of this test would mean.
 * @property {() => string} verify Returns the measured evidence, or throws.
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'amplitude-pinned',
    name: 'With gain control on, response amplitude is pinned near 1 in both systems',
    catches:
      'That the shared accumulator does what the page says it does. If the RMS of the normalised ' +
      'response drifted with the noise level, the whole "same invariant in both systems" claim ' +
      'would be false.',
    verify() {
      const ladder = noiseLadder();
      let worst = 0;
      let worstAt = '';
      for (const system of /** @type {const} */ (['swimmer', 'optimizer'])) {
        for (const point of cachedSweep(system, true)) {
          const deviation = Math.abs(point.responseRms - 1);
          if (deviation > worst) {
            worst = deviation;
            worstAt = `${system} at sigma=${point.noise.toFixed(2)}`;
          }
        }
      }
      // Worst measured deviation over both systems and the whole ladder was 0.041. Bound at 0.15,
      // roughly 3.5x headroom.
      assert(
        worst <= 0.15,
        `response amplitude strayed ${worst.toFixed(3)} from 1 (${worstAt}); bound is 0.15`
      );
      return (
        `worst deviation from 1.000 across both systems and all ${ladder.length} noise levels ` +
        `(sigma ${ladder[0].toFixed(2)} to ${ladder[ladder.length - 1].toFixed(2)}, a ` +
        `${(ladder[ladder.length - 1] / ladder[0]).toFixed(0)}x range): ` +
        `${worst.toFixed(3)}, at ${worstAt}`
      );
    },
  },

  {
    id: 'amplitude-tracks-noise',
    name: 'With gain control off, response amplitude tracks the noise one-for-one',
    catches:
      'The control condition. If the fixed-gain response amplitude did not grow with the noise, ' +
      'the switch would not be doing anything and the comparison would be empty.',
    verify() {
      /** @type {string[]} */
      const parts = [];
      for (const system of /** @type {const} */ (['swimmer', 'optimizer'])) {
        const sweep = cachedSweep(system, false);
        const ratio = sweep[sweep.length - 1].responseRms / sweep[0].responseRms;
        let worstRelative = 0;
        for (const point of sweep) {
          const relative = Math.abs(point.responseRms / rawAmplitude(point.noise) - 1);
          if (relative > worstRelative) worstRelative = relative;
        }
        // Measured ratios were 33.9x (swimmer) and 33.7x (optimizer); bound at 20x. Measured
        // agreement with sqrt(G^2 + sigma^2) was within 0.7%; bound at 5%, about 7x headroom.
        assert(ratio >= 20, `${system} amplitude ratio was only ${ratio.toFixed(1)}x; bound is 20x`);
        assert(
          worstRelative <= 0.05,
          `${system} amplitude departed ${(worstRelative * 100).toFixed(1)}% from ` +
            `sqrt(G^2+sigma^2); bound is 5%`
        );
        parts.push(
          `${system}: amplitude grew ${ratio.toFixed(1)}x across the ladder and matched ` +
            `sqrt(G^2+sigma^2) to within ${(worstRelative * 100).toFixed(1)}%`
        );
      }
      return parts.join('; ');
    },
  },

  {
    id: 'systems-agree',
    name: 'The pinned amplitude is the same number in the bacterium and in the optimizer',
    catches:
      'The pairing itself. The two systems use different response laws and draw different numbers ' +
      'of random values per step, so their agreement is a measurement, not an identity of code ' +
      'paths. If they disagreed, the page would be pairing two things that only look alike.',
    verify() {
      const swimmer = cachedSweep('swimmer', true);
      const optimizer = cachedSweep('optimizer', true);
      let worst = 0;
      let worstAt = 0;
      for (let i = 0; i < swimmer.length; i += 1) {
        const gap = Math.abs(swimmer[i].responseRms - optimizer[i].responseRms);
        if (gap > worst) {
          worst = gap;
          worstAt = swimmer[i].noise;
        }
      }
      // Worst measured gap was 0.002. Bound at 0.02, 10x headroom.
      assert(worst <= 0.02, `systems differed by ${worst.toFixed(4)}; bound is 0.02`);
      return (
        `largest gap between the two systems' pinned amplitudes, over the whole ladder: ` +
        `${worst.toFixed(4)} (at sigma=${worstAt.toFixed(2)})`
      );
    },
  },

  {
    id: 'steering-is-snr',
    name: 'Steering follows a ~1/noise law in all four configurations',
    catches:
      'The headline negative result. If gain control improved steering, at least one adaptive ' +
      'exponent would sit clearly above the fixed-gain one, and the page would be wrong to say ' +
      'that normalisation does not help you see through noise.',
    verify() {
      /** @type {string[]} */
      const parts = [];
      let worstR2 = 1;
      for (const system of /** @type {const} */ (['swimmer', 'optimizer'])) {
        for (const adaptive of [true, false]) {
          const fit = fitTail(cachedSweep(system, adaptive), TAIL_MIN);
          // Measured exponents: -1.039, -0.915 (swimmer on/off), -0.897, -0.895 (optimizer on/off).
          // Bound the band at [-1.30, -0.70], roughly twice the measured spread either side of -1.
          assert(
            fit.exponent <= -0.7 && fit.exponent >= -1.3,
            `${system} adaptive=${adaptive} exponent ${fit.exponent.toFixed(3)} left [-1.30,-0.70]`
          );
          // Measured r^2 was 0.9898 at worst; bound at 0.97.
          assert(
            fit.r2 >= 0.97,
            `${system} adaptive=${adaptive} fit was poor: r2=${fit.r2.toFixed(4)}`
          );
          if (fit.r2 < worstR2) worstR2 = fit.r2;
          parts.push(
            `${system}/${adaptive ? 'on' : 'off'} ${fit.exponent.toFixed(3)}`
          );
        }
      }
      return (
        `fitted exponents for sigma >= ${TAIL_MIN} over ${SEEDS.length} seeds: ${parts.join(', ')}; ` +
        `worst r2 ${worstR2.toFixed(4)}`
      );
    },
  },

  {
    id: 'prediction-2-failed',
    name: 'Registered prediction P2 failed: fixed gain did not collapse faster than a power law',
    catches:
      'The page quietly editing its own history. This test asserts the failure, so if a later ' +
      'change ever did produce the exponential collapse that was predicted, this test goes red ' +
      'and the page has to be rewritten rather than left claiming a failure that stopped being ' +
      'true.',
    verify() {
      const fit = fitTail(cachedSweep('swimmer', false), TAIL_MIN);
      const adaptiveFit = fitTail(cachedSweep('swimmer', true), TAIL_MIN);
      // A clean power law over the tail is exactly what P2 said would not happen.
      assert(
        fit.r2 >= 0.97,
        `fixed-gain swimmer no longer fits a power law (r2=${fit.r2.toFixed(4)}); P2 may have ` +
          'become true and the page must be rewritten'
      );
      assert(
        fit.exponent >= -1.3,
        `fixed-gain swimmer fell off at exponent ${fit.exponent.toFixed(3)}, steeper than the ` +
          'adaptive case; P2 may have become true and the page must be rewritten'
      );
      return (
        `fixed-gain swimmer tail is a power law of exponent ${fit.exponent.toFixed(3)} ` +
        `(r2=${fit.r2.toFixed(4)}), against the adaptive case's ${adaptiveFit.exponent.toFixed(3)}. ` +
        'P2 predicted a faster-than-power-law collapse and did not get one.'
      );
    },
  },

  {
    id: 'clipping-is-gain-control',
    name: 'The artifact behind P2: clipping the turn probability is itself a gain control',
    catches:
      'A wrong explanation of the failure. The page blames P2 on the turn probability being ' +
      'clipped to [0,1]. If the fixed-gain swimmer were not actually spending much of its time ' +
      'against that rail, that explanation would be invented rather than measured.',
    verify() {
      const fixed = cachedSweep('swimmer', false);
      const adaptive = cachedSweep('swimmer', true);
      const loudFixed = fixed[fixed.length - 1];
      const loudAdaptive = adaptive[adaptive.length - 1];
      const gap = loudFixed.saturation - loudAdaptive.saturation;
      // Measured at sigma=16: fixed 0.488, adaptive 0.349, gap 0.139. Bound saturation at 0.40
      // and the gap at 0.08, roughly 1.7x headroom on the smaller quantity.
      assert(
        loudFixed.saturation >= 0.4,
        `fixed-gain swimmer only saturated on ${(loudFixed.saturation * 100).toFixed(1)}% of steps`
      );
      assert(gap >= 0.08, `saturation gap was only ${gap.toFixed(3)}; bound is 0.08`);
      return (
        `at sigma=${loudFixed.noise.toFixed(0)} the fixed-gain swimmer's turn probability was ` +
        `clipped on ${(loudFixed.saturation * 100).toFixed(1)}% of steps, against ` +
        `${(loudAdaptive.saturation * 100).toFixed(1)}% with gain control on. The rail is ` +
        'absorbing the noise the normaliser would otherwise have absorbed.'
      );
    },
  },

  {
    id: 'stride-stability',
    name: 'Where the step size is free to move, gain control is what holds it still',
    catches:
      'The positive result. If the fixed-gain optimizer did not take wildly growing steps, there ' +
      'would be nothing for normalisation to fix and the page would have no answer to "so what ' +
      'is it for?".',
    verify() {
      const fixed = cachedSweep('optimizer', false);
      const adaptive = cachedSweep('optimizer', true);
      const fixedRatio = fixed[fixed.length - 1].meanStepSize / fixed[0].meanStepSize;
      const adaptiveRatio =
        adaptive[adaptive.length - 1].meanStepSize / adaptive[0].meanStepSize;
      // Measured 30.8x fixed and 0.91x adaptive. Bound at 15x and 1.5x, both about 2x headroom.
      assert(fixedRatio >= 15, `fixed-gain stride grew only ${fixedRatio.toFixed(1)}x; bound is 15x`);
      assert(
        adaptiveRatio <= 1.5,
        `adaptive stride changed ${adaptiveRatio.toFixed(2)}x; bound is 1.5x`
      );
      return (
        `across a ${(fixed[fixed.length - 1].noise / fixed[0].noise).toFixed(0)}x change in noise ` +
        `the fixed-gain optimizer's mean step grew ${fixedRatio.toFixed(1)}x ` +
        `(${fixed[0].meanStepSize.toFixed(3)} to ${fixed[fixed.length - 1].meanStepSize.toFixed(3)}), ` +
        `while the adaptive one changed ${adaptiveRatio.toFixed(2)}x ` +
        `(${adaptive[0].meanStepSize.toFixed(3)} to ` +
        `${adaptive[adaptive.length - 1].meanStepSize.toFixed(3)})`
      );
    },
  },

  {
    id: 'scale-measures-noise',
    name: 'The running divisor really is an estimate of the noise, not a fudge factor',
    catches:
      'The mechanism. The page says the divisor is a running estimate of the input\'s own ' +
      'fluctuation scale. If it did not agree with sqrt(G^2 + sigma^2), it would be doing ' +
      'something else and the explanation would be wrong.',
    verify() {
      let worst = 0;
      let worstAt = '';
      for (const system of /** @type {const} */ (['swimmer', 'optimizer'])) {
        for (const point of cachedSweep(system, true)) {
          if (point.noise < TAIL_MIN) continue;
          const relative = Math.abs(point.meanScale / rawAmplitude(point.noise) - 1);
          if (relative > worst) {
            worst = relative;
            worstAt = `${system} at sigma=${point.noise.toFixed(2)}`;
          }
        }
      }
      // Worst measured departure was about 2%. Bound at 8%, 4x headroom.
      assert(
        worst <= 0.08,
        `divisor departed ${(worst * 100).toFixed(1)}% from sqrt(G^2+sigma^2) at ${worstAt}`
      );
      return (
        `for sigma >= ${TAIL_MIN}, the running divisor matched sqrt(G^2 + sigma^2) to within ` +
        `${(worst * 100).toFixed(1)}% in both systems (worst case ${worstAt})`
      );
    },
  },

  {
    id: 'memory-must-be-tuned',
    name: 'The adaptation memory has to be long enough, or normalisation eats the signal',
    catches:
      'The cost the anchor paper warns about. With no memory the divisor is just the current ' +
      'measurement, so the response becomes +-1 and carries no information about how strong the ' +
      'signal was. If this test passed with any memory length, the beta control would be ' +
      'decoration.',
    verify() {
      const noise = 2;
      const shortMemory = runEnsemble(
        { system: 'swimmer', adaptive: true, noise, beta: 0 },
        SEEDS,
        STEPS
      );
      const tuned = runEnsemble(
        { system: 'swimmer', adaptive: true, noise, beta: DEFAULTS.beta },
        SEEDS,
        STEPS
      );
      const loss = 1 - shortMemory.mean / tuned.mean;
      // Measured loss was 18.7% at beta=0 against beta=0.9. Bound at 8%, about 2.3x headroom.
      assert(
        loss >= 0.08,
        `memoryless normalisation cost only ${(loss * 100).toFixed(1)}% of steering; bound is 8%`
      );
      return (
        `at sigma=${noise}, dropping the adaptation memory from beta=${DEFAULTS.beta} to beta=0 ` +
        `cost ${(loss * 100).toFixed(1)}% of steering efficiency ` +
        `(${tuned.mean.toFixed(4)} down to ${shortMemory.mean.toFixed(4)}, ${SEEDS.length} seeds)`
      );
    },
  },

  {
    id: 'quiet-regime',
    name: 'Registered prediction P3 failed: gain control was not a handicap in quiet conditions',
    catches:
      'The other prediction the page had to abandon. P3 said normalisation would cost ' +
      'performance when the signal is clean. It did the opposite here, and this test holds the ' +
      'page to reporting that rather than the prediction.',
    verify() {
      const noise = 0.05;
      const adaptive = runEnsemble({ system: 'swimmer', adaptive: true, noise }, SEEDS, STEPS);
      const fixed = runEnsemble({ system: 'swimmer', adaptive: false, noise }, SEEDS, STEPS);
      const delta = adaptive.mean - fixed.mean;
      // Measured +0.0752 in favour of adaptive. Bound the sign plus a margin of 0.02.
      assert(
        delta >= 0.02,
        `adaptive led by only ${delta.toFixed(4)} in the quiet regime; P3 may have become true ` +
          'and the page must be rewritten'
      );
      return (
        `at sigma=${noise}, gain control on scored ${adaptive.mean.toFixed(4)} against ` +
        `${fixed.mean.toFixed(4)} with it off, a lead of ${delta.toFixed(4)}. P3 predicted a ` +
        'deficit and got a lead.'
      );
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
 * @property {number} ms
 */

/**
 * Run one claim and capture the evidence or the failure.
 * @param {Claim} claim
 * @returns {ClaimResult}
 */
export function runClaim(claim) {
  const started = Date.now();
  try {
    const evidence = claim.verify();
    return { id: claim.id, name: claim.name, catches: claim.catches, passed: true, evidence, ms: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: claim.id,
      name: claim.name,
      catches: claim.catches,
      passed: false,
      evidence: message,
      ms: Date.now() - started,
    };
  }
}
