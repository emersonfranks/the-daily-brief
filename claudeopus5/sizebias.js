// @ts-check

/**
 * Deterministic PRNG (mulberry32) so every figure on the page is reproducible from a seed.
 * @param {number} seed
 * @returns {() => number}
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {() => number} rng
 * @returns {number}
 */
function standardNormal(rng) {
  let u = rng();
  let v = rng();
  if (u <= Number.MIN_VALUE) u = Number.MIN_VALUE;
  if (v <= Number.MIN_VALUE) v = Number.MIN_VALUE;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Marsaglia-Tsang gamma variate with unit scale.
 * @param {() => number} rng
 * @param {number} shape
 * @returns {number}
 */
export function gammaVariate(rng, shape) {
  if (shape < 1) {
    const u = Math.max(rng(), Number.MIN_VALUE);
    return gammaVariate(rng, shape + 1) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let guard = 0; guard < 10000; guard++) {
    const x = standardNormal(rng);
    const t = 1 + c * x;
    if (t <= 0) continue;
    const v = t * t * t;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(Math.max(u, Number.MIN_VALUE)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d;
}

/**
 * Positive-valued sample with the requested mean and coefficient of variation.
 * @param {() => number} rng
 * @param {number} count
 * @param {number} mean
 * @param {number} cv
 * @returns {number[]}
 */
export function sampleGaps(rng, count, mean, cv) {
  const c = Math.max(cv, 1e-3);
  const shape = 1 / (c * c);
  const scale = mean * c * c;
  const out = new Array(count);
  for (let i = 0; i < count; i++) out[i] = gammaVariate(rng, shape) * scale;
  return out;
}

/**
 * @param {readonly number[]} xs
 * @returns {number}
 */
export function meanOf(xs) {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return s / xs.length;
}

/**
 * Population coefficient of variation.
 * @param {readonly number[]} xs
 * @returns {number}
 */
export function cvOf(xs) {
  const m = meanOf(xs);
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    const d = xs[i] - m;
    s += d * d;
  }
  return Math.sqrt(s / xs.length) / m;
}

/**
 * The mean of the list after reweighting each entry by its own magnitude: sum(x^2)/sum(x).
 * @param {readonly number[]} xs
 * @returns {number}
 */
export function sizeBiasedMean(xs) {
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += xs[i] * xs[i];
    den += xs[i];
  }
  return num / den;
}

/**
 * Monte Carlo: drop a uniform random instant onto the timetable and report the gap it fell inside.
 * @param {() => number} rng
 * @param {readonly number[]} gaps
 * @param {number} trials
 * @returns {number[]}
 */
export function landedGaps(rng, gaps, trials) {
  const edges = new Float64Array(gaps.length + 1);
  for (let i = 0; i < gaps.length; i++) edges[i + 1] = edges[i] + gaps[i];
  const total = edges[gaps.length];
  const out = new Array(trials);
  for (let t = 0; t < trials; t++) {
    const x = rng() * total;
    let lo = 0;
    let hi = gaps.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (edges[mid] <= x) lo = mid;
      else hi = mid - 1;
    }
    out[t] = gaps[lo];
  }
  return out;
}

/**
 * Integer friend counts with the requested mean and spread, clamped to at least one friend
 * and forced to an even total so the stubs can be paired.
 * @param {() => number} rng
 * @param {number} count
 * @param {number} mean
 * @param {number} cv
 * @returns {number[]}
 */
export function degreeSequence(rng, count, mean, cv) {
  const raw = sampleGaps(rng, count, mean, cv);
  const degrees = raw.map((x) => Math.max(1, Math.round(x)));
  let total = 0;
  for (let i = 0; i < degrees.length; i++) total += degrees[i];
  if (total % 2 === 1) degrees[0] += 1;
  return degrees;
}

/**
 * @typedef {{ degrees: number[], edges: [number, number][] }} Graph
 */

/**
 * Configuration model: cut every person into stubs, shuffle, pair them up.
 * Self-loops and repeat friendships are kept so the realised degree sequence is exact.
 * @param {() => number} rng
 * @param {number[]} degrees
 * @returns {Graph}
 */
export function configurationModel(rng, degrees) {
  /** @type {number[]} */
  const stubs = [];
  for (let i = 0; i < degrees.length; i++) {
    for (let k = 0; k < degrees[i]; k++) stubs.push(i);
  }
  for (let i = stubs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = stubs[i];
    stubs[i] = stubs[j];
    stubs[j] = tmp;
  }
  /** @type {[number, number][]} */
  const edges = [];
  for (let i = 0; i + 1 < stubs.length; i += 2) edges.push([stubs[i], stubs[i + 1]]);
  return { degrees: degrees.slice(), edges };
}

