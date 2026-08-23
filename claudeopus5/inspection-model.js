// @ts-check

/**
 * Size-biased sampling in two unrelated systems: a friendship network and a bus route.
 *
 * Nothing here touches the DOM. Every figure the page prints comes from these functions, so the
 * browser and `node --test` measure the same code.
 */

/**
 * @typedef {() => number} Rng A uniform generator on [0, 1).
 */

/**
 * @param {number} seed
 * @returns {Rng}
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Rng} rng
 * @returns {number} A standard normal deviate.
 */
function standardNormal(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Lognormal draw with an exactly specified mean and coefficient of variation.
 *
 * @param {Rng} rng
 * @param {number} mean
 * @param {number} cv
 * @returns {number}
 */
export function lognormal(rng, mean, cv) {
  if (cv <= 0) return mean;
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  const mu = Math.log(mean) - (sigma * sigma) / 2;
  return Math.exp(mu + sigma * standardNormal(rng));
}

/**
 * @param {readonly number[]} values
 * @returns {{ mean: number, cv: number, meanSquare: number }}
 */
export function summarise(values) {
  const n = values.length;
  if (n === 0) return { mean: 0, cv: 0, meanSquare: 0 };
  let sum = 0;
  let sumSquares = 0;
  for (const value of values) {
    sum += value;
    sumSquares += value * value;
  }
  const mean = sum / n;
  const meanSquare = sumSquares / n;
  const variance = Math.max(0, meanSquare - mean * mean);
  return { mean, cv: mean === 0 ? 0 : Math.sqrt(variance) / mean, meanSquare };
}

/**
 * The inflation factor the mathematics predicts for a size-biased sample.
 *
 * @param {number} cv
 * @returns {number}
 */
export function predictedInflation(cv) {
  return 1 + cv * cv;
}

/**
 * A degree sequence with an even total, so every stub can be paired.
 *
 * @param {{ n: number, meanDegree: number, cv: number, rng: Rng }} options
 * @returns {number[]}
 */
export function makeDegreeSequence({ n, meanDegree, cv, rng }) {
  /** @type {number[]} */
  const degrees = [];
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    const raw = cv <= 0 ? meanDegree : lognormal(rng, meanDegree, cv);
    const degree = Math.max(1, Math.min(n - 1, Math.round(raw)));
    degrees.push(degree);
    total += degree;
  }
  if (total % 2 === 1) {
    degrees[0] += 1;
  }
  return degrees;
}

/**
 * @typedef {object} Network
 * @property {number} size
 * @property {ReadonlyArray<readonly [number, number]>} edges Unordered pairs, self-loops included.
 * @property {readonly number[]} degrees Realised degrees, counted from the edge list.
 * @property {ReadonlyArray<readonly number[]>} adjacency Neighbour lists, one entry per endpoint.
 */

/**
 * Configuration-model graph: cut every person into `degree` stubs, shuffle, pair them up.
 *
 * Degrees are recounted from the finished edge list rather than trusted from the requested
 * sequence, so every statistic downstream describes the graph that actually exists.
 *
 * `assortativity` is the fraction of stubs pulled out and paired in degree order instead of at
 * random, which makes popular people preferentially befriend other popular people.
 *
 * @param {readonly number[]} requestedDegrees
 * @param {Rng} rng
 * @param {number} [assortativity] 0 for the plain configuration model, 1 for fully sorted pairing.
 * @returns {Network}
 */
export function buildNetwork(requestedDegrees, rng, assortativity = 0) {
  const n = requestedDegrees.length;
  /** @type {number[]} */
  const stubs = [];
  for (let node = 0; node < n; node += 1) {
    for (let k = 0; k < requestedDegrees[node]; k += 1) stubs.push(node);
  }
  for (let i = stubs.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = stubs[i];
    stubs[i] = stubs[j];
    stubs[j] = swap;
  }

  if (assortativity > 0) {
    let sortedCount = Math.floor(stubs.length * Math.min(1, assortativity));
    if (sortedCount % 2 === 1) sortedCount -= 1;
    const head = stubs.slice(0, sortedCount).sort((a, b) => requestedDegrees[a] - requestedDegrees[b]);
    for (let i = 0; i < sortedCount; i += 1) stubs[i] = head[i];
  }

  /** @type {Array<readonly [number, number]>} */
  const edges = [];
  const degrees = new Array(n).fill(0);
  /** @type {number[][]} */
  const adjacency = Array.from({ length: n }, () => []);
  for (let i = 0; i + 1 < stubs.length; i += 2) {
    const a = stubs[i];
    const b = stubs[i + 1];
    edges.push([a, b]);
    degrees[a] += 1;
    degrees[b] += 1;
    adjacency[a].push(b);
    adjacency[b].push(a);
  }
  return { size: n, edges, degrees, adjacency };
}

