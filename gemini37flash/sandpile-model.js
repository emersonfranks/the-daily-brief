// @ts-check

export class SandpileModel {
  /**
   * @param {number} size
   * @param {number} [seed]
   */
  constructor(size = 64, seed = 42) {
    this.size = size;
    this.grid = new Int32Array(size * size);
    this.rngState = (seed | 0) || 12345;
    this.totalAdded = 0;
    this.totalDissipated = 0;
    this.totalTopplings = 0;
    this.avalancheHistory = [];
    this.maxHistory = 10000;
  }

  random() {
    this.rngState = (Math.imul(this.rngState, 1664525) + 1013904223) | 0;
    return (this.rngState >>> 0) / 4294967296;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  getIndex(x, y) {
    return y * this.size + x;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  get(x, y) {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return 0;
    return this.grid[y * this.size + x];
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} value
   */
  set(x, y, value) {
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      this.grid[y * this.size + x] = value;
    }
  }

  reset() {
    this.grid.fill(0);
    this.totalAdded = 0;
    this.totalDissipated = 0;
    this.totalTopplings = 0;
    this.avalancheHistory = [];
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [amount=1]
   * @returns {{ size: number, area: number, duration: number, dissipated: number, toppledCells: Uint8Array }}
   */
  addGrain(x, y, amount = 1) {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
      return { size: 0, area: 0, duration: 0, dissipated: 0, toppledCells: new Uint8Array(this.size * this.size) };
    }

    this.totalAdded += amount;
    const initialIndex = y * this.size + x;
    this.grid[initialIndex] += amount;

    let queue = [];
    const inQueue = new Uint8Array(this.size * this.size);
    if (this.grid[initialIndex] >= 4) {
      queue.push(initialIndex);
      inQueue[initialIndex] = 1;
    }

    let avalancheSize = 0;
    let dissipated = 0;
    let duration = 0;
    const toppledCells = new Uint8Array(this.size * this.size);

    while (queue.length > 0) {
      duration++;
      const nextQueue = [];
      const currentQueue = queue;
      queue = [];

      for (let i = 0; i < currentQueue.length; i++) {
        const idx = currentQueue[i];
        inQueue[idx] = 0;
        const cellX = idx % this.size;
        const cellY = (idx / this.size) | 0;

        const val = this.grid[idx];
        if (val >= 4) {
          const topples = (val / 4) | 0;
          this.grid[idx] = val - topples * 4;
          avalancheSize += topples;
          toppledCells[idx] = 1;

          const neighbors = [
            [cellX + 1, cellY],
            [cellX - 1, cellY],
            [cellX, cellY + 1],
            [cellX, cellY - 1]
          ];

          for (let n = 0; n < 4; n++) {
            const nx = neighbors[n][0];
            const ny = neighbors[n][1];

            if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) {
              dissipated += topples;
            } else {
              const nIdx = ny * this.size + nx;
              this.grid[nIdx] += topples;
              if (this.grid[nIdx] >= 4 && inQueue[nIdx] === 0) {
                nextQueue.push(nIdx);
                inQueue[nIdx] = 1;
              }
            }
          }
        }
      }

      queue = nextQueue;
    }

    this.totalTopplings += avalancheSize;
    this.totalDissipated += dissipated;

    let area = 0;
    for (let i = 0; i < toppledCells.length; i++) {
      if (toppledCells[i] === 1) area++;
    }

    const event = { size: avalancheSize, area, duration, dissipated, toppledCells };
    if (this.avalancheHistory.length >= this.maxHistory) {
      this.avalancheHistory.shift();
    }
    this.avalancheHistory.push({ size: avalancheSize, duration, area });

    return event;
  }

  /**
   * @returns {{ size: number, area: number, duration: number, dissipated: number, toppledCells: Uint8Array, x: number, y: number }}
   */
  dropRandom() {
    const x = Math.floor(this.random() * this.size);
    const y = Math.floor(this.random() * this.size);
    const res = this.addGrain(x, y, 1);
    return { ...res, x, y };
  }

