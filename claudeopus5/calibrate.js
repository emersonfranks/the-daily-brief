// @ts-check

/**
 * Threshold calibration. Run with `node calibrate.js` from this directory. Nothing on the page
 * imports it; it exists so the numbers in claims.js have a visible provenance.
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

const basis = communityBasis();

/**
 * @param {number} epsilon
 * @param {number} alignment
 * @param {boolean} shared
 */
function communityReadout(epsilon, alignment, shared) {
  const sys = communitySystem(epsilon, alignment);
  const c = modalCovariance(sys.lambdas, sys.p, SIGMA_ENV, SIGMA_0, shared);
  const corr = correlationMatrix(observableCovariance(basis, c));
  return {
    visibility: softVisibility(c, sys.soft),
    maxCorr: maxAbsPairCorrelation(corr),
    g: reducedDrive(sys.lambdas, sys.p, SIGMA_ENV, SIGMA_0, sys.soft),
  };
}

console.log('alignment at x=1/3 :', alignmentFromDrivePoint(1 / 3));
console.log('alignment at x=1/2 :', alignmentFromDrivePoint(0.5));

console.log('\n-- independent environmental drivers --');
for (const eps of [1, 0.1, 0.01, 0.001, 3e-4, 1e-4, 3e-5, 1e-5]) {
  const a = communityReadout(eps, 1, false);
  const n = communityReadout(eps, 0, false);
  console.log(
    `eps=${eps}  aligned vis=${a.visibility.toFixed(4)} r=${a.maxCorr.toFixed(4)}` +
      `   node vis=${n.visibility.toFixed(4)} r=${n.maxCorr.toFixed(4)}`
  );
}

console.log('\n-- one shared driver (rank-one forcing) --');
for (const eps of [1, 0.01, 1e-4]) {
  const a = communityReadout(eps, 1, true);
  const n = communityReadout(eps, 0, true);
  console.log(
    `eps=${eps}  aligned vis=${a.visibility.toFixed(4)} r=${a.maxCorr.toFixed(4)}` +
      `   node vis=${n.visibility.toFixed(4)} r=${n.maxCorr.toFixed(4)}`
  );
}

/**
 * @param {number} alignment
 * @returns {number}
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
const halfAligned = epsilonAtHalfVisibility(1);
const halfNode = epsilonAtHalfVisibility(0);
console.log('\neps at half visibility, aligned :', halfAligned);
console.log('eps at half visibility, node    :', halfNode);
console.log('ratio                           :', halfAligned / halfNode);

let worst = 0;
for (const eps of [1, 0.5, 0.2, 0.05, 0.01, 0.002, 5e-4, 1e-4]) {
  for (let i = 0; i <= 20; i++) {
    const x = 0.02 + (i / 20) * 0.96;
    const a = alignmentFromDrivePoint(x);
    for (const sys of [stringSystem(eps, x), communitySystem(eps, a)]) {
      const c = modalCovariance(sys.lambdas, sys.p, SIGMA_ENV, SIGMA_0);
      const g = reducedDrive(sys.lambdas, sys.p, SIGMA_ENV, SIGMA_0, sys.soft);
      worst = Math.max(worst, Math.abs(softVisibility(c, sys.soft) - visibilityLaw(g)));
    }
  }
}
console.log('\nworst |visibility - G/(1+G)| over both systems :', worst);

for (const seed of [1, 2, 3, 4, 5]) {
  const sys = communitySystem(0.4, 0.6);
  const spec = { ...sys, sigmaEnv: SIGMA_ENV, sigma0: SIGMA_0, seed, shared: false };
  const started = Date.now();
  const sampled = sampleModalCovariance(spec, 300000, 0.01, 30000);
  const exact = modalCovariance(sys.lambdas, sys.p, SIGMA_ENV, SIGMA_0);
  let rel = 0;
  for (let i = 0; i < sys.lambdas.length; i++) {
    rel = Math.max(rel, Math.abs(sampled[i][i] - exact[i][i]) / exact[i][i]);
  }
  const ms = Date.now() - started;
  console.log(`seed ${seed}: worst relative variance error = ${rel.toFixed(4)} (${ms} ms)`);
}
