// @ts-check

/**
 * @fileoverview Domain simulation module for nonreciprocal active matter and ecological pursuit dynamics.
 * Pure mathematical engine: zero DOM, zero external dependencies, fully headless-testable.
 */

/**
 * @typedef {Object} Particle
 * @property {number} id - Unique identifier
 * @property {number} type - 0 for Chaser/Species A (colloid A / predator), 1 for Target/Species B (colloid B / prey)
 * @property {number} x - X coordinate [0, width]
 * @property {number} y - Y coordinate [0, height]
 * @property {number} vx - Velocity X
 * @property {number} vy - Velocity Y
 * @property {number} radius - Particle interaction radius
 * @property {number} clusterId - ID of cluster particle belongs to
 */

/**
 * @typedef {Object} SimConfig
 * @property {number} width - Domain width (periodic boundaries)
 * @property {number} height - Domain height (periodic boundaries)
 * @property {number} numA - Number of Species A particles (Chasers / Small colloids / Predators)
 * @property {number} numB - Number of Species B particles (Targets / Large colloids / Prey)
 * @property {number} selfRepulsion - Like-species repulsion strength (AA, BB)
 * @property {number} attractionAB - Force of A attracted to B (> 0 attracts A towards B)
 * @property {number} repulsionBA - Force of B repelled by A (> 0 pushes B away from A; < 0 attracts B to A)
 * @property {number} drag - Viscous damping coefficient
 * @property {number} noise - Thermal / Brownian fluctuation amplitude
 * @property {number} interactionRange - Interaction cutoff radius
 * @property {number} dt - Time step size
 */

/**
 * @typedef {Object} SimMetrics
 * @property {number} step - Current step count
 * @property {number} time - Elapsed simulation time
 * @property {number} nonreciprocity - Nonreciprocity parameter Delta = (F_AB + F_BA) asymmetry
 * @property {number} meanSpeed - Average particle velocity magnitude
 * @property {number} netMomentum - Magnitude of center-of-mass momentum (sum of v / N)
 * @property {number} maxClusterFraction - Size of largest cluster / total particles
 * @property {number} clusterCount - Total number of detected coherent clusters
 * @property {number} fissionRate - Cluster fission/splitting events per 100 steps
 * @property {number} spatialEntropy - Shannon entropy of spatial 2D grid binning
 * @property {number} chasePairCount - Number of actively coupled AB chasing pairs
 */

export class NonreciprocalSimulation {
  /**
   * @param {Partial<SimConfig>} [customConfig]
   */
  constructor(customConfig = {}) {
    /** @type {SimConfig} */
    this.config = {
      width: 400,
      height: 400,
      numA: 150,
      numB: 150,
      selfRepulsion: 1.2,
      attractionAB: 2.5,  // A chases B
      repulsionBA: 2.0,   // B flees A (when > 0, nonreciprocal broken symmetry)
      drag: 0.15,
      noise: 0.2,
      interactionRange: 45,
      dt: 0.25,
      ...customConfig
    };

    /** @type {Particle[]} */
    this.particles = [];
    /** @type {number} */
    this.stepCount = 0;
    /** @type {number} */
    this.fissionEvents = 0;
    /** @type {number[]} */
    this.previousClusterSizes = [];

    this.reset();
  }

  /**
   * Initialize or reset particles with reproducible or randomized positions.
   * @param {number} [seed] - Optional pseudo-random seed
   */
  reset(seed) {
    this.particles = [];
    this.stepCount = 0;
    this.fissionEvents = 0;
    this.previousClusterSizes = [];

    let rng = seed !== undefined ? this._createSeededRNG(seed) : Math.random;

    const total = this.config.numA + this.config.numB;
    for (let i = 0; i < total; i++) {
      const isA = i < this.config.numA;
      this.particles.push({
        id: i,
        type: isA ? 0 : 1,
        x: rng() * this.config.width,
        y: rng() * this.config.height,
        vx: (rng() - 0.5) * 0.5,
        vy: (rng() - 0.5) * 0.5,
        radius: isA ? 3.5 : 5.0,
        clusterId: -1
      });
    }
  }

