// @ts-check
// Site percolation on a square lattice. Pure computation, no DOM — so it can be
// run headlessly and proven. Both "domains" on the page (porous rock, wildfire)
// are literally this one engine with two colour schemes.

/**
 * Deterministic PRNG (mulberry32). Same seed → same lattice, so every measured
 * number on the page is reproducible.
 * @param {number} seed
 * @returns {() => number} generator returning a float in [0, 1)
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fill an L×L lattice, each site open with probability p.
 * @param {number} L side length
 * @param {number} p occupation probability
 * @param {() => number} rng
 * @returns {Uint8Array} 1 = open site, 0 = blocked
 */
export function generateLattice(L, p, rng) {
  const grid = new Uint8Array(L * L);
  for (let i = 0; i < grid.length; i++) grid[i] = rng() < p ? 1 : 0;
  return grid;
}

/**
 * Weighted union-find with path halving.
 * @param {number} n
 */
function makeUnionFind(n) {
  const parent = new Int32Array(n);
  const size = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    parent[i] = i;
    size[i] = 1;
  }
  /** @param {number} x */
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  /** @param {number} a @param {number} b */
  function union(a, b) {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    if (size[ra] < size[rb]) {
      const t = ra;
      ra = rb;
      rb = t;
    }
    parent[rb] = ra;
    size[ra] += size[rb];
  }
  return { find, union, size };
}

/**
 * Analyse a lattice: does an open cluster connect the top edge to the bottom
 * edge (4-neighbour), and what fraction of all sites is the largest cluster?
 * @param {Uint8Array} grid
 * @param {number} L
 * @returns {{ spans: boolean, largestFraction: number }}
 */
export function analyze(grid, L) {
  const N = L * L;
  const TOP = N;
  const BOTTOM = N + 1;
  const uf = makeUnionFind(N + 2);
  for (let r = 0; r < L; r++) {
    for (let c = 0; c < L; c++) {
      const i = r * L + c;
      if (!grid[i]) continue;
      if (c + 1 < L && grid[i + 1]) uf.union(i, i + 1);
      if (r + 1 < L && grid[i + L]) uf.union(i, i + L);
      if (r === 0) uf.union(i, TOP);
      if (r === L - 1) uf.union(i, BOTTOM);
    }
  }
  const spans = uf.find(TOP) === uf.find(BOTTOM);

  let largest = 0;
  for (let i = 0; i < N; i++) {
    if (!grid[i]) continue;
    if (uf.find(i) === i && uf.size[i] > largest) largest = uf.size[i];
  }
  return { spans, largestFraction: largest / N };
}

/**
 * Mask marking every open site that belongs to a cluster connecting the top
 * edge to the bottom edge. Pure, so the renderer never has to know the physics.
 * @param {Uint8Array} grid
 * @param {number} L
 * @returns {Uint8Array} 1 = part of the spanning cluster, else 0
 */
export function spanningMask(grid, L) {
  const N = L * L;
  const TOP = N;
  const BOTTOM = N + 1;
  const uf = makeUnionFind(N + 2);
  for (let r = 0; r < L; r++) {
    for (let c = 0; c < L; c++) {
      const i = r * L + c;
      if (!grid[i]) continue;
      if (c + 1 < L && grid[i + 1]) uf.union(i, i + 1);
      if (r + 1 < L && grid[i + L]) uf.union(i, i + L);
      if (r === 0) uf.union(i, TOP);
      if (r === L - 1) uf.union(i, BOTTOM);
    }
  }
  const mask = new Uint8Array(N);
  if (uf.find(TOP) !== uf.find(BOTTOM)) return mask;
  const spanRoot = uf.find(TOP);
  for (let i = 0; i < N; i++) {
    if (grid[i] && uf.find(i) === spanRoot) mask[i] = 1;
  }
  return mask;
}

/**
 * Fraction of random lattices at density p that span top-to-bottom.
 * @param {number} L
 * @param {number} p
 * @param {number} trials
 * @param {() => number} rng
 * @returns {number} spanning probability in [0, 1]
 */
export function spanningProbability(L, p, trials, rng) {
  let hits = 0;
  for (let t = 0; t < trials; t++) {
    if (analyze(generateLattice(L, p, rng), L).spans) hits++;
  }
  return hits / trials;
}

/**
 * Estimate the density at which spanning probability crosses 0.5, by bisection.
 * Spanning probability is monotonic in p, so bisection converges.
 * @param {number} L
 * @param {number} trials samples per probability evaluation
 * @param {() => number} rng
 * @param {number} [iterations]
 * @returns {number} estimated crossing density
 */
export function estimateThreshold(L, trials, rng, iterations = 18) {
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < iterations; k++) {
    const mid = (lo + hi) / 2;
    if (spanningProbability(L, mid, trials, rng) < 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Width of the spanning transition: p(P=hiQ) − p(P=loQ), found by scanning a
 * dense grid of densities. Shrinks as L grows (finite-size scaling).
 * @param {number} L
 * @param {number} trials
 * @param {() => number} rng
 * @param {number} [loQ]
 * @param {number} [hiQ]
 * @returns {number} transition width in density units
 */
export function transitionWidth(L, trials, rng, loQ = 0.1, hiQ = 0.9) {
  let pLo = NaN;
  let pHi = NaN;
  for (let step = 0; step <= 100; step++) {
    const p = step / 100;
    const prob = spanningProbability(L, p, trials, rng);
    if (Number.isNaN(pLo) && prob >= loQ) pLo = p;
    if (Number.isNaN(pHi) && prob >= hiQ) {
      pHi = p;
      break;
    }
  }
  return pHi - pLo;
}
