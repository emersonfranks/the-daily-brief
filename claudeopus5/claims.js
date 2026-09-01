// @ts-check

/**
 * Every assertion this page makes, as data. No DOM, no test runner: `claims.test.js` hands these
 * to `node --test` and `claims-panel.js` hands the same objects to a button in the browser, so CI
 * and the reader are checking one source of truth.
 *
 * Thresholds are set from the sweeps in `calibrate.js`, taking the worst value observed and
 * leaving headroom. The measured value is quoted next to each one.
 */

import {
  modalCovariance,
  softVisibility,
  reducedDrive,
  visibilityLaw,
  observableCovariance,
  correlationMatrix,
  maxAbsPairCorrelation,
  sampleModalCovariance,
} from './modal.js';
import {
  stringSystem,
  communitySystem,
  communityBasis,
  alignmentFromDrivePoint,
  SIGMA_ENV,
  SIGMA_0,
} from './systems.js';

/**
 * @typedef {object} Claim
 * @property {string} id
 * @property {string} name
 * @property {string} catches what a failure of this claim would mean
 * @property {() => Record<string, string>} verify returns the evidence measured, or throws
 */

const BASIS = communityBasis();

/**
 * @param {number} epsilon
 * @param {number} alignment
 * @param {boolean} shared
 */
function community(epsilon, alignment, shared) {
  const sys = communitySystem(epsilon, alignment);
  const c = modalCovariance(sys.lambdas, sys.p, SIGMA_ENV, SIGMA_0, shared);
  return {
    visibility: softVisibility(c, sys.soft),
    maxCorrelation: maxAbsPairCorrelation(correlationMatrix(observableCovariance(BASIS, c))),
  };
}

/**
 * @param {number} alignment
 * @returns {number} the distance from the tipping point at which the soft mode carries half the
 * fluctuations
 */
function epsilonAtHalfVisibility(alignment) {
  let lo = 1e-12;
  let hi = 1e6;
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);
    const sys = communitySystem(mid, alignment);
    const v = softVisibility(modalCovariance(sys.lambdas, sys.p, SIGMA_ENV, SIGMA_0), sys.soft);
    if (v > 0.5) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

/**
 * @param {boolean} ok
 * @param {string} message
 */
function require(ok, message) {
  if (!ok) throw new Error(message);
}

