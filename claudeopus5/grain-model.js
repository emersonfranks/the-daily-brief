// @ts-check

/**
 * The physics, with no opinion about how it is drawn. Nothing in this file touches the DOM,
 * which is what lets the test suite import it and check the science directly.
 */

const MOORE_DX = [1, 1, 0, -1, -1, -1, 0, 1];
const MOORE_DY = [0, 1, 1, 1, 0, -1, -1, -1];

/**
 * Deterministic xorshift32, so every number this page reports can be reproduced exactly.
 * @param {number} seed
 * @returns {() => number}
 */
export function createRng(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

/**
 * The von Neumann-Mullins prediction: growth depends on side count and nothing else.
 * @param {number} k
 * @param {number} sides
 * @returns {number}
 */
export function vonNeumannRate(k, sides) {
  return k * (sides - 6);
}

/** @typedef {{ x: number, y: number, weight: number }} FitPoint */
/** @typedef {{ slope: number, intercept: number, r2: number, samples: number }} Fit */

/**
 * @param {readonly FitPoint[]} points
 * @returns {Fit | null} null when the points do not span more than one distinct x
 */
export function weightedLeastSquares(points) {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, samples = 0;
  for (const { x, y, weight } of points) {
    sw += weight; sx += weight * x; sy += weight * y;
    sxx += weight * x * x; sxy += weight * x * y; samples += weight;
  }
  const denominator = sw * sxx - sx * sx;
  if (sw === 0 || denominator === 0) return null;

  const slope = (sw * sxy - sx * sy) / denominator;
  const intercept = (sxx * sy - sx * sxy) / denominator;
  const meanY = sy / sw;
  let totalSS = 0, residualSS = 0;
  for (const { x, y, weight } of points) {
    totalSS += weight * (y - meanY) ** 2;
    residualSS += weight * (y - (slope * x + intercept)) ** 2;
  }
  return { slope, intercept, r2: totalSS > 0 ? 1 - residualSS / totalSS : 0, samples };
}

/**
 * A two-dimensional cellular network coarsening under curvature, as a Q-state Potts model.
 * Cell identity is conserved, so an individual cell can be tracked from birth to death.
 */
export class GrainModel {
  /**
   * @param {{ size?: number, seeds?: number, temperature?: number, minContact?: number, seed?: number }} [options]
   */
  constructor(options = {}) {
    const { size = 300, seeds = 1000, temperature = 0.75, minContact = 3, seed = 1 } = options;

    this.size = size;
    this.siteCount = size * size;
    this.seedCount = seeds;
    this.temperature = temperature;
    /** Two cells count as neighbours only once they share this many sites of wall. */
    this.minContact = minContact;

    this.time = 0;
    this.live = 0;
    this.deaths = 0;
    /** Mean neighbour count over every contact, which is the quantity Euler constrains. */
    this.meanSides = 0;
    /** Mean neighbour count under the minContact threshold, as plotted in the histogram. */
    this.meanSidesThresholded = 0;

    this.state = new Int32Array(this.siteCount);
    this.area = new Int32Array(seeds);
    this.sides = new Int32Array(seeds);
    this.sidesAll = new Int32Array(seeds);

    this._boundary = new Int32Array(this.siteCount);
    /** @type {Map<number, number>} */
    this._contacts = new Map();
    this._rng = createRng(seed);

    this.reset();
  }

  /** Seeds a fresh Voronoi partition by breadth-first growth from random sites. */
  reset() {
    const { size, siteCount, seedCount, state } = this;
    state.fill(-1);
    const queueX = new Int32Array(siteCount);
    const queueY = new Int32Array(siteCount);
    let head = 0, tail = 0;

    for (let cell = 0; cell < seedCount; cell++) {
      let x, y, site;
      do {
        x = Math.floor(this._rng() * size);
        y = Math.floor(this._rng() * size);
        site = y * size + x;
      } while (state[site] !== -1);
      state[site] = cell;
      queueX[tail] = x; queueY[tail] = y; tail++;
    }

    const stepX = [1, -1, 0, 0], stepY = [0, 0, 1, -1];
    while (head < tail) {
      const x = queueX[head], y = queueY[head];
      head++;
      const owner = state[y * size + x];
      for (let d = 0; d < 4; d++) {
        const nx = (x + stepX[d] + size) % size;
        const ny = (y + stepY[d] + size) % size;
        const neighbour = ny * size + nx;
        if (state[neighbour] === -1) {
          state[neighbour] = owner;
          queueX[tail] = nx; queueY[tail] = ny; tail++;
        }
      }
    }

    this.time = 0;
    this.live = 0;
    this.deaths = 0;
    this.census({ countDeaths: false });
  }

  /** Offers every boundary site one flip to a randomly chosen neighbour's identity. */
  sweep() {
    const { size, state, _boundary: boundary } = this;
    let boundaryCount = 0;

    for (let y = 0; y < size; y++) {
      const row = y * size;
      for (let x = 0; x < size; x++) {
        const site = row + x;
        const owner = state[site];
        for (let d = 0; d < 8; d++) {
          const nx = (x + MOORE_DX[d] + size) % size;
          const ny = (y + MOORE_DY[d] + size) % size;
          if (state[ny * size + nx] !== owner) {
            boundary[boundaryCount++] = site;
            break;
          }
        }
      }
    }

    for (let i = 0; i < boundaryCount; i++) {
      const site = boundary[Math.floor(this._rng() * boundaryCount)];
      const x = site % size;
      const y = Math.floor(site / size);
      const owner = state[site];

      const pick = Math.floor(this._rng() * 8);
      const candidate = state[((y + MOORE_DY[pick] + size) % size) * size + ((x + MOORE_DX[pick] + size) % size)];
      if (candidate === owner) continue;

      let energyBefore = 0, energyAfter = 0;
      for (let d = 0; d < 8; d++) {
        const neighbour = state[((y + MOORE_DY[d] + size) % size) * size + ((x + MOORE_DX[d] + size) % size)];
        if (neighbour !== owner) energyBefore++;
        if (neighbour !== candidate) energyAfter++;
      }

      const delta = energyAfter - energyBefore;
      if (delta <= 0 || this._rng() < Math.exp(-delta / this.temperature)) {
        state[site] = candidate;
      }
    }

    this.time++;
  }

  /**
   * Recomputes areas and neighbour counts in place.
   * @param {{ countDeaths?: boolean }} [options]
   */
  census(options = {}) {
    const { countDeaths = true } = options;
    const { size, siteCount, seedCount, state, area, sides, sidesAll, _contacts: contacts } = this;
    const previousLive = this.live;

    area.fill(0);
    for (let site = 0; site < siteCount; site++) area[state[site]]++;

    contacts.clear();
    for (let y = 0; y < size; y++) {
      const row = y * size;
      const rowBelow = ((y + 1) % size) * size;
      for (let x = 0; x < size; x++) {
        const owner = state[row + x];
        const right = state[row + ((x + 1) % size)];
        const below = state[rowBelow + x];
        if (right !== owner) {
          const key = owner < right ? owner * seedCount + right : right * seedCount + owner;
          contacts.set(key, (contacts.get(key) ?? 0) + 1);
        }
        if (below !== owner) {
          const key = owner < below ? owner * seedCount + below : below * seedCount + owner;
          contacts.set(key, (contacts.get(key) ?? 0) + 1);
        }
      }
    }

    sides.fill(0);
    sidesAll.fill(0);
    for (const [key, shared] of contacts) {
      const a = Math.floor(key / seedCount);
      const b = key % seedCount;
      sidesAll[a]++; sidesAll[b]++;
      if (shared >= this.minContact) { sides[a]++; sides[b]++; }
    }

    let live = 0, totalSides = 0, totalThresholded = 0;
    for (let cell = 0; cell < seedCount; cell++) {
      if (area[cell] > 0) {
        live++;
        totalSides += sidesAll[cell];
        totalThresholded += sides[cell];
      }
    }

    this.live = live;
    this.meanSides = live > 0 ? totalSides / live : 0;
    this.meanSidesThresholded = live > 0 ? totalThresholded / live : 0;
    if (countDeaths) this.deaths += Math.max(0, previousLive - live);
  }

  /**
   * Mean neighbour count when only contacts of at least `threshold` sites are counted.
   * At a threshold of one the lattice records an edge wherever three cells meet at a point,
   * which is the only thing that ever lifts the mean above Euler's ceiling of six.
   * @param {number} threshold
   * @returns {number}
   */
  meanSidesAtThreshold(threshold) {
    const counts = new Int32Array(this.seedCount);
    for (const [key, shared] of this._contacts) {
      if (shared < threshold) continue;
      counts[Math.floor(key / this.seedCount)]++;
      counts[key % this.seedCount]++;
    }
    let live = 0, total = 0;
    for (let cell = 0; cell < this.seedCount; cell++) {
      if (this.area[cell] > 0) { live++; total += counts[cell]; }
    }
    return live > 0 ? total / live : 0;
  }

  /** @returns {number} total occupied sites, which must always equal the lattice size */
  totalArea() {
    let total = 0;
    for (let cell = 0; cell < this.seedCount; cell++) total += this.area[cell];
    return total;
  }

  /** @returns {number} mean area of the surviving cells */
  meanArea() {
    return this.live > 0 ? this.totalArea() / this.live : 0;
  }
}

/**
 * Accumulates observed growth rates binned by side count, so the law can be fitted from
 * the same data the page is drawing.
 */
export class RateAccumulator {
  constructor() {
    /** @type {Map<number, { total: number, samples: number }>} */
    this.bins = new Map();
    /** @type {Int32Array | null} */
    this._previousArea = null;
    /** @type {Int32Array | null} */
    this._previousSides = null;
    this._previousTime = 0;
  }

  /**
   * Records the area change since the previous call, attributed to the earlier side count.
   * @param {GrainModel} model
   */
  record(model) {
    const previousArea = this._previousArea;
    const previousSides = this._previousSides;
    const elapsed = model.time - this._previousTime;

    if (previousArea && previousSides && elapsed > 0) {
      for (let cell = 0; cell < model.seedCount; cell++) {
        const sides = previousSides[cell];
        if (previousArea[cell] > 0 && sides >= 3) {
          let bin = this.bins.get(sides);
          if (!bin) { bin = { total: 0, samples: 0 }; this.bins.set(sides, bin); }
          bin.total += (model.area[cell] - previousArea[cell]) / elapsed;
          bin.samples++;
        }
      }
    }

    this._previousArea = model.area.slice();
    this._previousSides = model.sides.slice();
    this._previousTime = model.time;
  }

  /**
   * @param {number} sides
   * @returns {number | null} mean observed dA/dt for cells with this many sides
   */
  meanRate(sides) {
    const bin = this.bins.get(sides);
    return bin && bin.samples > 0 ? bin.total / bin.samples : null;
  }

  /**
   * @param {{ min?: number, max?: number, minSamples?: number }} [range]
   * @returns {Fit | null}
   */
  fit(range = {}) {
    const { min = 5, max = 9, minSamples = 40 } = range;
    /** @type {FitPoint[]} */
    const points = [];
    for (const [sides, bin] of this.bins) {
      if (sides >= min && sides <= max && bin.samples >= minSamples) {
        points.push({ x: sides - 6, y: bin.total / bin.samples, weight: bin.samples });
      }
    }
    return points.length >= 3 ? weightedLeastSquares(points) : null;
  }
}
