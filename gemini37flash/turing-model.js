// @ts-check

/**
 * @fileoverview Pure headless domain model for Reaction-Diffusion Morphogenesis
 * based on the Alan Turing (1952) / Gray-Scott / Max Klausmeier (1999) activator-depletion framework.
 *
 * Implements discrete 2D 9-point isotropic Laplacian diffusion, nonlinear autocatalytic
 * reaction kinetics, hillside advection for contour banding, spatial autocorrelation
 * wavelength extraction, and localized resource depletion halo analysis.
 *
 * NO DOM or Canvas dependencies.
 */

/**
 * @typedef {Object} SimulationConfig
 * @property {number} width Grid width (e.g. 64 or 128)
 * @property {number} height Grid height
 * @property {number} Du Diffusion rate of substrate/water U (e.g. 0.20)
 * @property {number} Dv Diffusion rate of activator/biomass V (e.g. 0.10)
 * @property {number} F Feed rate (resource influx / rainfall / morphogen supply)
 * @property {number} k Kill rate (decay / mortality / evaporation)
 * @property {number} dt Time step size (e.g. 1.0)
 * @property {number} slopeAdvection Downhill advection rate for hillside contour bands (0 = flat plain)
 */

/**
 * Default preset configurations matching biological skin pigmentation and arid ecological patterns.
 */
export const PRESETS = {
  LEOPARD_SPOTS: {
    id: 'leopard-spots',
    name: 'Leopard Spots ↔ Desert Clump Ecosystem',
    Du: 0.20,
    Dv: 0.10,
    F: 0.035,
    k: 0.065,
    slopeAdvection: 0.0,
    domainA: 'Mammalian Melanocyte Clusters (Panthera pardus)',
    domainB: 'Arid Vegetation Fairy Circles & Clumps (Namib/Pillbara)'
  },
  ZEBRA_STRIPES: {
    id: 'zebra-stripes',
    name: 'Zebra Stripes ↔ Tiger Bush Contour Bands',
    Du: 0.20,
    Dv: 0.10,
    F: 0.042,
    k: 0.063,
    slopeAdvection: 0.06,
    domainA: 'Embryonic Melanoblast Traveling Waves (Equus quagga)',
    domainB: 'Sahelian Slope Bands (Brousse Tigrée / Tiger Bush)'
  },
  JUNGLE_LABYRINTH: {
    id: 'jungle-labyrinth',
    name: 'Labyrinthine Maze ↔ Dense Semiarid Shrubland',
    Du: 0.21,
    Dv: 0.09,
    F: 0.030,
    k: 0.057,
    slopeAdvection: 0.0,
    domainA: 'Marine Angelfish Skin Labyrinth (Pomacanthus semicirculatus)',
    domainB: 'Spinifex Grass Mosaics & Gapped Bush'
  },
  ROSETTE_GAPS: {
    id: 'rosette-gaps',
    name: 'Rosette Centers ↔ Savanna Canopy Clearings',
    Du: 0.16,
    Dv: 0.08,
    F: 0.054,
    k: 0.063,
    slopeAdvection: 0.0,
    domainA: 'Jaguar Rosette Clearings (Panthera onca)',
    domainB: 'Savanna Gapped Woodland Clearings'
  },
  COLLAPSE_DESERT: {
    id: 'collapse-desert',
    name: 'Melanin Failure ↔ Drought Desertification',
    Du: 0.20,
    Dv: 0.10,
    F: 0.014,
    k: 0.065,
    slopeAdvection: 0.0,
    domainA: 'Albino/Pigment Deprivation (Barren Tissue)',
    domainB: 'Tipping-Point Desertification (Hyper-Arid Void)'
  }
};

/**
 * 2D Reaction-Diffusion State and Discrete PDE Solver
 */