/** @type {Claim[]} */
export const claims = [
  {
    id: 'node-is-exact',
    name: 'The node is a real zero, not a small number',
    catches:
      'If the third harmonic picked up any drive at x = 1/3, the whole page would be about a ' +
      'quantitative dip rather than an exact cancellation.',
    verify() {
      const p = alignmentFromDrivePoint(1 / 3);
      const q = alignmentFromDrivePoint(2 / 3);
      require(p < 1e-12, `projection at x=1/3 was ${p}, expected below 1e-12`);
      require(q < 1e-12, `projection at x=2/3 was ${q}, expected below 1e-12`);
      return {
        'projection at x = 1/3': p.toExponential(2),
        'projection at x = 2/3': q.toExponential(2),
        threshold: '< 1e-12 (measured 7.1e-17)',
      };
    },
  },
  {
    id: 'closed-form-matches-integration',
    name: 'The closed-form covariance matches the integrated dynamics',
    catches:
      'Every other claim reads the Lyapunov solution rather than a trajectory. If that solution ' +
      'did not describe the process actually being integrated, all of them would be decoration.',
    verify() {
      const sys = communitySystem(0.4, 0.6);
      const exact = modalCovariance(sys.lambdas, sys.p, SIGMA_ENV, SIGMA_0);
      let worst = 0;
      for (const seed of [1, 2, 3, 4, 5]) {
        const sampled = sampleModalCovariance(
          { ...sys, sigmaEnv: SIGMA_ENV, sigma0: SIGMA_0, seed, shared: false },
          300000,
          0.01,
          30000
        );
        for (let i = 0; i < sys.lambdas.length; i++) {
          worst = Math.max(worst, Math.abs(sampled[i][i] - exact[i][i]) / exact[i][i]);
        }
      }
      require(worst < 0.1, `worst relative variance error was ${worst}, expected below 0.10`);
      return {
        'seeds run': '1, 2, 3, 4, 5 (all reported, none dropped)',
        'steps per seed': '300,000 at dt = 0.01, after 30,000 discarded',
        'worst relative error on any modal variance': worst.toFixed(4),
        threshold: '< 0.10, a Monte Carlo tolerance (worst of five seeds measured 0.046)',
      };
    },
  },
  {
    id: 'aligned-drive-shows-the-warning',
    name: 'Drive the soft mode and the classic warning appears',
    catches:
      'If the textbook early-warning signature did not show up under aligned forcing, the model ' +
      'would be broken and its silence elsewhere would mean nothing.',
    verify() {
      const r = community(0.01, 1, false);
      require(r.visibility > 0.99, `soft-mode visibility was ${r.visibility}`);
      require(r.maxCorrelation > 0.99, `max pairwise correlation was ${r.maxCorrelation}`);
      return {
        'distance from tipping point': 'lambda_soft = 0.01, 90x slower than the next mode',
        'forcing alignment': '1.00 (fully on the soft mode)',
        'soft-mode share of fluctuations': r.visibility.toFixed(4),
        'max pairwise correlation': r.maxCorrelation.toFixed(4),
      };
    },
  },
  {
    id: 'node-drive-hides-the-warning',
    name: 'Drive it at the node and the same tipping point goes silent',
    catches:
      'This is the whole thesis. A failure here means proximity to the tipping point does ' +
      'determine the indicator after all, and the pairing collapses.',
    verify() {
      const r = community(0.01, 0, false);
      require(r.visibility < 0.05, `soft-mode visibility was ${r.visibility}`);
      require(r.maxCorrelation < 0.6, `max pairwise correlation was ${r.maxCorrelation}`);
      return {
        'distance from tipping point': 'lambda_soft = 0.01, identical to the claim above',
        'forcing alignment': '0.00 (orthogonal to the soft mode)',
        'soft-mode share of fluctuations': r.visibility.toFixed(4),
        'max pairwise correlation': r.maxCorrelation.toFixed(4),
        threshold: 'visibility < 0.05 and correlation < 0.60 (measured 0.013 and 0.417)',
      };
    },
  },
  {
    id: 'hidden-across-decades',
    name: 'Alignment moves the point of detection by seven orders of magnitude',
    catches:
      'If the two forcing directions became detectable at similar distances, the effect would be ' +
      'a curiosity rather than a reason to distrust an indicator.',
    verify() {
      const aligned = epsilonAtHalfVisibility(1);
      const node = epsilonAtHalfVisibility(0);
      const ratio = aligned / node;
      require(ratio > 1e6, `ratio was ${ratio}, expected above 1e6`);
      return {
        'lambda_soft at which half the fluctuation is the soft mode, aligned drive':
          aligned.toExponential(3),
        'the same, node drive': node.toExponential(3),
        ratio: ratio.toExponential(3),
        note:
          'The aligned figure exceeds every other relaxation rate in the model, meaning the ' +
          'aligned soft mode is dominant across the entire range in which it is soft at all.',
      };
    },
  },
  {
    id: 'one-law-two-systems',
    name: 'String and community lie on one curve',
    catches:
      'If the two systems did not collapse onto the same function of one variable, the claim ' +
      'that they share a mechanism would be an analogy dressed up as an identity.',
    verify() {
      let worst = 0;
      let points = 0;
      for (const eps of [1, 0.5, 0.2, 0.05, 0.01, 0.002, 5e-4, 1e-4]) {
        for (let i = 0; i <= 20; i++) {
          const x = 0.02 + (i / 20) * 0.96;
          for (const sys of [stringSystem(eps, x), communitySystem(eps, alignmentFromDrivePoint(x))]) {
            const c = modalCovariance(sys.lambdas, sys.p, SIGMA_ENV, SIGMA_0);
            const g = reducedDrive(sys.lambdas, sys.p, SIGMA_ENV, SIGMA_0, sys.soft);
            worst = Math.max(worst, Math.abs(softVisibility(c, sys.soft) - visibilityLaw(g)));
            points++;
          }
        }
      }
      require(worst < 1e-9, `worst deviation from G/(1+G) was ${worst}`);
      return {
        'points checked': String(points),
        'systems': 'a damped string and a linearised community, different spectra',
        'worst deviation from G/(1+G)': worst.toExponential(2),
        threshold: '< 1e-9 (measured 3.3e-16, i.e. floating-point noise)',
      };
    },
  },
  {
    id: 'delayed-not-abolished',
    name: 'The warning is delayed, not abolished',
    catches:
      'Overclaiming. The node does not make a tipping point permanently invisible, and a page ' +
      'that implied otherwise would be wrong.',
    verify() {
      const near = community(1e-5, 0, false);
      require(near.visibility > 0.9, `visibility at lambda_soft = 1e-5 was ${near.visibility}`);
      return {
        'distance from tipping point': 'lambda_soft = 1e-5',
        'forcing alignment': '0.00 (orthogonal)',
        'soft-mode share of fluctuations': near.visibility.toFixed(4),
        reading:
          'The background noise floor is never exactly zero, so the soft mode always wins in the ' +
          'end. Alignment sets how late that is.',
      };
    },
  },
  {
    id: 'correlation-is-not-a-proxy',
    name: 'Under a single environmental driver the correlation indicator reads high regardless',
    catches:
      'A page that presented max pairwise correlation as a clean proxy for soft-mode dominance. ' +
      'It is not, and this is the failure this build found rather than looked for.',
    verify() {
      const shared = community(0.01, 0, true);
      const independent = community(0.01, 0, false);
      require(
        shared.maxCorrelation > 0.95,
        `shared-driver correlation was ${shared.maxCorrelation}`
      );
      require(shared.visibility < 0.05, `shared-driver visibility was ${shared.visibility}`);
      return {
        'both rows': 'lambda_soft = 0.01, forcing orthogonal to the soft mode',
        'one shared driver: max pairwise correlation': shared.maxCorrelation.toFixed(4),
        'one shared driver: soft-mode share': shared.visibility.toFixed(4),
        'independent drivers: max pairwise correlation': independent.maxCorrelation.toFixed(4),
        'independent drivers: soft-mode share': independent.visibility.toFixed(4),
        reading:
          'Identical soft-mode physics, correlation indicator reading 0.99 or 0.42 depending only ' +
          'on how many independent things the weather does.',
      };
    },
  },
];
