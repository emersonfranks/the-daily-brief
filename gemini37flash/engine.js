// @ts-check

/**
 * @typedef {Object} AvalancheStats
 * @property {number} size Total number of topple/spike events in this avalanche.
 * @property {number} duration Number of parallel relaxation waves.
 * @property {number} branchingRatio Ratio of child to parent activations across waves.
 * @property {number} boundaryLoss Grains/energy lost through open boundaries.
 * @property {number[]} waveActivity Number of activations at each discrete time step.
 */

/**
 * @typedef {Object} PowerLawFit
 * @property {number} exponent Critical power-law exponent tau (P(s) ~ s^-tau).
 * @property {number} rSquared Coefficient of determination (R^2) of the log-log linear fit.
 * @property {number[][]} binnedPoints Array of [center_s, probability_density] points.
 * @property {number} pointsEvaluated Number of logarithmic bins included in regression.
 */

/**
 * Seeded pseudo-random number generator (Mulberry32).
 * @param {number} seed
 * @returns {() => number}
 */
export function createRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SocEngine {
  /**
   * @param {Object} [options]
   * @param {number} [options.gridSize=36] Width and height of square grid.
   * @param {number} [options.threshold=4] Critical threshold for toppling/spiking.
   * @param {number} [options.leakRate=0] Probability of grain/potential dissipation per neighbor.
   * @param {number} [options.gain=1.0] Synaptic/transmission gain factor.
   * @param {number} [options.seed=42] Initial PRNG seed.
   */
  constructor(options = {}) {
    this.gridSize = options.gridSize ?? 36;
    this.threshold = options.threshold ?? 4;
    this.leakRate = options.leakRate ?? 0;
    this.gain = options.gain ?? 1.0;
    this.totalCells = this.gridSize * this.gridSize;

    this.grid = new Int32Array(this.totalCells);
    this.totalGrainsAdded = 0;
    this.totalGrainsLost = 0;
    this.totalAvalanches = 0;
    this.historySizes = [];
    this.historyDurations = [];
    this.historyBranching = [];

    this.rng = createRng(options.seed ?? 42);
    this.reset();
  }

  /**
   * Resets the lattice and pre-conditions it close to the critical steady-state.
   * @param {number} [initialDensity=2] Initial random integer per cell (0 to 3).
   */
  reset(initialDensity = 2) {
    this.grid.fill(0);
    this.totalGrainsAdded = 0;
    this.totalGrainsLost = 0;
    this.totalAvalanches = 0;
    this.historySizes = [];
    this.historyDurations = [];
    this.historyBranching = [];

    for (let i = 0; i < this.totalCells; i++) {
      this.grid[i] = Math.floor(this.rng() * (initialDensity + 1));
    }
  }

  /**
   * Warms up the lattice into the self-organized critical steady state.
   * @param {number} drops Number of grains to drop to settle on the attractor.
   */
  warmup(drops = 800) {
    for (let i = 0; i < drops; i++) {
      const x = Math.floor(this.rng() * this.gridSize);
      const y = Math.floor(this.rng() * this.gridSize);
      this.drop(x, y);
    }
    this.historySizes = [];
    this.historyDurations = [];
    this.historyBranching = [];
  }

  /**
   * Calculates total current grains/potential on the entire lattice.
   * @returns {number}
   */
  getTotalEnergy() {
    let sum = 0;
    for (let i = 0; i < this.totalCells; i++) {
      sum += this.grid[i];
    }
    return sum;
  }

  /**
   * Drops a single unit at (x, y) and resolves the resulting cascade synchronously.
   * @param {number} x
   * @param {number} y
   * @returns {AvalancheStats}
   */
  drop(x, y) {
    const idx = y * this.gridSize + x;
    this.grid[idx] += 1;
    this.totalGrainsAdded += 1;

    let unstable = [];
    for (let i = 0; i < this.totalCells; i++) {
      if (this.grid[i] >= this.threshold) {
        unstable.push(i);
      }
    }

    if (unstable.length === 0) {
      return {
        size: 0,
        duration: 0,
        branchingRatio: 1.0,
        boundaryLoss: 0,
        waveActivity: [0]
      };
    }

    let totalTopples = 0;
    let duration = 0;
    let boundaryLoss = 0;
    /** @type {number[]} */
    const waveActivity = [];

    const maxWaves = 100;
    const refractory = new Uint8Array(this.totalCells);

    while (unstable.length > 0 && duration < maxWaves) {
      duration += 1;
      const currentWaveCount = unstable.length;
      waveActivity.push(currentWaveCount);
      totalTopples += currentWaveCount;

      /** @type {Map<number, number>} */
      const increments = new Map();

      for (let k = 0; k < unstable.length; k++) {
        const cellIdx = unstable[k];
        refractory[cellIdx] = 1;
        const cellX = cellIdx % this.gridSize;
        const cellY = Math.floor(cellIdx / this.gridSize);

        const toppleCount = Math.floor(this.grid[cellIdx] / this.threshold);
        this.grid[cellIdx] %= this.threshold;

        const neighbors = [
          [cellX + 1, cellY],
          [cellX - 1, cellY],
          [cellX, cellY + 1],
          [cellX, cellY - 1]
        ];

        for (let n = 0; n < 4; n++) {
          const nx = neighbors[n][0];
          const ny = neighbors[n][1];

          if (this.leakRate > 0 && this.rng() < this.leakRate) {
            boundaryLoss += toppleCount;
            continue;
          }

          if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) {
            boundaryLoss += toppleCount;
          } else {
            const nIdx = ny * this.gridSize + nx;
            let transfer = toppleCount;
            if (this.gain > 1.0 && this.rng() < (this.gain - 1.0)) {
              transfer += 1;
            }
            increments.set(nIdx, (increments.get(nIdx) ?? 0) + transfer);
          }
        }
      }

      unstable = [];
      for (const [targetIdx, amount] of increments.entries()) {
        this.grid[targetIdx] += amount;
      }

      for (let i = 0; i < this.totalCells; i++) {
        if (this.grid[i] >= this.threshold) {
          if (this.gain > 1.0 && refractory[i] === 1) {
            continue;
          }
          unstable.push(i);
        }
      }
    }

    this.totalGrainsLost += boundaryLoss;
    this.totalAvalanches += 1;

    let primaryBranching = 0;
    if (waveActivity.length >= 1) {
      primaryBranching = waveActivity.length > 1 ? waveActivity[1] : 0;
    }

    this.historySizes.push(totalTopples);
    this.historyDurations.push(duration);
    this.historyBranching.push(primaryBranching);

    return {
      size: totalTopples,
      duration,
      branchingRatio: primaryBranching,
      boundaryLoss,
      waveActivity
    };

    this.historySizes.push(totalTopples);
    this.historyDurations.push(duration);
    this.historyBranching.push(branchingRatio);

    return {
      size: totalTopples,
      duration,
      branchingRatio,
      boundaryLoss,
      waveActivity
    };
  }

  /**
   * Computes the mean branching ratio over the last N avalanches.
   * @param {number} [lastN=500]
   * @returns {number}
   */
  getMeanBranchingRatio(lastN = 500) {
    if (this.historyBranching.length === 0) return 1.0;
    const slice = this.historyBranching.slice(-lastN);
    const sum = slice.reduce((acc, v) => acc + v, 0);
    return sum / slice.length;
  }

  /**
   * Fits a power-law distribution P(s) ~ s^-tau to the recorded avalanche sizes.
   * @param {number[]} [sizes] Custom array of sizes, or uses internal history if omitted.
   * @param {number} [minSize=2] Minimum avalanche size to include in fit.
   * @param {number} [numBins=16] Number of logarithmic bins.
   * @returns {PowerLawFit}
   */
  static fitPowerLaw(sizes, minSize = 2, numBins = 16) {
    const validSizes = sizes.filter(s => s >= minSize);
    if (validSizes.length < 20) {
      return { exponent: 0, rSquared: 0, binnedPoints: [], pointsEvaluated: 0 };
    }

    const maxS = Math.max(...validSizes);
    const minS = Math.min(...validSizes);
    if (maxS <= minS) {
      return { exponent: 0, rSquared: 0, binnedPoints: [], pointsEvaluated: 0 };
    }

    const logMin = Math.log10(minS);
    const logMax = Math.log10(maxS);
    const binWidth = (logMax - logMin) / numBins;

    /** @type {number[]} */
    const binCounts = new Array(numBins).fill(0);
    /** @type {number[]} */
    const binCenters = new Array(numBins).fill(0);
    /** @type {number[]} */
    const binSpans = new Array(numBins).fill(0);

    for (let b = 0; b < numBins; b++) {
      const lower = Math.pow(10, logMin + b * binWidth);
      const upper = Math.pow(10, logMin + (b + 1) * binWidth);
      binCenters[b] = Math.sqrt(lower * upper);
      binSpans[b] = upper - lower;
    }

    for (const s of validSizes) {
      const b = Math.min(numBins - 1, Math.max(0, Math.floor((Math.log10(s) - logMin) / binWidth)));
      binCounts[b] += 1;
    }

    const totalCount = validSizes.length;
    /** @type {number[][]} */
    const points = [];
    /** @type {number[]} */
    const logX = [];
    /** @type {number[]} */
    const logY = [];

    for (let b = 0; b < numBins; b++) {
      if (binCounts[b] > 0 && binSpans[b] > 0) {
        const probDensity = binCounts[b] / (totalCount * binSpans[b]);
        if (probDensity > 0) {
          points.push([binCenters[b], probDensity]);
          logX.push(Math.log(binCenters[b]));
          logY.push(Math.log(probDensity));
        }
      }
    }

    const n = points.length;
    if (n < 4) {
      return { exponent: 0, rSquared: 0, binnedPoints: points, pointsEvaluated: n };
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += logX[i];
      sumY += logY[i];
      sumXY += logX[i] * logY[i];
      sumXX += logX[i] * logX[i];
    }

    const meanX = sumX / n;
    const meanY = sumY / n;
    const slope = (sumXY - n * meanX * meanY) / (sumXX - n * meanX * meanX);
    const intercept = meanY - slope * meanX;

    let ssTot = 0;
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const yPred = slope * logX[i] + intercept;
      ssTot += Math.pow(logY[i] - meanY, 2);
      ssRes += Math.pow(logY[i] - yPred, 2);
    }

    const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
    const exponent = -slope;

    return {
      exponent: Number(exponent.toFixed(3)),
      rSquared: Number(rSquared.toFixed(3)),
      binnedPoints: points,
      pointsEvaluated: n
    };
  }
}
