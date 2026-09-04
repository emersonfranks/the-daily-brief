// @ts-check

/**
 * @fileoverview Ecological Cross-Taxis Predator-Prey Dual Model.
 * Represents spatial cross-diffusion PDEs where nonreciprocal interaction (predator attraction + prey evasion)
 * halts catastrophic extinction/collapse and produces traveling pursuit spirals.
 * Pure math domain module: no DOM, headless testable.
 */

/**
 * @typedef {Object} EcoMetrics
 * @property {number} step - Step count
 * @property {number} preyTotal - Total prey biomass
 * @property {number} predatorTotal - Total predator biomass
 * @property {number} preyHomogeneity - Spatial homogeneity index (1 = collapsed uniform, 0 = rich spatial patterning)
 * @property {number} waveActivity - Mean spatial gradient / pursuit wave intensity
 * @property {boolean} isExtinct - Whether either species went extinct
 */

export class EcologicalDualSimulation {
  /**
   * @param {number} [gridN=64] - Grid resolution (N x N)
   */
  constructor(gridN = 64) {
    this.N = gridN;
    this.prey = new Float64Array(gridN * gridN);
    this.predator = new Float64Array(gridN * gridN);

    // Buffers for PDE finite difference updates
    this.nextPrey = new Float64Array(gridN * gridN);
    this.nextPredator = new Float64Array(gridN * gridN);

    // Model parameters
    this.params = {
      growthPrey: 1.0,
      carryingCapacity: 1.0,
      predationRate: 1.5,
      predatorMortality: 0.4,
      predatorEfficiency: 0.85,
      diffPrey: 0.02,
      diffPred: 0.02,
      taxisPreyEvasion: 0.6, // Nonreciprocal evasion: prey flees predator gradient
      taxisPredPursuit: 0.8, // Nonreciprocal pursuit: predator climbs prey gradient
      dt: 0.08
    };

    this.stepCount = 0;
    this.reset();
  }

  /**
   * Initialize grid with localized perturbations.
   * @param {number} [seed=42]
   */
  reset(seed = 42) {
    this.stepCount = 0;
    const N = this.N;

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const idx = y * N + x;
        // Base steady-state equilibrium plus small localized spatial noise
        const dx = (x - N * 0.5) / (N * 0.25);
        const dy = (y - N * 0.5) / (N * 0.25);
        const bump = Math.exp(-(dx * dx + dy * dy));

        this.prey[idx] = 0.5 + 0.3 * bump + 0.05 * Math.sin(x * 0.3) * Math.cos(y * 0.3);
        this.predator[idx] = 0.3 + 0.2 * bump + 0.05 * Math.cos(x * 0.2) * Math.sin(y * 0.4);
      }
    }
  }

  /**
   * Step the spatial reaction-diffusion-taxis PDE forward in time.
   */
  step() {
    const N = this.N;
    const {
      growthPrey, carryingCapacity, predationRate,
      predatorMortality, predatorEfficiency,
      diffPrey, diffPred, taxisPreyEvasion, taxisPredPursuit, dt
    } = this.params;

    for (let y = 0; y < N; y++) {
      const ym = (y - 1 + N) % N;
      const yp = (y + 1) % N;

      for (let x = 0; x < N; x++) {
        const xm = (x - 1 + N) % N;
        const xp = (x + 1) % N;

        const idx = y * N + x;
        const u = this.prey[idx];
        const v = this.predator[idx];

        // 5-point discrete Laplacian
        const lapU = this.prey[y * N + xp] + this.prey[y * N + xm] + this.prey[yp * N + x] + this.prey[ym * N + x] - 4 * u;
        const lapV = this.predator[y * N + xp] + this.predator[y * N + xm] + this.predator[yp * N + x] + this.predator[ym * N + x] - 4 * v;

        // Central difference gradients for nonreciprocal cross-taxis flux
        const gradUx = 0.5 * (this.prey[y * N + xp] - this.prey[y * N + xm]);
        const gradUy = 0.5 * (this.prey[yp * N + x] - this.prey[ym * N + x]);
        const gradVx = 0.5 * (this.predator[y * N + xp] - this.predator[y * N + xm]);
        const gradVy = 0.5 * (this.predator[yp * N + x] - this.predator[ym * N + x]);

        // Nonreciprocal cross-advection / taxis terms:
        // Prey evades predator: - div( u * (-taxisPreyEvasion * gradV) ) -> approx taxisPreyEvasion * (gradU.gradV + u*lapV)
        const taxisPreyFlux = taxisPreyEvasion * (gradUx * gradVx + gradUy * gradVy + u * lapV);
        // Predator pursues prey: - div( v * (+taxisPredPursuit * gradU) ) -> approx -taxisPredPursuit * (gradV.gradU + v*lapU)
        const taxisPredFlux = -taxisPredPursuit * (gradVx * gradUx + gradVy * gradUy + v * lapU);

        // Local Lotka-Volterra reaction dynamics
        const reactionU = growthPrey * u * (1.0 - u / carryingCapacity) - (predationRate * u * v) / (1.0 + 0.5 * u);
        const reactionV = (predatorEfficiency * predationRate * u * v) / (1.0 + 0.5 * u) - predatorMortality * v;

        // Time integration with nonreciprocal advection
        let nextU = u + dt * (reactionU + diffPrey * lapU + taxisPreyFlux);
        let nextV = v + dt * (reactionV + diffPred * lapV + taxisPredFlux);

        // Physical positivity bounds
        if (nextU < 0) nextU = 0;
        if (nextV < 0) nextV = 0;
        if (nextU > 2.5) nextU = 2.5;
        if (nextV > 2.5) nextV = 2.5;

        this.nextPrey[idx] = nextU;
        this.nextPredator[idx] = nextV;
      }
    }

    // Swap buffers
    const tempU = this.prey;
    this.prey = this.nextPrey;
    this.nextPrey = tempU;

    const tempV = this.predator;
    this.predator = this.nextPredator;
    this.nextPredator = tempV;

    this.stepCount++;
  }

  /**
   * @returns {EcoMetrics}
   */
  computeMetrics() {
    const N = this.N;
    const totalCells = N * N;
    let sumU = 0;
    let sumV = 0;
    let sumGradSq = 0;

    for (let y = 0; y < N; y++) {
      const yp = (y + 1) % N;
      for (let x = 0; x < N; x++) {
        const xp = (x + 1) % N;
        const idx = y * N + x;
        const u = this.prey[idx];
        const v = this.predator[idx];

        sumU += u;
        sumV += v;

        const du = this.prey[y * N + xp] - u;
        const dv = this.predator[yp * N + x] - v;
        sumGradSq += (du * du + dv * dv);
      }
    }

    const meanU = sumU / totalCells;
    const meanV = sumV / totalCells;

    // Variance for spatial heterogeneity
    let varU = 0;
    for (let i = 0; i < totalCells; i++) {
      const diff = this.prey[i] - meanU;
      varU += diff * diff;
    }
    const spatialVariance = varU / totalCells;

    return {
      step: this.stepCount,
      preyTotal: sumU,
      predatorTotal: sumV,
      preyHomogeneity: Math.max(0, 1.0 - Math.sqrt(spatialVariance) * 2.5),
      waveActivity: sumGradSq / totalCells,
      isExtinct: sumU < 0.01 || sumV < 0.01
    };
  }
}