/**
 * Newman's degree assortativity: the Pearson correlation between the degrees at the two ends of
 * an edge, with each edge counted in both directions.
 *
 * @param {Network} network
 * @returns {number}
 */
export function degreeAssortativity(network) {
  /** @type {number[]} */
  const left = [];
  /** @type {number[]} */
  const right = [];
  for (const [a, b] of network.edges) {
    left.push(network.degrees[a], network.degrees[b]);
    right.push(network.degrees[b], network.degrees[a]);
  }
  const m = left.length;
  if (m === 0) return 0;
  const meanLeft = left.reduce((sum, value) => sum + value, 0) / m;
  let covariance = 0;
  let varianceLeft = 0;
  let varianceRight = 0;
  for (let i = 0; i < m; i += 1) {
    const dl = left[i] - meanLeft;
    const dr = right[i] - meanLeft;
    covariance += dl * dr;
    varianceLeft += dl * dl;
    varianceRight += dr * dr;
  }
  const denominator = Math.sqrt(varianceLeft * varianceRight);
  return denominator === 0 ? 0 : covariance / denominator;
}

/**
 * One draw: pick a random friendship, then a random one of the two people in it.
 *
 * @param {Network} network
 * @param {Rng} rng
 * @returns {{ edge: readonly [number, number], person: number, degree: number }}
 */
export function drawFriendship(network, rng) {
  const edge = network.edges[Math.floor(rng() * network.edges.length)];
  const person = rng() < 0.5 ? edge[0] : edge[1];
  return { edge, person, degree: network.degrees[person] };
}

/**
 * Pick a random friendship, then a random one of the two people in it. This is the sampling the
 * friendship paradox is stated over, and it is size-biased by construction: a person with twenty
 * friends sits inside twenty of the pairs you are drawing from.
 *
 * @param {Network} network
 * @param {number} draws
 * @param {Rng} rng
 * @returns {{ mean: number, samples: number[] }}
 */
export function sampleByFriendship(network, draws, rng) {
  /** @type {number[]} */
  const samples = [];
  for (let i = 0; i < draws; i += 1) {
    samples.push(drawFriendship(network, rng).degree);
  }
  return { mean: summarise(samples).mean, samples };
}

/**
 * Pick a random person, then a random friend of theirs. This is what most people picture when they
 * hear the paradox, and it is not the same estimator.
 *
 * @param {Network} network
 * @param {number} draws
 * @param {Rng} rng
 * @returns {{ mean: number, samples: number[] }}
 */
export function sampleByPersonThenFriend(network, draws, rng) {
  /** @type {number[]} */
  const samples = [];
  for (let i = 0; i < draws; i += 1) {
    const person = Math.floor(rng() * network.size);
    const friends = network.adjacency[person];
    if (friends.length === 0) continue;
    const friend = friends[Math.floor(rng() * friends.length)];
    samples.push(network.degrees[friend]);
  }
  return { mean: summarise(samples).mean, samples };
}

/**
 * Pick a person uniformly at random. The control: no size bias, so no inflation.
 *
 * @param {Network} network
 * @param {number} draws
 * @param {Rng} rng
 * @returns {{ mean: number, samples: number[] }}
 */
export function sampleUniformPerson(network, draws, rng) {
  /** @type {number[]} */
  const samples = [];
  for (let i = 0; i < draws; i += 1) {
    samples.push(network.degrees[Math.floor(rng() * network.size)]);
  }
  return { mean: summarise(samples).mean, samples };
}

