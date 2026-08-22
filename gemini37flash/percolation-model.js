// @ts-check

/**
 * @typedef {Object} ClusterInfo
 * @property {number} id
 * @property {number} size
 * @property {boolean} spansVertical
 * @property {boolean} spansHorizontal
 * @property {number[]} siteIndices
 */

/**
 * @typedef {Object} PercolationStats
 * @property {number} L - Lattice dimension (L x L)
 * @property {number} p - Occupation probability
 * @property {number} totalSites - L * L
 * @property {number} occupiedCount - Number of occupied sites
 * @property {number} clusterCount - Total number of disconnected clusters
 * @property {number} maxClusterSize - Size of the largest cluster
 * @property {number} pInfinity - Fraction of occupied sites in largest cluster
 * @property {boolean} spansVertical - Whether a cluster connects top to bottom
 * @property {boolean} spansHorizontal - Whether a cluster connects left to right
 * @property {number} spanningClusterId - ID of spanning cluster (-1 if none)
 * @property {number} meanFiniteClusterSize - Mean size of finite (non-spanning) clusters
 * @property {Map<number, number>} sizeHistogram - Cluster size -> frequency
 */

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 * Ensures exact headless repeatability across Node.js and browser environments.
 * @param {number} seed
 * @returns {() => number} Returns float in [0, 1)
 */
export function createRng(seed) {
  let s = Math.floor(seed) >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Disjoint-Set Union (DSU) data structure with path compression and rank optimization.
 */
export class DisjointSet {
  /**
   * @param {number} size
   */
  constructor(size) {
    /** @type {Int32Array} */
    this.parent = new Int32Array(size);
    /** @type {Int32Array} */
    this.rank = new Int32Array(size);
    /** @type {Int32Array} */
    this.size = new Int32Array(size);
    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
      this.rank[i] = 0;
      this.size[i] = 1;
    }
  }

  /**
   * @param {number} x
   * @returns {number}
   */
  find(x) {
    let root = x;
    while (root !== this.parent[root]) {
      root = this.parent[root];
    }
    let curr = x;
    while (curr !== root) {
      const next = this.parent[curr];
      this.parent[curr] = root;
      curr = next;
    }
    return root;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {number} The new root
   */
  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return rootX;

    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
      this.size[rootY] += this.size[rootX];
      return rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
      this.size[rootX] += this.size[rootY];
      return rootX;
    } else {
      this.parent[rootY] = rootX;
      this.size[rootX] += this.size[rootY];
      this.rank[rootX]++;
      return rootX;
    }
  }

  /**
   * @param {number} x
   * @returns {number}
   */
  getSize(x) {
    return this.size[this.find(x)];
  }
}

/**
 * 2D Square Lattice Site Percolation Model.
 * Provides exact cluster labeling, topological connectivity analysis,
 * wavefront fire propagation, and Kirchhoff resistor network flow.
 */
export class PercolationLattice {
  /**
   * @param {number} L - Side length of the square lattice
   */
  constructor(L) {
    if (L < 4 || L > 200) {
      throw new Error(`Lattice dimension L must be between 4 and 200, got ${L}`);
    }
    this.L = L;
    this.totalSites = L * L;
    /** @type {Uint8Array} 0 = empty/insulator, 1 = occupied */
    this.grid = new Uint8Array(this.totalSites);
    /** @type {Int32Array} Cluster root ID per site (-1 if empty) */
    this.clusterMap = new Int32Array(this.totalSites);
    /** @type {Map<number, ClusterInfo>} */
    this.clusters = new Map();
    /** @type {PercolationStats | null} */
    this.stats = null;
  }

  /**
   * Convert 2D (row, col) coordinates to 1D index.
   * @param {number} r
   * @param {number} c
   * @returns {number}
   */
  index(r, c) {
    return r * this.L + c;
  }

  /**
   * Convert 1D index to 2D { r, c }.
   * @param {number} idx
   * @returns {{ r: number, c: number }}
   */
  coord(idx) {
    return {
      r: Math.floor(idx / this.L),
      c: idx % this.L,
    };
  }