export class TuringSimulation {
  /**
   * @param {Partial<SimulationConfig>} [options]
   */
  constructor(options = {}) {
    this.width = options.width ?? 64;
    this.height = options.height ?? 64;
    this.size = this.width * this.height;

    this.Du = options.Du ?? 0.20;
    this.Dv = options.Dv ?? 0.10;
    this.F = options.F ?? 0.035;
    this.k = options.k ?? 0.065;
    this.dt = options.dt ?? 1.0;
    this.slopeAdvection = options.slopeAdvection ?? 0.0;

    this.u = new Float64Array(this.size);
    this.v = new Float64Array(this.size);
    this.nextU = new Float64Array(this.size);
    this.nextV = new Float64Array(this.size);

    this.stepCount = 0;
    this.reset();
  }

  /**
   * Initializes grid state: Substrate U = 1.0, with designated perturbations of Activator V.
   * @param {'central_seed' | 'random_noise' | 'multi_spot' | 'uniform'} [pattern='central_seed']
   * @param {number} [seed=42]
   */
  reset(pattern = 'central_seed', seed = 42) {
    this.stepCount = 0;
    this.u.fill(1.0);
    this.v.fill(0.0);

    let rng = seed;
    /** Pseudorandom generator [0, 1) */
    const random = () => {
      rng = (rng * 1664525 + 1013904223) % 4294967296;
      return rng / 4294967296;
    };

    const cx = Math.floor(this.width / 2);
    const cy = Math.floor(this.height / 2);

    if (pattern === 'central_seed') {
      const r = Math.max(3, Math.floor(this.width / 8));
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          const idx = this.index(x, y);
          this.u[idx] = 0.5 + (random() - 0.5) * 0.05;
          this.v[idx] = 0.35 + (random() - 0.5) * 0.05;
        }
      }
    } else if (pattern === 'random_noise') {
      // Seed several small micro-nuclei across the grid
      const nucleiCount = Math.max(6, Math.floor(this.size / 250));
      for (let n = 0; n < nucleiCount; n++) {
        const nx = Math.floor(random() * (this.width - 6)) + 3;
        const ny = Math.floor(random() * (this.height - 6)) + 3;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const idx = this.index(nx + dx, ny + dy);
            this.u[idx] = 0.5 + (random() - 0.5) * 0.1;
            this.v[idx] = 0.3 + (random() - 0.5) * 0.1;
          }
        }
      }
    } else if (pattern === 'multi_spot') {
      const spotCount = 8;
      for (let s = 0; s < spotCount; s++) {
        const sx = Math.floor(random() * (this.width - 10)) + 5;
        const sy = Math.floor(random() * (this.height - 10)) + 5;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const idx = this.index(sx + dx, sy + dy);
            this.u[idx] = 0.45;
            this.v[idx] = 0.40;
          }
        }
      }
    }
  }

  /**
   * Helper to get wrapped 1D index from (x, y) with periodic boundary conditions.
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  index(x, y) {
    const wx = (x % this.width + this.width) % this.width;
    const wy = (y % this.height + this.height) % this.height;
    return wy * this.width + wx;
  }

  /**
   * Performs N discrete integration steps using an isotropic 9-point Laplacian.
   * @param {number} [steps=1]
   */
  step(steps = 1) {
    const w = this.width;
    const h = this.height;
    const dt = this.dt;
    const Du = this.Du;
    const Dv = this.Dv;
    const F = this.F;
    const k = this.k;
    const adv = this.slopeAdvection;

    for (let s = 0; s < steps; s++) {
      for (let y = 0; y < h; y++) {
        const yTop = (y - 1 + h) % h;
        const yBot = (y + 1) % h;
        const rowOffset = y * w;
        const topOffset = yTop * w;
        const botOffset = yBot * w;

        for (let x = 0; x < w; x++) {
          const xLeft = (x - 1 + w) % w;
          const xRight = (x + 1) % w;

          const idx = rowOffset + x;
          const uVal = this.u[idx];
          const vVal = this.v[idx];

          // 9-point isotropic discrete Laplacian
          // Orthogonal neighbors have weight 0.2, diagonal neighbors have weight 0.05, center is -1.0
          const lapU =
            0.2 * (this.u[topOffset + x] + this.u[botOffset + x] + this.u[rowOffset + xLeft] + this.u[rowOffset + xRight]) +
            0.05 * (this.u[topOffset + xLeft] + this.u[topOffset + xRight] + this.u[botOffset + xLeft] + this.u[botOffset + xRight]) -
            uVal;

          const lapV =
            0.2 * (this.v[topOffset + x] + this.v[botOffset + x] + this.v[rowOffset + xLeft] + this.v[rowOffset + xRight]) +
            0.05 * (this.v[topOffset + xLeft] + this.v[topOffset + xRight] + this.v[botOffset + xLeft] + this.v[botOffset + xRight]) -
            vVal;

          // Hillside advection (water runoff downhill in Y direction)
          let advectionU = 0;
          if (adv !== 0) {
            advectionU = adv * (this.u[topOffset + x] - uVal);
          }

          // Nonlinear reaction kinetics: U + 2V -> 3V with supply F and decay (F+k)
          const uvv = uVal * vVal * vVal;
          const du = Du * lapU - uvv + F * (1.0 - uVal) + advectionU;
          const dv = Dv * lapV + uvv - (F + k) * vVal;

          const nextUVal = uVal + du * dt;
          const nextVVal = vVal + dv * dt;

          this.nextU[idx] = nextUVal < 0 ? 0 : (nextUVal > 1.0 ? 1.0 : nextUVal);
          this.nextV[idx] = nextVVal < 0 ? 0 : (nextVVal > 1.0 ? 1.0 : nextVVal);
        }
      }

      // Swap buffers
      const tempU = this.u;
      this.u = this.nextU;
      this.nextU = tempU;

      const tempV = this.v;
      this.v = this.nextV;
      this.nextV = tempV;

      this.stepCount++;
    }
  }

  /**
   * Injects or clears activator/substrate (e.g. for user interactive brush tool).
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {number} amountV
   * @param {number} amountU
   */
  inject(cx, cy, radius, amountV, amountU = 0) {
    const rSq = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= rSq) {
          const idx = this.index(Math.floor(cx + dx), Math.floor(cy + dy));
          if (amountV !== 0) {
            const nv = this.v[idx] + amountV;
            this.v[idx] = Math.max(0, Math.min(1.0, nv));
          }
          if (amountU !== 0) {
            const nu = this.u[idx] + amountU;
            this.u[idx] = Math.max(0, Math.min(1.0, nu));
          }
        }
      }
    }
  }

  /**
   * Computes statistical field metrics.
   * @returns {{
   *   meanU: number,
   *   meanV: number,
   *   stdV: number,
   *   maxV: number,
   *   minV: number,
   *   activeCoverage: number,
   *   patternFormed: boolean
   * }}
   */
  getStats() {
    let sumU = 0;
    let sumV = 0;
    let sumVsq = 0;
    let maxV = -Infinity;
    let minV = Infinity;
    let activePixels = 0;

    for (let i = 0; i < this.size; i++) {
      const uVal = this.u[i];
      const vVal = this.v[i];
      sumU += uVal;
      sumV += vVal;
      sumVsq += vVal * vVal;
      if (vVal > maxV) maxV = vVal;
      if (vVal < minV) minV = vVal;
      if (vVal > 0.15) activePixels++;
    }

    const meanU = sumU / this.size;
    const meanV = sumV / this.size;
    const varianceV = Math.max(0, (sumVsq / this.size) - (meanV * meanV));
    const stdV = Math.sqrt(varianceV);
    const activeCoverage = activePixels / this.size;

    return {
      meanU,
      meanV,
      stdV,
      maxV,
      minV,
      activeCoverage,
      patternFormed: (stdV > 0.04 && maxV > 0.25) || (meanV > 0.10 && maxV > 0.30)
    };
  }

  /**
   * Measures 2D radial autocorrelation & dominant spatial wavelength.
   * @param {number} [maxRadius=24]
   * @returns {{ correlation: number[], dominantWavelength: number }}
   */
  measureWavelength(maxRadius = 24) {
    const w = this.width;
    const h = this.height;
    const { meanV, stdV } = this.getStats();

    if (stdV < 0.01) {
      return { correlation: new Array(maxRadius + 1).fill(0), dominantWavelength: 0 };
    }

    const counts = new Float64Array(maxRadius + 1);
    const sums = new Float64Array(maxRadius + 1);

    const step = Math.max(1, Math.floor(w / 32));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const v0 = this.v[y * w + x] - meanV;
        for (let dy = -maxRadius; dy <= maxRadius; dy++) {
          for (let dx = -maxRadius; dx <= maxRadius; dx++) {
            const r = Math.round(Math.hypot(dx, dy));
            if (r <= maxRadius) {
              const v1 = this.v[this.index(x + dx, y + dy)] - meanV;
              sums[r] += v0 * v1;
              counts[r]++;
            }
          }
        }
      }
    }

    const denom = sums[0] > 0 ? sums[0] / counts[0] : 1;
    const correlation = [];
    for (let r = 0; r <= maxRadius; r++) {
      correlation.push(counts[r] > 0 ? (sums[r] / counts[r]) / denom : 0);
    }

    let passedTrough = false;
    let peakR = 0;
    let peakVal = -Infinity;

    for (let r = 2; r < maxRadius; r++) {
      if (correlation[r] < 0.2 || (correlation[r] < correlation[r - 1] && correlation[r] < correlation[r + 1])) {
        passedTrough = true;
      }
      if (passedTrough && correlation[r] > correlation[r - 1] && correlation[r] > (correlation[r + 1] ?? -1)) {
        if (correlation[r] > peakVal) {
          peakVal = correlation[r];
          peakR = r;
        }
      }
    }

    return {
      correlation,
      dominantWavelength: peakR
    };
  }

  /**
   * Measures local activator peak count and adjacent substrate depletion halo.
   * @returns {{
   *   peakCount: number,
   *   avgPeakU: number,
   *   avgHaloU: number,
   *   avgFarU: number,
   *   depletionRatio: number
   * }}
   */
  measureDepletionHalo() {
    const w = this.width;
    const h = this.height;
    const peaks = [];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const vVal = this.v[idx];
        if (vVal > 0.28) {
          let isMax = true;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx !== 0 || dy !== 0) {
                if (this.v[this.index(x + dx, y + dy)] > vVal) {
                  isMax = false;
                  break;
                }
              }
            }
            if (!isMax) break;
          }
          if (isMax) {
            peaks.push({ x, y, idx });
          }
        }
      }
    }

    if (peaks.length === 0) {
      return { peakCount: 0, avgPeakU: 0, avgHaloU: 0, avgFarU: 0, depletionRatio: 1.0 };
    }

    let sumPeakU = 0;
    let sumHaloU = 0;
    let haloCount = 0;
    let sumFarU = 0;
    let farCount = 0;

    for (const p of peaks) {
      sumPeakU += this.u[p.idx];
      for (let dy = -8; dy <= 8; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
          const r = Math.hypot(dx, dy);
          const uVal = this.u[this.index(p.x + dx, p.y + dy)];
          if (r >= 2 && r <= 5) {
            sumHaloU += uVal;
            haloCount++;
          } else if (r > 6 && r <= 8) {
            sumFarU += uVal;
            farCount++;
          }
        }
      }
    }

    const avgPeakU = sumPeakU / peaks.length;
    const avgHaloU = haloCount > 0 ? sumHaloU / haloCount : avgPeakU;
    const avgFarU = farCount > 0 ? sumFarU / farCount : avgPeakU;
    const depletionRatio = avgFarU > 0 ? avgHaloU / avgFarU : 1.0;

    return {
      peakCount: peaks.length,
      avgPeakU,
      avgHaloU,
      avgFarU,
      depletionRatio
    };
  }
}

