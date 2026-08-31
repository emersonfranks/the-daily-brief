// @ts-check

/** @typedef {{ id: number, resilience: number, value: number, active: boolean, trips: number }} NetworkNode */
/** @typedef {{ from: number, to: number, weight: number }} NetworkLink */
/** @typedef {{ active: number, meanHealth: number, volatility: number, capability: number, values: number[], activeMask: boolean[] }} Snapshot */
/** @typedef {{ snapshots: Snapshot[], nodes: NetworkNode[], links: NetworkLink[], isolated: number, seed: number, policy: 'connected' | 'pruned' }} ScenarioResult */

const NODE_COUNT = 30;

/** @param {number} seed */
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** @param {number[]} values */
function deviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

/** @param {number} seed @param {'connected' | 'pruned'} policy @param {number} [stressScale] @returns {ScenarioResult} */
export function runScenario(seed, policy, stressScale = 1) {
  const random = createRandom(seed);
  /** @type {NetworkNode[]} */
  const nodes = Array.from({ length: NODE_COUNT }, (_, id) => ({
    id,
    resilience: 0.075 + random() * 0.045,
    value: 0.68 + random() * 0.22,
    active: true,
    trips: 0,
  }));
  /** @type {NetworkLink[]} */
  const links = [];
  for (let from = 0; from < NODE_COUNT; from += 1) {
    for (let offset = 1; offset <= 3; offset += 1) {
      const to = (from + offset * (1 + Math.floor(random() * 3))) % NODE_COUNT;
      if (to !== from) links.push({ from, to, weight: 0.014 + random() * 0.018 });
    }
  }

  /** @type {Snapshot[]} */
  const snapshots = [];
  let isolated = 0;
  for (let step = 0; step < 280; step += 1) {
    const shock = step >= 45 && step < 95 ? 0.078 + 0.037 * stressScale : 0.078;
    const previous = nodes.map((node) => node.value);
    for (const node of nodes) {
      if (!node.active) continue;
      const dependencyStress = links
        .filter((link) => link.to === node.id && nodes[link.from]?.active)
        .reduce((sum, link) => sum + (1 - previous[link.from]) * link.weight, 0);
      const jitter = (random() - 0.5) * 0.018;
      node.value = Math.max(0, Math.min(1, node.value + node.resilience - shock - dependencyStress + jitter));
      if (policy === 'pruned' && node.value < 0.17) {
        node.active = false;
        node.trips += 1;
        isolated += 1;
      }
    }
    const activeNodes = nodes.filter((node) => node.active);
    const health = activeNodes.map((node) => node.value);
    snapshots.push({
      active: activeNodes.length,
      meanHealth: health.length ? health.reduce((sum, value) => sum + value, 0) / health.length : 0,
      volatility: deviation(health),
      capability: activeNodes.length / NODE_COUNT,
      values: nodes.map((node) => node.value),
      activeMask: nodes.map((node) => node.active),
    });
  }
  return { snapshots, nodes, links, isolated, seed, policy };
}

/** @param {number[]} seeds */
export function measureSeeds(seeds) {
  return seeds.map((seed) => {
    const connected = runScenario(seed, 'connected');
    const pruned = runScenario(seed, 'pruned');
    const connectedTail = connected.snapshots.slice(95, 175);
    const prunedTail = pruned.snapshots.slice(95, 175);
    const average = (/** @type {Snapshot[]} */ samples, /** @type {keyof Snapshot} */ key) =>
      samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
    return {
      seed,
      connectedHealth: average(connectedTail, 'meanHealth'),
      prunedHealth: average(prunedTail, 'meanHealth'),
      connectedVolatility: average(connectedTail, 'volatility'),
      prunedVolatility: average(prunedTail, 'volatility'),
      connectedCapability: average(connectedTail, 'capability'),
      prunedCapability: average(prunedTail, 'capability'),
      isolated: pruned.isolated,
      surviving: pruned.nodes.filter((node) => node.active).length,
    };
  });
}
