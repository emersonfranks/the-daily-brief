// @ts-check

/**
 * @typedef {'microbial' | 'astrophysical'} SimMode
 */

/**
 * @typedef {Object} SimConfig
 * @property {number} width Domain width
 * @property {number} height Domain height
 * @property {number} particleCount Total particle count
 * @property {number} quorumRadius Sensing interaction radius Rs
 * @property {number} quorumThreshold Critical local density threshold rho_c
 * @property {number} passiveSpeed Base speed when below threshold (v_slow)
 * @property {number} activeSpeed Blast propulsion speed when above threshold (v_active)
 * @property {number} centralPull Inward gravitational infall / chemotactic drift strength
 * @property {number} localAccretion Mutual peer accretion drift
 * @property {number} noiseStrength Stochastic Brownian thermal noise amplitude
 * @property {number} rotationalDiffusion Headings tumble rate (Dr)
 * @property {number} repulsionRadius Soft-core collision exclusion radius
 * @property {number} repulsionStrength Soft-core repulsion magnitude
 * @property {boolean} periodicBoundary Whether boundaries wrap or reflect
 * @property {SimMode} mode The physical interpretation mode
 * @property {number} seed Random seed for deterministic runs
 */

/**
 * @typedef {Object} Particle
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} angle
 * @property {number} density Local density count within Rs
 * @property {number} activeLevel 0 (passive/cold) to 1 (fully active blast)
 * @property {number} gradX Local density gradient X
 * @property {number} gradY Local density gradient Y
 */

/**
 * @typedef {Object} SimSnapshot
 * @property {number} step
 * @property {number} time
 * @property {number} activeCount Count of particles in active blast state
 * @property {number} activeFraction Fraction of active particles
 * @property {number} meanSpeed Mean particle speed
 * @property {number} coreDensity Density inside central cluster core
 * @property {number} rimDensity Density at surrounding annular shock rim
 * @property {number} cavitationRatio Ratio of rim density to core density
 * @property {number} spatialClustering Mean squared radial distance
 * @property {number[]} radialProfile Binned radial particle density
 * @property {string} phaseName Dynamical regime classification
 */

export class DensityMotilitySim {
  /**
   * @param {Partial<SimConfig>} [customConfig]
   */
  constructor(customConfig = {}) {
    /** @type {SimConfig} */
    this.config = {
      width: 400,
      height: 400,
      particleCount: 400,
      quorumRadius: 28,
      quorumThreshold: 6.0,
      passiveSpeed: 0.25,
      activeSpeed: 4.6,
      centralPull: 0.018,
      localAccretion: 0.25,
      noiseStrength: 0.25,
      rotationalDiffusion: 0.1,
      repulsionRadius: 5.5,
      repulsionStrength: 1.6,
      periodicBoundary: false,
      mode: 'microbial',
      seed: 42,
      ...customConfig,
    };

    this.stepCount = 0;
    this.time = 0.0;
    this.dt = 0.2;

    /** @type {Particle[]} */
    this.particles = [];

    /** @type {number} */
    this.rngState = this.config.seed;

    /** @type {number[]} Historical core density values for breathing rhythm analysis */
    this.coreDensityHistory = [];

    this.init();
  }