  /**
   * Reset grid to empty.
   */
  clear() {
    this.grid.fill(0);
    this.clusterMap.fill(-1);
    this.clusters.clear();
    this.stats = null;
  }

  /**
   * Fill lattice randomly with occupation probability p.
   * @param {number} p - Probability in [0, 1]
   * @param {number} [seed] - Optional PRNG seed
   */
  populate(p, seed) {
    const clampedP = Math.max(0, Math.min(1, p));
    const rng = seed !== undefined ? createRng(seed) : Math.random;
    for (let i = 0; i < this.totalSites; i++) {
      this.grid[i] = rng() < clampedP ? 1 : 0;
    }
    this.analyzeClusters(clampedP);
  }

  /**
   * Set a specific site manually.
   * @param {number} r
   * @param {number} c
   * @param {number} val - 0 or 1
   */
  setSite(r, c, val) {
    if (r < 0 || r >= this.L || c < 0 || c >= this.L) return;
    const idx = this.index(r, c);
    this.grid[idx] = val ? 1 : 0;
  }

  /**
   * Perform exact Connected Component Analysis (Hoshen-Kopelman / DSU).
   * Identifies all disconnected clusters, finds spanning clusters, and computes statistics.
   * @param {number} [p] - Optional p for stats reporting
   * @returns {PercolationStats}
   */
  analyzeClusters(p = 0) {
    const dsu = new DisjointSet(this.totalSites);
    const L = this.L;

    // Connect adjacent occupied sites (4-neighborhood: right and down)
    for (let r = 0; r < L; r++) {
      for (let c = 0; c < L; c++) {
        const idx = this.index(r, c);
        if (this.grid[idx] === 0) continue;

        // Check right neighbor
        if (c + 1 < L && this.grid[this.index(r, c + 1)] === 1) {
          dsu.union(idx, this.index(r, c + 1));
        }
        // Check bottom neighbor
        if (r + 1 < L && this.grid[this.index(r + 1, c)] === 1) {
          dsu.union(idx, this.index(r + 1, c));
        }
      }
    }

    // Map each occupied site to its cluster root
    this.clusterMap.fill(-1);
    /** @type {Map<number, number[]>} */
    const clusterSites = new Map();

    let occupiedCount = 0;
    for (let i = 0; i < this.totalSites; i++) {
      if (this.grid[i] === 1) {
        occupiedCount++;
        const root = dsu.find(i);
        this.clusterMap[i] = root;
        let list = clusterSites.get(root);
        if (!list) {
          list = [];
          clusterSites.set(root, list);
        }
        list.push(i);
      }
    }

    // Analyze each cluster for boundaries & spanning
    this.clusters.clear();
    let maxClusterSize = 0;
    let spanningClusterId = -1;
    let spansVerticalGlobal = false;
    let spansHorizontalGlobal = false;

    /** @type {Map<number, number>} */
    const sizeHistogram = new Map();

    for (const [root, sites] of clusterSites.entries()) {
      let minR = L;
      let maxR = -1;
      let minC = L;
      let maxC = -1;

      for (let i = 0; i < sites.length; i++) {
        const { r, c } = this.coord(sites[i]);
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }

      const spansV = minR === 0 && maxR === L - 1;
      const spansH = minC === 0 && maxC === L - 1;

      if (spansV) spansVerticalGlobal = true;
      if (spansH) spansHorizontalGlobal = true;
      if ((spansV || spansH) && spanningClusterId === -1) {
        spanningClusterId = root;
      }

      const size = sites.length;
      if (size > maxClusterSize) {
        maxClusterSize = size;
      }

      sizeHistogram.set(size, (sizeHistogram.get(size) || 0) + 1);

      this.clusters.set(root, {
        id: root,
        size,
        spansVertical: spansV,
        spansHorizontal: spansH,
        siteIndices: sites,
      });
    }

    // Compute mean finite cluster size chi = sum'(s^2 n_s) / sum'(s n_s)
    let sumFiniteS2 = 0;
    let sumFiniteS = 0;
    for (const [root, cluster] of this.clusters.entries()) {
      // Exclude spanning cluster if it exists
      if (root === spanningClusterId) continue;
      sumFiniteS2 += cluster.size * cluster.size;
      sumFiniteS += cluster.size;
    }
    const meanFiniteClusterSize = sumFiniteS > 0 ? sumFiniteS2 / sumFiniteS : 0;

    const actualP = p > 0 ? p : occupiedCount / this.totalSites;
    const pInfinity = occupiedCount > 0 ? maxClusterSize / occupiedCount : 0;

    this.stats = {
      L: this.L,
      p: actualP,
      totalSites: this.totalSites,
      occupiedCount,
      clusterCount: this.clusters.size,
      maxClusterSize,
      pInfinity,
      spansVertical: spansVerticalGlobal,
      spansHorizontal: spansHorizontalGlobal,
      spanningClusterId,
      meanFiniteClusterSize,
      sizeHistogram,
    };

    return this.stats;
  }