  /**
   * @param {number} count
   */
  fastForward(count) {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(this.random() * this.size);
      const y = Math.floor(this.random() * this.size);
      this.addGrain(x, y, 1);
    }
  }

  /**
   * @returns {number}
   */
  getMeanHeight() {
    let sum = 0;
    const len = this.grid.length;
    for (let i = 0; i < len; i++) {
      sum += this.grid[i];
    }
    return sum / len;
  }

  /**
   * @returns {number[]}
   */
  getHeightDistribution() {
    const counts = [0, 0, 0, 0];
    const len = this.grid.length;
    for (let i = 0; i < len; i++) {
      const val = this.grid[i];
      if (val >= 0 && val <= 3) {
        counts[val]++;
      }
    }
    return counts;
  }

  /**
   * @param {number} [numBins=16]
   * @returns {{ bins: number[], counts: number[], logBins: number[], logCounts: number[], slope: number, r2: number }}
   */
  getLogLogDistribution(numBins = 16) {
    const sizes = this.avalancheHistory.map(e => e.size).filter(s => s > 0);
    if (sizes.length < 10) {
      return { bins: [], counts: [], logBins: [], logCounts: [], slope: 0, r2: 0 };
    }

    const minSize = 1;
    let maxSize = 1;
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] > maxSize) maxSize = sizes[i];
    }

    if (maxSize <= minSize) {
      return { bins: [1], counts: [sizes.length], logBins: [0], logCounts: [Math.log10(sizes.length)], slope: 0, r2: 0 };
    }

    const logMin = Math.log10(minSize);
    const logMax = Math.log10(maxSize);
    const binWidth = (logMax - logMin) / numBins;

    const binCounts = new Array(numBins).fill(0);
    const binCenters = new Array(numBins).fill(0);

    for (let b = 0; b < numBins; b++) {
      binCenters[b] = Math.pow(10, logMin + (b + 0.5) * binWidth);
    }

    for (let i = 0; i < sizes.length; i++) {
      const s = sizes[i];
      const logS = Math.log10(s);
      let b = Math.floor((logS - logMin) / binWidth);
      if (b >= numBins) b = numBins - 1;
      if (b < 0) b = 0;
      binCounts[b]++;
    }

    const validLogBins = [];
    const validLogCounts = [];
    const validBins = [];
    const validCounts = [];

    for (let b = 0; b < numBins; b++) {
      if (binCounts[b] > 0) {
        const binSizeSpan = Math.pow(10, logMin + (b + 1) * binWidth) - Math.pow(10, logMin + b * binWidth);
        const density = binCounts[b] / (binSizeSpan * sizes.length);
        if (density > 0) {
          validBins.push(binCenters[b]);
          validCounts.push(density);
          validLogBins.push(Math.log10(binCenters[b]));
          validLogCounts.push(Math.log10(density));
        }
      }
    }

    let slope = 0;
    let r2 = 0;

    if (validLogBins.length >= 3) {
      const n = validLogBins.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      let sumYY = 0;

      for (let i = 0; i < n; i++) {
        sumX += validLogBins[i];
        sumY += validLogCounts[i];
        sumXY += validLogBins[i] * validLogCounts[i];
        sumXX += validLogBins[i] * validLogBins[i];
        sumYY += validLogCounts[i] * validLogCounts[i];
      }

      const denom = n * sumXX - sumX * sumX;
      if (Math.abs(denom) > 1e-12) {
        slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        const totalSS = sumYY - (sumY * sumY) / n;
        let residualSS = 0;
        for (let i = 0; i < n; i++) {
          const predicted = slope * validLogBins[i] + intercept;
          const diff = validLogCounts[i] - predicted;
          residualSS += diff * diff;
        }
        r2 = totalSS > 1e-12 ? Math.max(0, 1 - residualSS / totalSS) : 0;
      }
    }

    return {
      bins: validBins,
      counts: validCounts,
      logBins: validLogBins,
      logCounts: validLogCounts,
      slope,
      r2
    };
  }
}
