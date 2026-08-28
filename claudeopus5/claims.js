// @ts-check
import {
  makeRng, sampleBusSpacings, poissonGaps, ensembleSpacings, sampleGamma,
  buildGue, jacobiEigenvalues, ksToCdf, twoSampleKs, poissonCdf, wignerCdf,
  gammaSpacingCdf, fitExponent, mean, fractionBelow,
} from './spacings.js';

const BUS = { count: 32, snapshots: 220, stride: 90, burnSteps: 6000, dt: 0.004 };
const EIG = { size: 24, samples: 120 };

/** @type {Map<string, Float64Array>} */
const cache = new Map();

/**
 * @param {string} key
 * @param {() => Float64Array} build
 * @returns {Float64Array}
 */
function dataset(key, build) {
  const hit = cache.get(key);
  if (hit) return hit;
  const made = build();
  cache.set(key, made);
  return made;
}

const data = {
  free: () => dataset('free', () =>
    sampleBusSpacings({ ...BUS, beta: 0, mode: 'nearest', rng: makeRng(9001) })),
  nearest2: () => dataset('nearest2', () =>
    sampleBusSpacings({ ...BUS, beta: 2, mode: 'nearest', rng: makeRng(9002) })),
  all1: () => dataset('all1', () =>
    sampleBusSpacings({ ...BUS, beta: 1, mode: 'allpairs', rng: makeRng(9003) })),
  all2: () => dataset('all2', () =>
    sampleBusSpacings({ ...BUS, beta: 2, mode: 'allpairs', rng: makeRng(9004) })),
  gue: () => dataset('gue', () => ensembleSpacings({ ...EIG, beta: 2, rng: makeRng(9005) })),
  goe: () => dataset('goe', () => ensembleSpacings({ ...EIG, beta: 1, rng: makeRng(9006) })),
  poisson: () => dataset('poisson', () => poissonGaps(6000, makeRng(9007))),
  gammaK3: () => dataset('gammaK3', () => {
    const rng = makeRng(9008);
    const out = new Float64Array(9000);
    for (let i = 0; i < out.length; i++) out[i] = sampleGamma(3, rng) / 3;
    return out;
  }),
  gammaK2: () => dataset('gammaK2', () => {
    const rng = makeRng(9009);
    const out = new Float64Array(9000);
    for (let i = 0; i < out.length; i++) out[i] = sampleGamma(2, rng) / 2;
    return out;
  }),
};

/**
 * @param {boolean} ok
 * @param {string} message
 * @returns {void}
 */
function assert(ok, message) {
  if (!ok) throw new Error(message);
}

/** @param {number} x @returns {number} */
function round(x) {
  return Number(x.toFixed(4));
}