  /**
   * Simulate a contagious spread / forest fire propagation from an ignition set.
   * Uses Breadth-First Search (BFS) to capture the exact wavefront time-steps.
   * @param {number[]} ignitionIndices - Array of 1D site indices where fire starts
   * @returns {{ burnOrder: number[], burnStep: Int32Array, totalBurnt: number, reachedOpposite: boolean }}
   */
  simulateFire(ignitionIndices) {
    const L = this.L;
    /** @type {Int32Array} -1 = unburnt, 0+ = timestep ignited */
    const burnStep = new Int32Array(this.totalSites).fill(-1);
    /** @type {number[]} */
    const burnOrder = [];
    /** @type {number[]} */
    let frontier = [];

    for (let i = 0; i < ignitionIndices.length; i++) {
      const idx = ignitionIndices[i];
      if (this.grid[idx] === 1) {
        burnStep[idx] = 0;
        frontier.push(idx);
        burnOrder.push(idx);
      }
    }

    let currentStep = 0;
    let reachedOpposite = false;

    while (frontier.length > 0) {
      currentStep++;
      /** @type {number[]} */
      const nextFrontier = [];

      for (let i = 0; i < frontier.length; i++) {
        const curr = frontier[i];
        const { r, c } = this.coord(curr);

        if (c === L - 1) {
          reachedOpposite = true;
        }

        // Check 4 neighbors
        const neighbors = [
          r > 0 ? this.index(r - 1, c) : -1,
          r + 1 < L ? this.index(r + 1, c) : -1,
          c > 0 ? this.index(r, c - 1) : -1,
          c + 1 < L ? this.index(r, c + 1) : -1,
        ];

        for (let n = 0; n < 4; n++) {
          const nIdx = neighbors[n];
          if (nIdx !== -1 && this.grid[nIdx] === 1 && burnStep[nIdx] === -1) {
            burnStep[nIdx] = currentStep;
            nextFrontier.push(nIdx);
            burnOrder.push(nIdx);
          }
        }
      }

      frontier = nextFrontier;
    }

    return {
      burnOrder,
      burnStep,
      totalBurnt: burnOrder.length,
      reachedOpposite,
    };
  }

