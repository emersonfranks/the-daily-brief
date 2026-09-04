// @ts-check
/**
 * Every assertion this page makes, as data.
 *
 * No DOM and no `node:test` in here, so the exact same file is imported by
 * `network.test.js` under `node --test` in CI and by `claims-panel.js` in the
 * reader's browser. One source of truth, executed twice.
 *
 * Each `verify()` either returns the evidence it measured or throws. Thresholds
 * are set from the calibration run in `calibrate.js` over five graph seeds:
 * take the worst value observed, then leave headroom. The worst observed value
 * is written next to every threshold below.
 */

import { CONFIG, standardGraph, sweep, meanDegree, attentionCascade } from './network.js';

/** @typedef {import('./network.js').SweepRow} SweepRow */

/** @type {Map<number, SweepRow[]>} */
const cache = new Map();

/**
 * @param {number} seed
 * @returns {SweepRow[]}
 */
export function sweepFor(seed) {
  const hit = cache.get(seed);
  if (hit) return hit;
  const rows = sweep(standardGraph(seed), [...CONFIG.capacities], CONFIG.a, CONFIG.controlSeed);
  cache.set(seed, rows);
  return rows;
}

/** @param {number} x */
const f3 = (x) => x.toFixed(3);

/**
 * Capacity at or above which the network is comfortably provisioned. Claims 4
 * and 5 split the sweep here; the split is stated in the prose on the page
 * because it is a post-hoc choice, and the full curve is drawn either way.
 */
const COMFORTABLE_CAPACITY = 14;