/**
 * @typedef {object} Claim
 * @property {string} id
 * @property {string} title
 * @property {string} catches
 * @property {string} threshold
 * @property {() => Record<string, number>} verify
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'poisson-baseline',
    title: 'With repulsion off, bus gaps are Poisson — the commonest gap is no gap',
    catches:
      'A rigged simulation that produces level repulsion no matter what the dial says. If the '
      + 'uncoupled ring already had a hole at zero, every later claim would be an artefact of the '
      + 'integrator rather than a consequence of repulsion.',
    threshold:
      'KS to exp(-s) below 0.08 (worst of 8 seeds: 0.046) and KS to the Wigner GUE surmise above '
      + '0.15 (worst: 0.258), so the control has to fire in the opposite direction.',
    verify() {
      const free = data.free();
      const evidence = {
        samples: free.length,
        ksToPoisson: round(ksToCdf(free, poissonCdf)),
        ksToWignerGUE: round(ksToCdf(free, (s) => wignerCdf(s, 2))),
        fractionBelowTenth: round(fractionBelow(free, 0.1)),
      };
      assert(evidence.ksToPoisson < 0.08, `KS to Poisson ${evidence.ksToPoisson} exceeds 0.08`);
      assert(
        evidence.ksToWignerGUE > 0.15,
        `control failed: uncoupled gaps sit ${evidence.ksToWignerGUE} from Wigner, expected > 0.15`,
      );
      return evidence;
    },
  },
  {
    id: 'gap-at-zero',
    title: 'Switching repulsion on empties the near-coincidences',
    catches:
      'The central visual claim being cosmetic. The histogram could look different near zero while '
      + 'the actual density of tiny gaps stayed put.',
    threshold:
      'Uncoupled fraction of gaps below 0.2 above 0.12 (worst of 8 seeds: 0.166); repelling '
      + 'fraction below 0.025 (worst: 0.0104). Measured ratio must exceed 8.',
    verify() {
      const free = data.free();
      const all2 = data.all2();
      const evidence = {
        freeFractionBelow02: round(fractionBelow(free, 0.2)),
        repellingFractionBelow02: round(fractionBelow(all2, 0.2)),
        ratio: round(fractionBelow(free, 0.2) / Math.max(1e-9, fractionBelow(all2, 0.2))),
        eigenvalueFractionBelow02: round(fractionBelow(data.gue(), 0.2)),
      };
      assert(evidence.freeFractionBelow02 > 0.12, 'uncoupled ring is not clumped enough to be a control');
      assert(evidence.repellingFractionBelow02 < 0.025, 'repelling ring still has too many near-coincidences');
      assert(evidence.ratio > 8, `depletion ratio ${evidence.ratio} is below 8`);
      return evidence;
    },
  },
  {
    id: 'bus-matches-gue',
    title: 'The repelling bus ring reproduces spacings of a genuinely diagonalised random matrix',
    catches:
      'The pairing itself. Both sides are computed by completely different routes — Langevin '
      + 'dynamics on a ring of buses versus Jacobi diagonalisation of a random Hermitian matrix — '
      + 'so agreement cannot come from shared code.',
    threshold:
      'Two-sample KS between bus gaps and eigenvalue spacings below 0.055 (worst of 8 seeds: 0.026), '
      + 'while the same bus gaps sit above 0.15 from a Poisson sample (worst: 0.277).',
    verify() {
      const all2 = data.all2();
      const gue = data.gue();
      const evidence = {
        busSamples: all2.length,
        eigenvalueSamples: gue.length,
        ksBusVsEigenvalues: round(twoSampleKs(all2, gue)),
        ksBusVsPoisson: round(twoSampleKs(all2, data.poisson())),
        ksBusVsWignerGUE: round(ksToCdf(all2, (s) => wignerCdf(s, 2))),
        meanEigenvalueSpacing: round(mean(gue)),
      };
      assert(
        evidence.ksBusVsEigenvalues < 0.055,
        `bus gaps differ from eigenvalue spacings by ${evidence.ksBusVsEigenvalues}`,
      );
      assert(
        evidence.ksBusVsPoisson > 0.15,
        'control failed: bus gaps are not distinguishable from Poisson',
      );
      return evidence;
    },
  },
  {
    id: 'half-repulsion-matches-goe',
    title: 'Halving the repulsion lands on the other ensemble, not somewhere in between',
    catches:
      'A single lucky coincidence at one dial setting. If the ring only ever imitated GUE, the '
      + 'dial would be decoration; the same construction has to hit GOE when beta is 1.',
    threshold:
      'Two-sample KS between beta=1 bus gaps and GOE eigenvalue spacings below 0.06 (worst of 8 '
      + 'seeds: 0.031), and KS to the GOE surmise below 0.04 (worst: 0.018).',
    verify() {
      const all1 = data.all1();
      const evidence = {
        ksBusVsGoeEigenvalues: round(twoSampleKs(all1, data.goe())),
        ksBusVsWignerGOE: round(ksToCdf(all1, (s) => wignerCdf(s, 1))),
        ksBusVsWignerGUE: round(ksToCdf(all1, (s) => wignerCdf(s, 2))),
      };
      assert(evidence.ksBusVsGoeEigenvalues < 0.06, 'beta=1 ring does not match GOE eigenvalues');
      assert(evidence.ksBusVsWignerGOE < 0.04, 'beta=1 ring does not match the GOE surmise');
      assert(
        evidence.ksBusVsWignerGUE > evidence.ksBusVsWignerGOE,
        'control failed: beta=1 ring fits GUE at least as well as GOE',
      );
      return evidence;
    },
  },
  {
    id: 'ensembles-are-distinguishable',
    title: 'The two surmises are far enough apart that matching one is a real result',
    catches:
      'The surmises being so similar that any bell-ish curve would pass. If GUE eigenvalues fitted '
      + 'the GOE formula equally well, claims 3 and 4 would be measuring nothing.',
    threshold:
      'GUE eigenvalues fit the GUE surmise below 0.045 (worst of 8 seeds: 0.024) and misfit the GOE '
      + 'surmise above 0.05 (worst: 0.061); GOE eigenvalues fit their own surmise below 0.045 '
      + '(worst: 0.028).',
    verify() {
      const gue = data.gue();
      const evidence = {
        gueToOwnSurmise: round(ksToCdf(gue, (s) => wignerCdf(s, 2))),
        gueToWrongSurmise: round(ksToCdf(gue, (s) => wignerCdf(s, 1))),
        goeToOwnSurmise: round(ksToCdf(data.goe(), (s) => wignerCdf(s, 1))),
        separation: round(
          ksToCdf(gue, (s) => wignerCdf(s, 1)) - ksToCdf(gue, (s) => wignerCdf(s, 2)),
        ),
      };
      assert(evidence.gueToOwnSurmise < 0.045, 'GUE eigenvalues do not fit the GUE surmise');
      assert(evidence.goeToOwnSurmise < 0.045, 'GOE eigenvalues do not fit the GOE surmise');
      assert(evidence.gueToWrongSurmise > 0.05, 'the two surmises are not distinguishable here');
      return evidence;
    },
  },
  {
    id: 'short-sight-breaks-the-tail',
    title: 'Short-sighted drivers keep the repulsion and lose the tail — the pairing is conditional',
    catches:
      'The page overselling the analogy. Repulsion alone is not enough: this is the measurement '
      + 'that would have forced the thesis to be rewritten, and it did narrow it.',
    threshold:
      'Nearest-neighbour gaps fit a Gamma spacing law below 0.05 (worst of 8 seeds: 0.031) and '
      + 'misfit Wigner above 0.05 (worst: 0.070), with the ratio above 1.8. All-pairs gaps at the '
      + 'same beta must come out the other way round.',
    verify() {
      const near = data.nearest2();
      const all2 = data.all2();
      const nearGamma = ksToCdf(near, (s) => gammaSpacingCdf(s, 2));
      const nearWigner = ksToCdf(near, (s) => wignerCdf(s, 2));
      const allGamma = ksToCdf(all2, (s) => gammaSpacingCdf(s, 2));
      const allWigner = ksToCdf(all2, (s) => wignerCdf(s, 2));
      const evidence = {
        shortSightToGamma: round(nearGamma),
        shortSightToWigner: round(nearWigner),
        allPairsToGamma: round(allGamma),
        allPairsToWigner: round(allWigner),
        shortSightRatio: round(nearWigner / nearGamma),
      };
      assert(nearGamma < 0.05, 'short-sighted gaps do not follow the Gamma spacing law');
      assert(nearWigner > 0.05, 'short-sighted gaps were expected to miss the Wigner surmise');
      assert(evidence.shortSightRatio > 1.8, 'the two fits are too close to call the tail broken');
      assert(
        allWigner < allGamma,
        'control failed: all-pairs repulsion should prefer Wigner over Gamma',
      );
      return evidence;
    },
  },
  {
    id: 'exponent-tracks-the-dial',
    title: 'The dial really is the small-gap exponent',
    catches:
      'The dial changing the picture without changing the physical quantity the two fields share. '
      + 'Level repulsion is defined by the power of s as s goes to zero, so that is what has to move.',
    threshold:
      'Fitted exponent within 0.35 of zero when repulsion is off (worst of 8 seeds: 0.162), between '
      + '1.4 and 3.0 at beta=2 (observed 1.785 to 2.567), and a separation above 1.2 (worst: 1.735).',
    verify() {
      const expFree = fitExponent(data.free()).exponent;
      const expAll1 = fitExponent(data.all1()).exponent;
      const expAll2 = fitExponent(data.all2()).exponent;
      const evidence = {
        exponentAtBeta0: round(expFree),
        exponentAtBeta1: round(expAll1),
        exponentAtBeta2: round(expAll2),
        separation: round(expAll2 - expFree),
      };
      assert(Math.abs(expFree) < 0.35, `uncoupled exponent ${evidence.exponentAtBeta0} is not flat`);
      assert(expAll2 > 1.4 && expAll2 < 3.0, `beta=2 exponent ${evidence.exponentAtBeta2} out of band`);
      assert(evidence.separation > 1.2, `separation ${evidence.separation} is too small`);
      return evidence;
    },
  },
  {
    id: 'estimator-is-calibrated',
    title: 'The exponent estimator is calibrated — and its bias on Wigner tails is declared',
    catches:
      'Reading a fitted number as truth. Run against samples of known exponent the estimator is '
      + 'accurate; run against a Gaussian-tailed spacing law it reads high, which is why claim 7 '
      + 'asserts a band and a separation rather than an equality.',
    threshold:
      'Recovers 2 from Gamma(k=3) within 0.55 (observed 1.657 to 2.178) and 1 from Gamma(k=2) '
      + 'within 0.35 (observed 0.862 to 1.120). The Wigner-tail bias must be positive and below 0.9.',
    verify() {
      const k3 = fitExponent(data.gammaK3()).exponent;
      const k2 = fitExponent(data.gammaK2()).exponent;
      const wignerShaped = fitExponent(data.all1()).exponent;
      const evidence = {
        recoveredFromGammaK3: round(k3),
        recoveredFromGammaK2: round(k2),
        errorOnGammaData: round(Math.max(Math.abs(k3 - 2), Math.abs(k2 - 1))),
        biasOnWignerTail: round(wignerShaped - 1),
      };
      assert(Math.abs(k3 - 2) < 0.55, `estimator missed a known exponent of 2 by ${round(k3 - 2)}`);
      assert(Math.abs(k2 - 1) < 0.35, `estimator missed a known exponent of 1 by ${round(k2 - 1)}`);
      assert(
        evidence.biasOnWignerTail > 0 && evidence.biasOnWignerTail < 0.9,
        `declared Wigner-tail bias ${evidence.biasOnWignerTail} is outside the stated range`,
      );
      return evidence;
    },
  },
  {
    id: 'diagonaliser-is-honest',
    title: 'The diagonaliser is not inventing a spectrum',
    catches:
      'A broken Jacobi rotation quietly producing plausible-looking eigenvalues. Similarity '
      + 'transforms preserve the trace and the Frobenius norm, so a spectrum that violates either '
      + 'did not come from the matrix it claims to describe.',
    threshold:
      'Relative error on both invariants below 1e-9 for a 48x48 real embedding of a 24x24 Hermitian '
      + 'matrix.',
    verify() {
      const size = 24;
      const dim = 2 * size;
      const m = buildGue(size, makeRng(9010));
      let trace = 0;
      let frobenius = 0;
      for (let i = 0; i < dim; i++) {
        trace += m[i * dim + i];
        for (let j = 0; j < dim; j++) frobenius += m[i * dim + j] * m[i * dim + j];
      }
      const eig = jacobiEigenvalues(m, dim);
      let sum = 0;
      let sumSquares = 0;
      for (let i = 0; i < dim; i++) {
        sum += eig[i];
        sumSquares += eig[i] * eig[i];
      }
      const traceError = Math.abs(sum - trace) / Math.max(1e-12, Math.abs(frobenius));
      const normError = Math.abs(sumSquares - frobenius) / frobenius;
      const evidence = {
        traceRelativeError: Number(traceError.toExponential(2)),
        frobeniusRelativeError: Number(normError.toExponential(2)),
        degeneratePairsFound: (() => {
          let pairs = 0;
          for (let i = 0; i < dim; i += 2) {
            if (Math.abs(eig[i] - eig[i + 1]) < 1e-8) pairs++;
          }
          return pairs;
        })(),
      };
      assert(traceError < 1e-9, `trace drifted by ${evidence.traceRelativeError}`);
      assert(normError < 1e-9, `Frobenius norm drifted by ${evidence.frobeniusRelativeError}`);
      assert(
        evidence.degeneratePairsFound === size,
        `real embedding of a Hermitian matrix must give ${size} doubled eigenvalues, found `
          + `${evidence.degeneratePairsFound}`,
      );
      return evidence;
    },
  },
];

/**
 * @typedef {object} ClaimResult
 * @property {string} id
 * @property {boolean} ok
 * @property {Record<string, number>} evidence
 * @property {string} error
 * @property {number} ms
 */

/**
 * @param {Claim} claim
 * @returns {ClaimResult}
 */
export function runClaim(claim) {
  const started = Date.now();
  try {
    const evidence = claim.verify();
    return { id: claim.id, ok: true, evidence, error: '', ms: Date.now() - started };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { id: claim.id, ok: false, evidence: {}, error: message, ms: Date.now() - started };
  }
}
