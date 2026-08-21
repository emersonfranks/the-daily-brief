// @ts-check
// Every assertion the page makes, as data. No DOM, no node:test — imported by
// both percolation-model.test.js (Node) and claims-panel.js (browser), so the
// reader runs the exact checks CI runs. Each verify() returns the evidence it
// measured, or throws.

import {
  makeRng,
  generateLattice,
  analyze,
  spanningProbability,
  estimateThreshold,
  transitionWidth,
} from './percolation-model.js';

const P_C_LITERATURE = 0.5927;

/** @param {Uint8Array} g @param {number} L */
function transpose(g, L) {
  const o = new Uint8Array(L * L);
  for (let r = 0; r < L; r++)
    for (let c = 0; c < L; c++) o[c * L + r] = g[r * L + c];
  return o;
}

/**
 * @typedef {{ name: string, catches: string, verify: () => Record<string, number|string|boolean> }} Claim
 */

/** @type {Claim[]} */
export const claims = [
  {
    name: 'Threshold matches the published p_c',
    catches:
      'A wrong lattice or connectivity rule would put the transition somewhere other than 0.5927.',
    verify() {
      // Bisection for the density where spanning probability crosses 0.5.
      const measured = estimateThreshold(48, 150, makeRng(20260821));
      const dev = Math.abs(measured - P_C_LITERATURE);
      // Worst deviation over 6 seeds was 0.002; 0.02 leaves 10x headroom.
      if (dev > 0.02)
        throw new Error(
          `threshold ${measured.toFixed(4)} is ${dev.toFixed(4)} from literature ${P_C_LITERATURE}`
        );
      return { measured: +measured.toFixed(4), literature: P_C_LITERATURE, deviation: +dev.toFixed(4) };
    },
  },
  {
    name: 'The transition sharpens as the grid grows',
    catches:
      'If the flip were gradual rather than a true phase transition, width would not shrink with size.',
    verify() {
      const wSmall = transitionWidth(16, 150, makeRng(211));
      const wLarge = transitionWidth(48, 150, makeRng(307));
      // Measured: w16 >= 0.15, w48 <= 0.08 across seeds. Assert strict shrink.
      if (!(wLarge < wSmall))
        throw new Error(`width did not shrink: L16=${wSmall} L48=${wLarge}`);
      return {
        width_L16: +wSmall.toFixed(3),
        width_L48: +wLarge.toFixed(3),
        ratio: +(wLarge / wSmall).toFixed(2),
      };
    },
  },
  {
    name: 'A giant cluster appears only above the threshold',
    catches:
      'The order parameter must be ~0 below p_c and extensive above it, not a smooth ramp from zero.',
    verify() {
      const L = 96;
      const frac = (p, seed) => {
        const r = makeRng(seed);
        let f = 0;
        const n = 6;
        for (let i = 0; i < n; i++) f += analyze(generateLattice(L, p, r), L).largestFraction;
        return f / n;
      };
      const below = frac(0.45, 4501);
      const above = frac(0.75, 7502);
      if (!(below < 0.1))
        throw new Error(`largest cluster below threshold too big: ${below.toFixed(3)}`);
      if (!(above > 0.5))
        throw new Error(`largest cluster above threshold too small: ${above.toFixed(3)}`);
      return { fraction_at_0_45: +below.toFixed(3), fraction_at_0_75: +above.toFixed(3) };
    },
  },
  {
    name: 'Spanning probability rises monotonically with density',
    catches:
      'Adding open sites can never disconnect a spanning path; a dip would mean the engine is wrong.',
    verify() {
      const L = 48;
      const ps = [0.4, 0.5, 0.6, 0.7, 0.8];
      const probs = ps.map((p) => spanningProbability(L, p, 150, makeRng(900 + Math.round(p * 100))));
      for (let i = 1; i < probs.length; i++) {
        // Allow small sampling slack so noise near the plateau does not fail it.
        if (probs[i] < probs[i - 1] - 0.05)
          throw new Error(`non-monotonic at p=${ps[i]}: ${probs[i - 1]} -> ${probs[i]}`);
      }
      return { p: ps.join(','), spanProb: probs.map((x) => +x.toFixed(2)).join(',') };
    },
  },
  {
    name: 'Both domains cross at the same density (isotropy)',
    catches:
      'Fluid asks "does top reach bottom", fire asks "does one edge reach the far edge". They must flip together.',
    verify() {
      const L = 48;
      const p = 0.59;
      const rngSeed = 11 + Math.round(p * 100);
      const vertical = spanningProbability(L, p, 200, makeRng(rngSeed));
      // Horizontal spanning = vertical spanning of the transposed lattice.
      let h = 0;
      const trials = 200;
      const rng = makeRng(rngSeed);
      for (let t = 0; t < trials; t++) {
        if (analyze(transpose(generateLattice(L, p, rng), L), L).spans) h++;
      }
      const horizontal = h / trials;
      const gap = Math.abs(vertical - horizontal);
      if (gap > 0.12)
        throw new Error(`orientation gap too large: V=${vertical} H=${horizontal}`);
      if (vertical < 0.3 || vertical > 0.7)
        throw new Error(`vertical not near the crossing: ${vertical}`);
      return {
        vertical_spanProb: +vertical.toFixed(2),
        horizontal_spanProb: +horizontal.toFixed(2),
        gap: +gap.toFixed(2),
      };
    },
  },
];
