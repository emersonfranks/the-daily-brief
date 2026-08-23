// @ts-check

/**
 * @typedef {{ id: number, parentId: number | null, generation: number, lane: number, strength: number }} CascadeEvent
 * @typedef {{ events: CascadeEvent[], generationCounts: number[], reachedLimit: boolean }} CascadeResult
 */

/** @param {number} seed */
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
 */
function samplePoisson(random, mean) {
  const boundary = Math.exp(-mean);
  let product = 1;
  let count = 0;
  while (product > boundary) {
    count += 1;
    product *= random();
  }
  return count - 1;
}

/**
 * @param {{ reproduction: number, seed: number, maxGenerations?: number, maxEvents?: number }} options
 * @returns {CascadeResult}
 */
export function simulateCascade({ reproduction, seed, maxGenerations = 12, maxEvents = 700 }) {
  const random = createRandom(seed);
  /** @type {CascadeEvent[]} */
  const events = [{ id: 0, parentId: null, generation: 0, lane: 0.5, strength: 1 }];
  const generationCounts = [1];
  let frontier = [events[0]];

  for (let generation = 1; generation <= maxGenerations && frontier.length > 0; generation += 1) {
    /** @type {CascadeEvent[]} */
    const next = [];
    for (const parent of frontier) {
      const childCount = samplePoisson(random, reproduction);
      for (let childIndex = 0; childIndex < childCount && events.length < maxEvents; childIndex += 1) {
        const spread = (random() - 0.5) * Math.min(0.42, 0.12 + generation * 0.018);
        const event = {
          id: events.length,
          parentId: parent.id,
          generation,
          lane: Math.max(0.03, Math.min(0.97, parent.lane + spread)),
          strength: 0.55 + random() * 0.45,
        };
        events.push(event);
        next.push(event);
      }
      if (events.length >= maxEvents) break;
    }
    generationCounts.push(next.length);
    frontier = next;
    if (events.length >= maxEvents) break;
  }

  return { events, generationCounts, reachedLimit: events.length >= maxEvents };
}

/**
 * @param {number} reproduction
 * @param {number[]} seeds
 */
export function measureRegime(reproduction, seeds) {
  const sizes = seeds.map((seed) => simulateCascade({ reproduction, seed }).events.length);
  const sorted = [...sizes].sort((left, right) => left - right);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return {
    sizes,
    mean: total / sizes.length,
    median: sorted[Math.floor(sorted.length / 2)],
    maximum: sorted[sorted.length - 1],
    largeCascadeRate: sizes.filter((size) => size >= 40).length / sizes.length,
  };
}