  /**
   * Compute electrical potential field V across the lattice via Kirchhoff's nodal equations.
   * Boundary conditions: Top row (r=0) at V = 1.0 V, Bottom row (r=L-1) at V = 0.0 V.
   * Empty sites act as infinite resistance (open circuit).
   * Solves using Successive Over-Relaxation (SOR).
   * @param {number} [maxIterations=300]
   * @param {number} [tolerance=1e-5]
   * @returns {{ potentials: Float32Array, conductance: number, hasConduction: boolean }}
   */
  solveKirchhoffPotentials(maxIterations = 300, tolerance = 1e-5) {
    const L = this.L;
    const potentials = new Float32Array(this.totalSites);

    // If there is no vertical spanning cluster, effective conductance is zero
    if (!this.stats || !this.stats.spansVertical) {
      return { potentials, conductance: 0, hasConduction: false };
    }

    const spanningId = this.stats.spanningClusterId;
    if (spanningId === -1) {
      return { potentials, conductance: 0, hasConduction: false };
    }

    // Initialize potentials: Linear gradient as starting guess for spanning sites
    for (let r = 0; r < L; r++) {
      for (let c = 0; c < L; c++) {
        const idx = this.index(r, c);
        if (this.clusterMap[idx] === spanningId) {
          potentials[idx] = 1.0 - r / (L - 1);
        } else {
          potentials[idx] = 0;
        }
      }
    }

    const omega = 1.6; // SOR relaxation parameter

    // Iterative relaxation
    for (let iter = 0; iter < maxIterations; iter++) {
      let maxChange = 0;

      for (let r = 0; r < L; r++) {
        for (let c = 0; c < L; c++) {
          const idx = this.index(r, c);
          if (this.clusterMap[idx] !== spanningId) continue;

          // Fixed boundary conditions at top and bottom
          if (r === 0) {
            potentials[idx] = 1.0;
            continue;
          }
          if (r === L - 1) {
            potentials[idx] = 0.0;
            continue;
          }

          let neighborSum = 0;
          let neighborCount = 0;

          // 4 neighbors
          if (r > 0 && this.clusterMap[this.index(r - 1, c)] === spanningId) {
            neighborSum += potentials[this.index(r - 1, c)];
            neighborCount++;
          }
          if (r + 1 < L && this.clusterMap[this.index(r + 1, c)] === spanningId) {
            neighborSum += potentials[this.index(r + 1, c)];
            neighborCount++;
          }
          if (c > 0 && this.clusterMap[this.index(r, c - 1)] === spanningId) {
            neighborSum += potentials[this.index(r, c - 1)];
            neighborCount++;
          }
          if (c + 1 < L && this.clusterMap[this.index(r, c + 1)] === spanningId) {
            neighborSum += potentials[this.index(r, c + 1)];
            neighborCount++;
          }

          if (neighborCount > 0) {
            const targetV = neighborSum / neighborCount;
            const delta = targetV - potentials[idx];
            potentials[idx] += omega * delta;
            const absDelta = Math.abs(delta);
            if (absDelta > maxChange) maxChange = absDelta;
          }
        }
      }

      if (maxChange < tolerance) break;
    }

    // Compute total current leaving the top row (Conductance G = I / V_total = I / 1.0)
    let totalCurrent = 0;
    for (let c = 0; c < L; c++) {
      const topIdx = this.index(0, c);
      if (this.clusterMap[topIdx] === spanningId) {
        // Current flowing into row 1
        const belowIdx = this.index(1, c);
        if (this.clusterMap[belowIdx] === spanningId) {
          totalCurrent += potentials[topIdx] - potentials[belowIdx];
        }
      }
    }

    return {
      potentials,
      conductance: Math.max(0, totalCurrent),
      hasConduction: totalCurrent > 0,
    };
  }
}

/**
 * Monte Carlo evaluation of spanning probability across density values p.
 * @param {Object} options
 * @param {number} options.L - Lattice size
 * @param {number[]} options.pValues - Array of p values in [0, 1]
 * @param {number} options.trialsPerP - Number of independent trials per p
 * @param {number} [options.seed=42] - Base seed
 * @returns {{ p: number, spanningProb: number, avgPInfinity: number, avgMeanClusterSize: number }[]}
 */
export function runMonteCarloSweep({ L, pValues, trialsPerP, seed = 42 }) {
  const lattice = new PercolationLattice(L);
  const results = [];
  let trialSeed = seed;

  for (let i = 0; i < pValues.length; i++) {
    const p = pValues[i];
    let spanCount = 0;
    let sumPInfinity = 0;
    let sumMeanClusterSize = 0;

    for (let t = 0; t < trialsPerP; t++) {
      trialSeed = (trialSeed * 1664525 + 1013904223) >>> 0;
      lattice.populate(p, trialSeed);
      const stats = lattice.stats;
      if (!stats) continue;

      if (stats.spansVertical || stats.spansHorizontal) {
        spanCount++;
      }
      sumPInfinity += stats.pInfinity;
      sumMeanClusterSize += stats.meanFiniteClusterSize;
    }

    results.push({
      p,
      spanningProb: spanCount / trialsPerP,
      avgPInfinity: sumPInfinity / trialsPerP,
      avgMeanClusterSize: sumMeanClusterSize / trialsPerP,
    });
  }

  return results;
}