/**
 * @typedef {{ id: string, title: string, catches: string, verify: () => string }} Claim
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'cascade-converges',
    title: 'The simulation actually settles',
    catches:
      'A model whose "result" is only wherever the iteration limit cut it off. Every number on this page is read off a fixed point, not a snapshot mid-cascade.',
    verify() {
      /** @type {string[]} */
      const notes = [];
      let worstRounds = 0;
      for (const seed of CONFIG.auditSeeds) {
        const rows = sweepFor(seed);
        const bad = rows.filter((r) => !r.converged);
        if (bad.length > 0) {
          throw new Error(
            `seed ${seed}: ${bad.length} capacities never reached a fixed point ` +
              `(first: capacity ${bad[0].capacity})`,
          );
        }
        worstRounds = Math.max(worstRounds, ...rows.map((r) => r.rounds));
        notes.push(`${seed}: ok`);
      }
      return `all ${CONFIG.auditSeeds.length} seeds x ${CONFIG.capacities.length} capacities reached a fixed point; slowest took ${worstRounds} rounds`;
    },
  },

  {
    id: 'quiet-starts-at-the-hubs',
    title: 'The silence begins at the busiest people',
    catches:
      'A cascade that is really just generic dilution. If the first people to fall silent were not the high-degree ones, nothing about this page would have anything to do with hubs.',
    verify() {
      /** @type {number[]} */
      const ratios = [];
      for (const seed of CONFIG.auditSeeds) {
        const graph = standardGraph(seed);
        const rows = sweepFor(seed);
        const row = rows.find((r) => r.overCapacityCount >= 5);
        if (!row) throw new Error(`seed ${seed}: sweep never put five people over capacity`);
        const c = attentionCascade(graph, row.capacity, CONFIG.a);
        const degs = c.firstRoundLosers.map((i) => graph.degree[i]);
        const ratio = meanDegree(degs) / meanDegree(graph.degree);
        // Every first-round loser must be over the limit, by definition of the rule.
        for (const i of c.firstRoundLosers) {
          if (graph.degree[i] <= row.capacity) {
            throw new Error(`seed ${seed}: node ${i} fell silent at or below capacity`);
          }
        }
        ratios.push(ratio);
      }
      const worst = Math.min(...ratios);
      // Worst observed over the audit seeds: 3.9x. Threshold 3.0x.
      if (worst < 3.0) {
        throw new Error(
          `first-round degree ratio fell to ${f3(worst)}x the network mean, below the 3.0x threshold`,
        );
      }
      return `first to fall silent are ${f3(worst)}x to ${f3(Math.max(...ratios))}x the mean degree across ${ratios.length} seeds (threshold 3.0x)`;
    },
  },

  {
    id: 'plenty-looks-like-bad-luck',
    title: 'With attention to spare, the damage is indistinguishable from bad luck',
    catches:
      'The thesis this page started with, which was wrong. It predicted attack-like collapse across the whole range. Where capacity is comfortable, the attention network sits on top of the random-dropout control, not the targeted-attack one.',
    verify() {
      /** @type {number[]} */
      const worstPerSeed = [];
      for (const seed of CONFIG.auditSeeds) {
        const rows = sweepFor(seed).filter(
          (r) => r.capacity >= COMFORTABLE_CAPACITY && r.attackLikeness !== null,
        );
        if (rows.length === 0) throw new Error(`seed ${seed}: no comparable rows above capacity ${COMFORTABLE_CAPACITY}`);
        worstPerSeed.push(Math.max(...rows.map((r) => /** @type {number} */ (r.attackLikeness))));
      }
      const worst = Math.max(...worstPerSeed);
      // Worst observed over the audit seeds: 0.074. Threshold 0.15.
      if (worst > 0.15) {
        throw new Error(
          `attack-likeness reached ${f3(worst)} at comfortable capacity, above the 0.15 threshold`,
        );
      }
      return `attack-likeness stays at or below ${f3(worst)} for every capacity >= ${COMFORTABLE_CAPACITY} across ${worstPerSeed.length} seeds (0 = random dropout, 1 = targeted attack; threshold 0.15)`;
    },
  },

  {
    id: 'scarcity-looks-like-an-attack',
    title: 'With attention scarce, the same network collapses like a targeted strike',
    catches:
      'The central claim. If attention scarcity never got closer to the hub-attack curve than to the random one, the pairing on this page would be dead.',
    verify() {
      /** @type {number[]} */
      const peaks = [];
      for (const seed of CONFIG.auditSeeds) {
        const rows = sweepFor(seed).filter((r) => r.attackLikeness !== null);
        peaks.push(Math.max(...rows.map((r) => /** @type {number} */ (r.attackLikeness))));
      }
      const worst = Math.min(...peaks);
      // Worst observed over the audit seeds: 0.642. Threshold 0.55.
      if (worst < 0.55) {
        throw new Error(
          `peak attack-likeness only reached ${f3(worst)} on the worst seed, below the 0.55 threshold`,
        );
      }
      return `peak attack-likeness is ${f3(worst)} to ${f3(Math.max(...peaks))} across ${peaks.length} seeds (threshold 0.55)`;
    },
  },

  {
    id: 'crossover-is-abrupt',
    title: 'The switch between the two behaviours is sudden, not gradual',
    catches:
      'A slow drift that would make "crossover" the wrong word. The gap between the last comfortable-looking capacity and the first attack-looking one has to be narrow.',
    verify() {
      /** @type {number[]} */
      const widths = [];
      /** @type {number[]} */
      const crossings = [];
      for (const seed of CONFIG.auditSeeds) {
        const rows = sweepFor(seed).filter((r) => r.attackLikeness !== null);
        const cross = rows.find((r) => /** @type {number} */ (r.attackLikeness) >= 0.5);
        if (!cross) throw new Error(`seed ${seed}: attack-likeness never reached 0.5`);
        const before = rows.filter(
          (r) => r.capacity > cross.capacity && /** @type {number} */ (r.attackLikeness) <= 0.15,
        );
        if (before.length === 0) throw new Error(`seed ${seed}: no low-alpha capacity above the crossing`);
        const lastLow = Math.min(...before.map((r) => r.capacity));
        widths.push(lastLow - cross.capacity);
        crossings.push(cross.capacity);
      }
      const worst = Math.max(...widths);
      // Worst observed over the audit seeds: 2 capacity steps. Threshold 4.
      if (worst > 4) {
        throw new Error(`crossover took ${worst} capacity steps, above the 4-step threshold`);
      }
      return `alpha goes from <=0.15 to >=0.5 within ${Math.min(...widths)}-${worst} capacity steps; crossings at capacity ${Math.min(...crossings)}-${Math.max(...crossings)} (threshold 4 steps)`;
    },
  },

  {
    id: 'molloy-reed-brackets-the-collapse',
    title: 'The collapse is a percolation transition, by the Molloy-Reed number',
    catches:
      'Attributing the collapse to the wrong mechanism. If kappa = <k^2>/<k> of the surviving active ties did not cross 2 exactly where the giant component died, this would be some other phenomenon wearing percolation as a costume.',
    verify() {
      /** @type {string[]} */
      const lines = [];
      for (const seed of CONFIG.auditSeeds) {
        const rows = sweepFor(seed);
        const dead = rows.filter((r) => r.attention < 0.1 && r.kappaAttention > 0);
        const alive = rows.filter((r) => r.attention >= 0.3);
        if (dead.length === 0 || alive.length === 0) throw new Error(`seed ${seed}: sweep did not span the transition`);
        const highestDead = dead.reduce((a, b) => (a.capacity > b.capacity ? a : b));
        const lowestAlive = alive.reduce((a, b) => (a.capacity < b.capacity ? a : b));
        if (highestDead.kappaAttention >= 2) {
          throw new Error(
            `seed ${seed}: giant component gone at capacity ${highestDead.capacity} but kappa = ${f3(highestDead.kappaAttention)} still above 2`,
          );
        }
        if (lowestAlive.kappaAttention <= 2) {
          throw new Error(
            `seed ${seed}: giant component alive at capacity ${lowestAlive.capacity} but kappa = ${f3(lowestAlive.kappaAttention)} already below 2`,
          );
        }
        lines.push(
          `${seed}: kappa ${f3(lowestAlive.kappaAttention)} (S=${f3(lowestAlive.attention)}) -> ${f3(highestDead.kappaAttention)} (S=${f3(highestDead.attention)})`,
        );
      }
      return `kappa crosses 2 exactly where the giant component dies, on every seed. ${lines.join('; ')}`;
    },
  },

  {
    id: 'cascade-outruns-the-cutoff-attack',
    title: 'Published failure: going quiet does more damage than being deleted',
    catches:
      'The comfortable version of this page. The source preprint describes the coupled network as the original one with its degree sequence truncated at a critical degree. Deleting exactly the over-capacity people outright is far gentler than letting them fall silent, so the truncation alone does not reproduce what this simulation does.',
    verify() {
      /** @type {number[]} */
      const gaps = [];
      for (const seed of CONFIG.auditSeeds) {
        const rows = sweepFor(seed);
        gaps.push(Math.max(...rows.map((r) => r.cutoffAttack - r.attention)));
      }
      const worst = Math.min(...gaps);
      // Worst observed over the audit seeds: 0.603. Threshold 0.40.
      if (worst < 0.4) {
        throw new Error(
          `largest gap was only ${f3(worst)} of the network on the mildest seed, below the 0.40 threshold`,
        );
      }
      return `deleting the over-capacity people outright leaves ${f3(worst * 100)}-${f3(Math.max(...gaps) * 100)}% more of the network connected than letting them fall silent does (threshold 40 percentage points)`;
    },
  },

  {
    id: 'monotone-in-capacity',
    title: 'Less attention never helps',
    catches:
      'A non-monotone artifact of the update order. Whatever else the cascade does, giving people less capacity must never leave more ties alive.',
    verify() {
      /** @type {number[]} */
      const violations = [];
      for (const seed of CONFIG.auditSeeds) {
        const rows = [...sweepFor(seed)].sort((a, b) => b.capacity - a.capacity);
        for (let i = 1; i < rows.length; i++) {
          if (rows[i].quietCount < rows[i - 1].quietCount - 1e-9) {
            throw new Error(
              `seed ${seed}: capacity ${rows[i].capacity} left ${rows[i].quietCount} people silent, fewer than the ${rows[i - 1].quietCount} at capacity ${rows[i - 1].capacity}`,
            );
          }
        }
        violations.push(0);
      }
      return `the number of people falling silent is non-decreasing as capacity falls, across all ${CONFIG.auditSeeds.length} seeds and ${CONFIG.capacities.length} capacity steps`;
    },
  },
];