/**
 * Degree-preserving rewiring that pushes similar friend counts together.
 * @param {() => number} rng
 * @param {Graph} graph
 * @param {number} swaps
 * @returns {Graph}
 */
export function rewireAssortative(rng, graph, swaps) {
  const edges = graph.edges.map((e) => /** @type {[number, number]} */ ([e[0], e[1]]));
  const deg = graph.degrees;
  for (let s = 0; s < swaps; s++) {
    const a = Math.floor(rng() * edges.length);
    const b = Math.floor(rng() * edges.length);
    if (a === b) continue;
    const quad = [edges[a][0], edges[a][1], edges[b][0], edges[b][1]];
    quad.sort((p, q) => deg[q] - deg[p]);
    edges[a] = [quad[0], quad[1]];
    edges[b] = [quad[2], quad[3]];
  }
  return { degrees: deg.slice(), edges };
}

/**
 * @param {Graph} graph
 * @returns {number[][]}
 */
export function adjacency(graph) {
  /** @type {number[][]} */
  const adj = graph.degrees.map(() => []);
  for (const [u, v] of graph.edges) {
    adj[u].push(v);
    adj[v].push(u);
  }
  return adj;
}

/**
 * Pick a friendship at random, then one of its two ends: the mean friend count seen that way.
 * Computed by walking every endpoint rather than by formula, so the identity stays testable.
 * @param {Graph} graph
 * @returns {number}
 */
export function edgeEndpointMeanDegree(graph) {
  let s = 0;
  let n = 0;
  for (const [u, v] of graph.edges) {
    s += graph.degrees[u] + graph.degrees[v];
    n += 2;
  }
  return s / n;
}

/**
 * Ask every person about one of their friends, weight each person equally.
 * @param {number[][]} adj
 * @param {number[]} degrees
 * @returns {number}
 */
export function personAveragedFriendDegree(adj, degrees) {
  let s = 0;
  let n = 0;
  for (let i = 0; i < adj.length; i++) {
    const friends = adj[i];
    if (friends.length === 0) continue;
    let local = 0;
    for (let k = 0; k < friends.length; k++) local += degrees[friends[k]];
    s += local / friends.length;
    n += 1;
  }
  return s / n;
}

/**
 * Pearson correlation of the friend counts at the two ends of a friendship.
 * @param {Graph} graph
 * @returns {number}
 */
export function degreeAssortativity(graph) {
  /** @type {number[]} */
  const xs = [];
  /** @type {number[]} */
  const ys = [];
  for (const [u, v] of graph.edges) {
    xs.push(graph.degrees[u], graph.degrees[v]);
    ys.push(graph.degrees[v], graph.degrees[u]);
  }
  const mx = meanOf(xs);
  const my = meanOf(ys);
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  const denom = Math.sqrt(vx * vy);
  return denom === 0 ? 0 : cov / denom;
}

/**
 * Monte Carlo of "pick a random person, then one of their friends at random".
 * @param {() => number} rng
 * @param {number[][]} adj
 * @param {number[]} degrees
 * @param {number} trials
 * @returns {number[]}
 */
export function sampleFriendDegrees(rng, adj, degrees, trials) {
  const out = new Array(trials);
  for (let t = 0; t < trials; t++) {
    let person = Math.floor(rng() * adj.length);
    while (adj[person].length === 0) person = Math.floor(rng() * adj.length);
    const friends = adj[person];
    out[t] = degrees[friends[Math.floor(rng() * friends.length)]];
  }
  return out;
}

/**
 * The inflation predicted by the algebra: 1 + CV^2 of the underlying list.
 * @param {readonly number[]} xs
 * @returns {number}
 */
export function predictedInflation(xs) {
  const c = cvOf(xs);
  return 1 + c * c;
}

/**
 * One matched pair of worlds driven by a single spread setting.
 * @param {{ seed: number, cv: number, gapCount?: number, people?: number, meanGap?: number, meanFriends?: number, assortativeSwaps?: number }} opts
 */
export function buildWorlds(opts) {
  const gapCount = opts.gapCount ?? 4000;
  const people = opts.people ?? 900;
  const meanGap = opts.meanGap ?? 10;
  const meanFriends = opts.meanFriends ?? 6;
  const rng = makeRng(opts.seed);
  const gaps = sampleGaps(rng, gapCount, meanGap, opts.cv);
  const degrees = degreeSequence(rng, people, meanFriends, opts.cv);
  let graph = configurationModel(rng, degrees);
  const swaps = opts.assortativeSwaps ?? 0;
  if (swaps > 0) graph = rewireAssortative(rng, graph, swaps);
  return { rng, gaps, graph, adj: adjacency(graph) };
}