/**
 * @typedef {object} NetworkRun
 * @property {Network} network
 * @property {number} meanDegree Mean over people.
 * @property {number} cv Realised coefficient of variation of the degrees.
 * @property {number} friendshipMean Mean degree under friendship sampling.
 * @property {number} personThenFriendMean Mean degree under person-then-friend sampling.
 * @property {number} uniformMean Mean degree under uniform sampling.
 * @property {number} friendshipInflation friendshipMean / meanDegree.
 * @property {number} personThenFriendInflation personThenFriendMean / meanDegree.
 * @property {number} assortativity Realised degree assortativity of the graph.
 * @property {number} predicted 1 + cv^2 at the realised cv.
 */

/**
 * @param {{ n?: number, meanDegree?: number, cv: number, draws?: number, seed: number, assortativity?: number }} options
 * @returns {NetworkRun}
 */
export function runNetwork({ n = 4000, meanDegree = 6, cv, draws = 120000, seed, assortativity = 0 }) {
  const rng = createRng(seed);
  const degrees = makeDegreeSequence({ n, meanDegree, cv, rng });
  const network = buildNetwork(degrees, rng, assortativity);
  const stats = summarise(network.degrees);
  const friendship = sampleByFriendship(network, draws, rng);
  const personThenFriend = sampleByPersonThenFriend(network, draws, rng);
  const uniform = sampleUniformPerson(network, draws, rng);
  return {
    network,
    meanDegree: stats.mean,
    cv: stats.cv,
    friendshipMean: friendship.mean,
    personThenFriendMean: personThenFriend.mean,
    uniformMean: uniform.mean,
    friendshipInflation: friendship.mean / stats.mean,
    personThenFriendInflation: personThenFriend.mean / stats.mean,
    assortativity: degreeAssortativity(network),
    predicted: predictedInflation(stats.cv),
  };
}

/**
 * @typedef {object} Timetable
 * @property {readonly number[]} headways Gap between one bus and the next.
 * @property {readonly number[]} arrivals Cumulative arrival times.
 * @property {number} span Total length of the timetable.
 */

/**
 * @param {{ buses: number, meanHeadway: number, cv: number, rng: Rng }} options
 * @returns {Timetable}
 */
export function makeTimetable({ buses, meanHeadway, cv, rng }) {
  /** @type {number[]} */
  const headways = [];
  /** @type {number[]} */
  const arrivals = [];
  let clock = 0;
  for (let i = 0; i < buses; i += 1) {
    const headway = Math.max(1e-6, cv <= 0 ? meanHeadway : lognormal(rng, meanHeadway, cv));
    headways.push(headway);
    clock += headway;
    arrivals.push(clock);
  }
  return { headways, arrivals, span: clock };
}

/**
 * One passenger, arriving at a uniformly random moment and waiting for the next bus.
 *
 * @param {Timetable} timetable
 * @param {Rng} rng
 * @returns {{ gap: number, offset: number, wait: number }}
 */
export function drawRiderWait(timetable, rng) {
  const t = rng() * timetable.span;
  const arrivals = timetable.arrivals;
  let lo = 0;
  let hi = arrivals.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arrivals[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  const gapStart = lo === 0 ? 0 : arrivals[lo - 1];
  return { gap: lo, offset: t - gapStart, wait: arrivals[lo] - t };
}

/**
 * @typedef {object} BusRun
 * @property {Timetable} timetable
 * @property {number} meanHeadway
 * @property {number} cv Realised coefficient of variation of the headways.
 * @property {number} meanWait Mean wait of a passenger arriving at a uniformly random moment.
 * @property {number} inflation meanWait / (meanHeadway / 2).
 * @property {number} predicted 1 + cv^2 at the realised cv.
 */

/**
 * A timetable, then passengers dropped onto it at uniformly random moments.
 *
 * @param {{ buses?: number, meanHeadway?: number, cv: number, riders?: number, seed: number }} options
 * @returns {BusRun}
 */
export function runBuses({ buses = 4000, meanHeadway = 10, cv, riders = 120000, seed }) {
  const rng = createRng(seed ^ 0x9e3779b9);
  const timetable = makeTimetable({ buses, meanHeadway, cv, rng });
  const stats = summarise(timetable.headways);

  let waitTotal = 0;
  for (let i = 0; i < riders; i += 1) {
    waitTotal += drawRiderWait(timetable, rng).wait;
  }
  const meanWait = waitTotal / riders;
  return {
    timetable,
    meanHeadway: stats.mean,
    cv: stats.cv,
    meanWait,
    inflation: meanWait / (stats.mean / 2),
    predicted: predictedInflation(stats.cv),
  };
}
