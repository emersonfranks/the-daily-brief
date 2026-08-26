// @ts-check

/**
 * @param {number} seed
 * @returns {() => number}
 */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {() => number} random
 * @param {number} mean
 * @returns {number}
 */
function samplePoisson(random, mean) {
  const limit = Math.exp(-mean);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random();
  } while (product > limit);
  return count - 1;
}

/**
 * @typedef {{id: number, parentId: number | null, generation: number, lane: number}} EventNode
 * @typedef {{mean: number, generations: number[], nodes: EventNode[], capped: boolean}} BranchingRun
 */

/**
 * @param {{mean: number, seed: number, maxGenerations?: number, maxEvents?: number}} options
 * @returns {BranchingRun}
 */
export function simulateBranching(options) {
  const maxGenerations = options.maxGenerations ?? 14;
  const maxEvents = options.maxEvents ?? 2048;
  const random = createRandom(options.seed);
  /** @type {EventNode[]} */
  const nodes = [{ id: 0, parentId: null, generation: 0, lane: random() }];
  const generations = [1];
  let frontier = [nodes[0]];
  let capped = false;

  for (let generation = 1; generation <= maxGenerations && frontier.length > 0; generation += 1) {
    /** @type {EventNode[]} */
    const next = [];
    for (const parent of frontier) {
      const children = samplePoisson(random, options.mean);
      for (let child = 0; child < children; child += 1) {
        if (nodes.length >= maxEvents) {
          capped = true;
          break;
        }
        const node = {
          id: nodes.length,
          parentId: parent.id,
          generation,
          lane: Math.min(1, Math.max(0, parent.lane + (random() - 0.5) * 0.26)),
        };
        nodes.push(node);
        next.push(node);
      }
      if (capped) break;
    }
    generations.push(next.length);
    frontier = next;
    if (capped) break;
  }

  return { mean: options.mean, generations, nodes, capped };
}

/**
 * @param {number} mean
 * @param {number[]} seeds
 */
export function measureRegime(mean, seeds) {
  const runs = seeds.map((seed) => simulateBranching({ mean, seed }));
  const survivors = runs.filter((run) => (run.generations.at(-1) ?? 0) > 0).length;
  const totals = runs.map((run) => run.nodes.length);
  return {
    mean,
    runs: runs.length,
    survivalRate: survivors / runs.length,
    extinctionRate: 1 - survivors / runs.length,
    meanTotal: totals.reduce((sum, total) => sum + total, 0) / totals.length,
    maxTotal: Math.max(...totals),
  };
}