  /**
   * Deterministic PRNG (Mulberry32)
   * @returns {number} Float in [0, 1)
   */
  random() {
    this.rngState |= 0;
    this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(this.rngState ^ (this.rngState >>> 15), 1 | this.rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Gaussian random variable via Box-Muller
   * @returns {number}
   */
  randomGaussian() {
    const u1 = Math.max(1e-15, this.random());
    const u2 = this.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Initialize or reset particles
   * @param {number} [seed]
   */
  init(seed) {
    if (typeof seed === 'number') {
      this.config.seed = seed;
      this.rngState = seed;
    }
    this.stepCount = 0;
    this.time = 0.0;
    this.coreDensityHistory = [];
    this.particles = [];

    const cx = this.config.width / 2;
    const cy = this.config.height / 2;

    for (let i = 0; i < this.config.particleCount; i++) {
      let x, y;
      if (i < this.config.particleCount * 0.75) {
        // Initial dense cluster centered in the trap
        const rad = Math.abs(this.randomGaussian()) * (this.config.width * 0.11);
        const theta = this.random() * Math.PI * 2;
        x = cx + rad * Math.cos(theta);
        y = cy + rad * Math.sin(theta);
      } else {
        // Diffuse ambient medium
        const rad = (0.2 + 0.3 * this.random()) * this.config.width;
        const theta = this.random() * Math.PI * 2;
        x = cx + rad * Math.cos(theta);
        y = cy + rad * Math.sin(theta);
      }

      x = Math.max(10, Math.min(this.config.width - 10, x));
      y = Math.max(10, Math.min(this.config.height - 10, y));

      const angle = this.random() * Math.PI * 2;
      this.particles.push({
        id: i,
        x,
        y,
        vx: Math.cos(angle) * this.config.passiveSpeed,
        vy: Math.sin(angle) * this.config.passiveSpeed,
        angle,
        density: 0,
        activeLevel: 0,
        gradX: 0,
        gradY: 0,
      });
    }

    this.computeDensityFields();
  }

  /**
   * Calculate local quorum density and density gradients for each particle
   */
  computeDensityFields() {
    const { width, height, quorumRadius, periodicBoundary, quorumThreshold } = this.config;
    const rs2 = quorumRadius * quorumRadius;
    const n = this.particles.length;

    for (let i = 0; i < n; i++) {
      this.particles[i].density = 0;
      this.particles[i].gradX = 0;
      this.particles[i].gradY = 0;
    }

    for (let i = 0; i < n; i++) {
      const pi = this.particles[i];
      for (let j = i + 1; j < n; j++) {
        const pj = this.particles[j];
        let dx = pj.x - pi.x;
        let dy = pj.y - pi.y;

        if (periodicBoundary) {
          if (dx > width / 2) dx -= width;
          else if (dx < -width / 2) dx += width;
          if (dy > height / 2) dy -= height;
          else if (dy < -height / 2) dy += height;
        }

        const d2 = dx * dx + dy * dy;
        if (d2 < rs2 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const weight = 1.0 - d / quorumRadius;
          const kernel = weight * weight;

          pi.density += kernel;
          pj.density += kernel;

          const g = (2.0 * weight) / (quorumRadius * d);
          pi.gradX += dx * g;
          pi.gradY += dy * g;
          pj.gradX -= dx * g;
          pj.gradY -= dy * g;
        }
      }
    }

    for (let i = 0; i < n; i++) {
      const p = this.particles[i];
      const delta = p.density - quorumThreshold;
      p.activeLevel = 1.0 / (1.0 + Math.exp(-2.2 * delta));
    }
  }

  /**
   * Advance simulation by one time step
   */
  step() {
    this.stepCount++;
    this.time += this.dt;

    this.computeDensityFields();

    const {
      width,
      height,
      passiveSpeed,
      activeSpeed,
      centralPull,
      localAccretion,
      noiseStrength,
      rotationalDiffusion,
      repulsionRadius,
      repulsionStrength,
      periodicBoundary,
    } = this.config;

    const rep2 = repulsionRadius * repulsionRadius;
    const cx = width / 2;
    const cy = height / 2;
    const n = this.particles.length;

    /** @type {{ fx: number, fy: number }[]} */
    const forces = [];
    for (let i = 0; i < n; i++) {
      forces.push({ fx: 0, fy: 0 });
    }

    // Pairwise steric repulsion
    for (let i = 0; i < n; i++) {
      const pi = this.particles[i];
      for (let j = i + 1; j < n; j++) {
        const pj = this.particles[j];
        let dx = pj.x - pi.x;
        let dy = pj.y - pi.y;

        if (periodicBoundary) {
          if (dx > width / 2) dx -= width;
          else if (dx < -width / 2) dx += width;
          if (dy > height / 2) dy -= height;
          else if (dy < -height / 2) dy += height;
        }

        const d2 = dx * dx + dy * dy;
        if (d2 < rep2 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const repForce = (repulsionStrength * (1.0 - d / repulsionRadius)) / d;
          forces[i].fx -= dx * repForce;
          forces[i].fy -= dy * repForce;
          forces[j].fx += dx * repForce;
          forces[j].fy += dy * repForce;
        }
      }
    }

    for (let i = 0; i < n; i++) {
      const p = this.particles[i];

      // Tumble / rotational diffusion
      p.angle += Math.sqrt(2.0 * rotationalDiffusion * this.dt) * this.randomGaussian();

      const ux = Math.cos(p.angle);
      const uy = Math.sin(p.angle);

      // Explosive blast direction: driven outward down the density gradient (-grad)
      const gradNorm2 = p.gradX * p.gradX + p.gradY * p.gradY;
      let blastX = ux;
      let blastY = uy;
      if (gradNorm2 > 1e-4) {
        const invGrad = 1.0 / Math.sqrt(gradNorm2);
        blastX = -p.gradX * invGrad;
        blastY = -p.gradY * invGrad;
      }

      // Local accretion towards peers (+grad) when passive
      let peerAccX = 0;
      let peerAccY = 0;
      if (gradNorm2 > 1e-4) {
        const invGrad = 1.0 / Math.sqrt(gradNorm2);
        peerAccX = p.gradX * invGrad * localAccretion * (1.0 - p.activeLevel);
        peerAccY = p.gradY * invGrad * localAccretion * (1.0 - p.activeLevel);
      }

      // Inward central gravitational / chemotactic pull towards center
      const toCenterX = cx - p.x;
      const toCenterY = cy - p.y;
      const distCenter = Math.hypot(toCenterX, toCenterY);
      let pullX = 0;
      let pullY = 0;
      if (distCenter > 1.0) {
        pullX = (toCenterX / distCenter) * centralPull * distCenter * (1.0 - 0.7 * p.activeLevel);
        pullY = (toCenterY / distCenter) * centralPull * distCenter * (1.0 - 0.7 * p.activeLevel);
      }

      // Active vs passive self-propulsion velocities
      const activeVx = blastX * activeSpeed;
      const activeVy = blastY * activeSpeed;

      const passiveVx = ux * passiveSpeed;
      const passiveVy = uy * passiveSpeed;

      const driveVx = (1.0 - p.activeLevel) * passiveVx + p.activeLevel * activeVx;
      const driveVy = (1.0 - p.activeLevel) * passiveVy + p.activeLevel * activeVy;

      // Thermal stochastic noise
      const noiseX = Math.sqrt(2.0 * noiseStrength * this.dt) * this.randomGaussian();
      const noiseY = Math.sqrt(2.0 * noiseStrength * this.dt) * this.randomGaussian();

      // Velocity update
      p.vx = driveVx + peerAccX + pullX + forces[i].fx;
      p.vy = driveVy + peerAccY + pullY + forces[i].fy;

      p.x += p.vx * this.dt + noiseX;
      p.y += p.vy * this.dt + noiseY;

      // Boundaries
      if (periodicBoundary) {
        p.x = ((p.x % width) + width) % width;
        p.y = ((p.y % height) + height) % height;
      } else {
        const pad = 8;
        if (p.x < pad) { p.x = pad; p.vx = Math.abs(p.vx); }
        if (p.x > width - pad) { p.x = width - pad; p.vx = -Math.abs(p.vx); }
        if (p.y < pad) { p.y = pad; p.vy = Math.abs(p.vy); }
        if (p.y > height - pad) { p.y = height - pad; p.vy = -Math.abs(p.vy); }
      }
    }

    const snap = this.getSnapshot();
    this.coreDensityHistory.push(snap.coreDensity);
    if (this.coreDensityHistory.length > 250) {
      this.coreDensityHistory.shift();
    }
  }

  /**
   * Compute comprehensive simulation metrics and snapshot
   * @returns {SimSnapshot}
   */
  getSnapshot() {
    const cx = this.config.width / 2;
    const cy = this.config.height / 2;
    const n = this.particles.length;

    let activeCount = 0;
    let totalSpeed = 0;

    const binCount = 12;
    const maxRadius = Math.min(cx, cy);
    const binWidth = maxRadius / binCount;
    const radialProfile = new Array(binCount).fill(0);

    let coreParticles = 0;
    let rimParticles = 0;
    const coreRadius = maxRadius * 0.25;
    const rimInner = maxRadius * 0.35;
    const rimOuter = maxRadius * 0.7;

    let sumR2 = 0;

    for (let i = 0; i < n; i++) {
      const p = this.particles[i];
      if (p.activeLevel > 0.5) {
        activeCount++;
      }
      const spd = Math.hypot(p.vx, p.vy);
      totalSpeed += spd;

      const dx = p.x - cx;
      const dy = p.y - cy;
      const r = Math.hypot(dx, dy);
      sumR2 += r * r;

      const binIndex = Math.min(binCount - 1, Math.floor(r / binWidth));
      radialProfile[binIndex]++;

      if (r <= coreRadius) {
        coreParticles++;
      } else if (r >= rimInner && r <= rimOuter) {
        rimParticles++;
      }
    }

    // Normalize radial profile by ring area
    for (let b = 0; b < binCount; b++) {
      const rInner = b * binWidth;
      const rOuter = (b + 1) * binWidth;
      const area = Math.PI * (rOuter * rOuter - rInner * rInner);
      radialProfile[b] = radialProfile[b] / (area + 1e-4);
    }

    const coreArea = Math.PI * coreRadius * coreRadius;
    const rimArea = Math.PI * (rimOuter * rimOuter - rimInner * rimInner);
    const coreDensity = coreParticles / (coreArea + 1e-4);
    const rimDensity = rimParticles / (rimArea + 1e-4);
    const cavitationRatio = rimDensity / (coreDensity + 1e-5);
    const spatialClustering = Math.sqrt(sumR2 / n);

    let phaseName = 'Subcritical Condensation';
    if (activeCount > n * 0.15) {
      phaseName = 'Supercritical Blast Cavitation';
    } else if (cavitationRatio > 0.25) {
      phaseName = 'Annular Shock Shell';
    }

    return {
      step: this.stepCount,
      time: this.time,
      activeCount,
      activeFraction: activeCount / n,
      meanSpeed: totalSpeed / n,
      coreDensity,
      rimDensity,
      cavitationRatio,
      spatialClustering,
      radialProfile,
      phaseName,
    };
  }

  /**
   * Calculate oscillation/breathing peak power from core density history
   * @returns {{ period: number, amplitude: number, hasOscillation: boolean, cycleCount: number }}
   */
  getBreathingMetrics() {
    if (this.coreDensityHistory.length < 60) {
      return { period: 0, amplitude: 0, hasOscillation: false, cycleCount: 0 };
    }

    const data = this.coreDensityHistory;
    let peaks = 0;
    let troughs = 0;

    for (let i = 2; i < data.length - 2; i++) {
      if (
        data[i] > data[i - 1] &&
        data[i] > data[i - 2] &&
        data[i] > data[i + 1] &&
        data[i] > data[i + 2]
      ) {
        peaks++;
      }
      if (
        data[i] < data[i - 1] &&
        data[i] < data[i - 2] &&
        data[i] < data[i + 1] &&
        data[i] < data[i + 2]
      ) {
        troughs++;
      }
    }

    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const norm = data.map((v) => v - mean);

    const maxLag = Math.floor(data.length / 2);
    let var0 = 0;
    for (let i = 0; i < norm.length; i++) {
      var0 += norm[i] * norm[i];
    }
    if (var0 < 1e-7) {
      return { period: 0, amplitude: 0, hasOscillation: false, cycleCount: 0 };
    }

    /** @type {number[]} */
    const autoCorr = [];
    for (let lag = 0; lag < maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < norm.length - lag; i++) {
        sum += norm[i] * norm[i + lag];
      }
      autoCorr.push(sum / var0);
    }

    let passedTrough = false;
    let peakLag = 0;
    let peakVal = -1;

    for (let lag = 1; lag < autoCorr.length - 1; lag++) {
      if (!passedTrough && autoCorr[lag] < autoCorr[lag - 1] && autoCorr[lag] < autoCorr[lag + 1]) {
        passedTrough = true;
      }
      if (passedTrough && autoCorr[lag] > autoCorr[lag - 1] && autoCorr[lag] > autoCorr[lag + 1]) {
        if (autoCorr[lag] > peakVal) {
          peakVal = autoCorr[lag];
          peakLag = lag;
        }
      }
    }

    const hasOscillation = peaks >= 1 && troughs >= 1;
    return {
      period: peakLag * this.dt,
      amplitude: Math.max(0, peakVal),
      hasOscillation,
      cycleCount: Math.min(peaks, troughs),
    };
  }
}