  /**
   * Simple Mulberry32 seeded PRNG for deterministic tests.
   * @param {number} a
   * @returns {() => number}
   */
  _createSeededRNG(a) {
    return () => {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Set the nonreciprocity asymmetry parameter.
   * @param {number} asymmetry - 0 for reciprocal equilibrium (A attracts B, B attracts A), 1 for full nonreciprocal chase
   */
  setAsymmetry(asymmetry) {
    // When asymmetry = 0: attractionAB = 2.0, repulsionBA = -2.0 (i.e. Mutual attraction F_AB = -F_BA)
    // When asymmetry = 1: attractionAB = 3.0, repulsionBA = 2.5 (A chases B, B flees A)
    const base = 2.0;
    if (asymmetry <= 0.05) {
      this.config.attractionAB = base;
      this.config.repulsionBA = -base; // Symmetric mutual attraction
    } else {
      this.config.attractionAB = base + asymmetry * 1.5;
      this.config.repulsionBA = -base + asymmetry * (base + 2.2);
    }
  }

  /**
   * Advance simulation by one discrete time step.
   * Integrates overdamped Langevin dynamics with nonreciprocal inter-particle forces.
   */
  step() {
    const { width, height, interactionRange, drag, noise, dt, selfRepulsion, attractionAB, repulsionBA } = this.config;
    const n = this.particles.length;
    const rCutSq = interactionRange * interactionRange;

    // Forces accumulation array
    const fx = new Float64Array(n);
    const fy = new Float64Array(n);

    // Spatial pair interactions with periodic minimum image convention
    for (let i = 0; i < n; i++) {
      const p1 = this.particles[i];

      for (let j = i + 1; j < n; j++) {
        const p2 = this.particles[j];

        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;

        // Periodic boundary wrap
        if (dx > width * 0.5) dx -= width;
        if (dx < -width * 0.5) dx += width;
        if (dy > height * 0.5) dy -= height;
        if (dy < -height * 0.5) dy += height;

        const distSq = dx * dx + dy * dy;
        if (distSq > rCutSq || distSq < 0.0001) continue;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        // Core short-range steric repulsion for all pairs to prevent singularity
        const coreDistance = p1.radius + p2.radius;
        if (dist < coreDistance) {
          const coreRepulsion = 15.0 * (1.0 - dist / coreDistance);
          fx[i] -= coreRepulsion * nx;
          fy[i] -= coreRepulsion * ny;
          fx[j] += coreRepulsion * nx;
          fy[j] += coreRepulsion * ny;
        }

        if (p1.type === p2.type) {
          // Like-species interactions: soft repulsion / volume exclusion
          const fLike = selfRepulsion * Math.max(0, 1.0 - dist / (interactionRange * 0.6));
          fx[i] -= fLike * nx;
          fy[i] -= fLike * ny;
          fx[j] += fLike * nx;
          fy[j] += fLike * ny;
        } else {
          // Cross-species interactions (A and B): NONRECIPROCAL!
          // p1 is A, p2 is B (or vice-versa)
          const isP1A = p1.type === 0;
          const distFactor = Math.sin((Math.PI * dist) / interactionRange);

          if (isP1A) {
            // p1 is A (Chaser), p2 is B (Target)
            // Force on A towards B: +attractionAB * nx
            const fA = attractionAB * distFactor;
            fx[i] += fA * nx;
            fy[i] += fA * ny;

            // Force on B from A: +repulsionBA * nx (pushes B along vector from A to B)
            const fB = repulsionBA * distFactor;
            fx[j] += fB * nx;
            fy[j] += fB * ny;
          } else {
            // p1 is B (Target), p2 is A (Chaser)
            // Force on A (p2) towards B (p1): -attractionAB * nx
            const fA = attractionAB * distFactor;
            fx[j] -= fA * nx;
            fy[j] -= fA * ny;

            // Force on B (p1) from A (p2): -repulsionBA * nx
            const fB = repulsionBA * distFactor;
            fx[i] -= fB * nx;
            fy[i] -= fB * ny;
          }
        }
      }
    }

    // Velocity update and position integration
    for (let i = 0; i < n; i++) {
      const p = this.particles[i];

      // Thermal noise
      const randAngle = Math.random() * Math.PI * 2;
      const randMag = noise * Math.sqrt(dt);
      const thermalX = Math.cos(randAngle) * randMag;
      const thermalY = Math.sin(randAngle) * randMag;

      // Overdamped velocity: v = (Force / gamma) + noise
      p.vx = (fx[i] * dt) / drag + thermalX;
      p.vy = (fy[i] * dt) / drag + thermalY;

      // Cap max speed for numerical stability
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const maxSpeed = 12.0;
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Periodic boundaries
      if (p.x < 0) p.x += width;
      if (p.x >= width) p.x -= width;
      if (p.y < 0) p.y += height;
      if (p.y >= height) p.y -= height;
    }

    this.stepCount++;
  }

  /**
   * Run cluster detection (DBSCAN / connected components) and compute macroscopic metrics.
   * @returns {SimMetrics}
   */
  computeMetrics() {
    const { width, height } = this.config;
    const n = this.particles.length;
    const clusterDistThreshold = 22.0;
    const clusterDistSq = clusterDistThreshold * clusterDistThreshold;

    // Reset cluster assignments
    for (let i = 0; i < n; i++) {
      this.particles[i].clusterId = -1;
    }

    let currentClusterId = 0;
    /** @type {number[][]} */
    const clusters = [];

    // Connected components clustering
    for (let i = 0; i < n; i++) {
      if (this.particles[i].clusterId !== -1) continue;

      /** @type {number[]} */
      const clusterMembers = [i];
      this.particles[i].clusterId = currentClusterId;
      const queue = [i];

      while (queue.length > 0) {
        const currIdx = queue.shift();
        if (currIdx === undefined) break;
        const pCurr = this.particles[currIdx];

        for (let j = 0; j < n; j++) {
          if (this.particles[j].clusterId !== -1) continue;
          const pOther = this.particles[j];

          let dx = Math.abs(pOther.x - pCurr.x);
          let dy = Math.abs(pOther.y - pCurr.y);
          if (dx > width * 0.5) dx = width - dx;
          if (dy > height * 0.5) dy = height - dy;

          if (dx * dx + dy * dy < clusterDistSq) {
            this.particles[j].clusterId = currentClusterId;
            clusterMembers.push(j);
            queue.push(j);
          }
        }
      }

      if (clusterMembers.length >= 3) {
        clusters.push(clusterMembers);
        currentClusterId++;
      } else {
        // Unmark tiny isolated pairs
        for (const idx of clusterMembers) {
          this.particles[idx].clusterId = -1;
        }
      }
    }

    // Measure metrics
    let totalSpeed = 0;
    let sumVx = 0;
    let sumVy = 0;
    let chasePairCount = 0;

    for (let i = 0; i < n; i++) {
      const p = this.particles[i];
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      totalSpeed += speed;
      sumVx += p.vx;
      sumVy += p.vy;

      if (p.type === 0) {
        // Check if A is closely following a B
        for (let j = 0; j < n; j++) {
          if (this.particles[j].type === 1) {
            let dx = this.particles[j].x - p.x;
            let dy = this.particles[j].y - p.y;
            if (dx > width * 0.5) dx -= width;
            if (dx < -width * 0.5) dx += width;
            if (dy > height * 0.5) dy -= height;
            if (dy < -height * 0.5) dy += height;
            if (dx * dx + dy * dy < 25.0 * 25.0) {
              chasePairCount++;
              break;
            }
          }
        }
      }
    }

    const meanSpeed = totalSpeed / (n || 1);
    const netMomentum = Math.sqrt(sumVx * sumVx + sumVy * sumVy) / (n || 1);

    const clusterSizes = clusters.map(c => c.length).sort((a, b) => b - a);
    const maxClusterSize = clusterSizes.length > 0 ? clusterSizes[0] : 0;
    const maxClusterFraction = maxClusterSize / (n || 1);

    // Track cluster fission events
    if (this.previousClusterSizes.length > 0) {
      if (clusters.length > this.previousClusterSizes.length) {
        this.fissionEvents += (clusters.length - this.previousClusterSizes.length);
      }
    }
    this.previousClusterSizes = clusterSizes;

    // Spatial Shannon entropy over an 8x8 grid
    const gridSize = 8;
    const grid = new Int32Array(gridSize * gridSize);
    const cellW = width / gridSize;
    const cellH = height / gridSize;
    for (let i = 0; i < n; i++) {
      const gx = Math.min(gridSize - 1, Math.floor(this.particles[i].x / cellW));
      const gy = Math.min(gridSize - 1, Math.floor(this.particles[i].y / cellH));
      grid[gy * gridSize + gx]++;
    }
    let entropy = 0;
    for (let g = 0; g < grid.length; g++) {
      if (grid[g] > 0) {
        const prob = grid[g] / n;
        entropy -= prob * Math.log2(prob);
      }
    }

    // Normalized nonreciprocity asymmetry
    const asymmetry = (this.config.attractionAB + this.config.repulsionBA);

    return {
      step: this.stepCount,
      time: this.stepCount * this.config.dt,
      nonreciprocity: asymmetry,
      meanSpeed,
      netMomentum,
      maxClusterFraction,
      clusterCount: clusters.length,
      fissionRate: this.fissionEvents,
      spatialEntropy: entropy,
      chasePairCount
    };
  }
}
