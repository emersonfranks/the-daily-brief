// @ts-check
/**
 * Calibration. Run with `node claudeopus5/calibrate.js` from the repo root.
 * Prints the measurements the page's prose and the claim thresholds are set
 * from. Nothing here is imported by the page or by the test suite.
 */

import { CONFIG, standardGraph, sweep, meanDegree, kappa } from './network.js';

/** @param {number} x */
const f = (x) => x.toFixed(3);
/** @param {number | null} x */
const fn = (x) => (x === null ? '  n/a' : x.toFixed(3));

/** @type {number[]} */
const maxAlphas = [];
/** @type {number[]} */
const highCapAlphas = [];
/** @type {number[]} */
const cutoffGaps = [];

for (const seed of CONFIG.auditSeeds) {
  const g = standardGraph(seed);
  console.log(
    `\n=== seed ${seed} | n=${g.n} edges=${g.edges.length} <k>=${f(meanDegree(g.degree))} ` +
      `max k=${Math.max(...g.degree)} kappa0=${f(kappa(g.degree))} ===`,
  );
  const rows = sweep(g, [...CONFIG.capacities], CONFIG.a, CONFIG.controlSeed);
  console.log('cap over quiet  S_att  S_atk  S_rnd  spread  S_cut  alpha   k_att  k_atk  rnds');
  for (const r of rows) {
    console.log(
      `${String(r.capacity).padStart(3)} ${String(r.overCapacityCount).padStart(4)} ` +
        `${String(r.quietCount).padStart(5)}  ${f(r.attention)}  ${f(r.attack)}  ${f(r.control)}  ` +
        `${f(r.controlSpread)}  ${f(r.cutoffAttack)}  ${fn(r.attackLikeness)}  ` +
        `${f(r.kappaAttention)}  ${f(r.kappaAttack)}  ${String(r.rounds).padStart(4)}${r.converged ? '' : ' !!'}`,
    );
  }

  const defined = rows.filter((r) => r.attackLikeness !== null);
  const maxAlpha = Math.max(...defined.map((r) => /** @type {number} */ (r.attackLikeness)));
  const high = defined
    .filter((r) => r.capacity >= 14)
    .map((r) => /** @type {number} */ (r.attackLikeness));
  const maxHigh = Math.max(...high);
  const worstCutoffGap = Math.max(...rows.map((r) => r.cutoffAttack - r.attention));
  maxAlphas.push(maxAlpha);
  highCapAlphas.push(maxHigh);
  cutoffGaps.push(worstCutoffGap);

  const crossing = defined.find((r) => /** @type {number} */ (r.attackLikeness) >= 0.5);
  console.log(
    `  max alpha = ${f(maxAlpha)} | max alpha at capacity>=14 = ${f(maxHigh)} | ` +
      `first capacity with alpha>=0.5 = ${crossing ? crossing.capacity : 'none'} | ` +
      `worst (S_cutoffAttack - S_attention) = ${f(worstCutoffGap)}`,
  );
  console.log(`  non-converged capacities: ${rows.filter((r) => !r.converged).length}`);
}

console.log('\n=== across all audit seeds ===');
console.log(`min of max alpha        : ${f(Math.min(...maxAlphas))}`);
console.log(`max of high-capacity a  : ${f(Math.max(...highCapAlphas))}`);
console.log(`min worst cutoff gap    : ${f(Math.min(...cutoffGaps))}`);
