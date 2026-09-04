// @ts-check

/**
 * @typedef {'graphene' | 'tendril'} SystemMode
 * @typedef {'random' | 'uniform_left' | 'uniform_right' | 'single_perversion' | 'multi_kink'} InitialState
 */

/**
 * 1D Chiral Domain & Torsion Dynamics Simulation
 * Models cooperative conformational switching in helical ladder polymers (graphene nanoribbons)
 * and topological perversion mechanics in biomechanical climbing tendrils.
 */
export class ChiralRibbonSim {
  /**
   * @param {Object} [options]
   * @param {number} [options.N=64] Number of discrete helical segments / [4]helicene monomer units
   * @param {number} [options.J=1.0] Cooperative neighbor coupling constant (steric / elastic stiffness)
   * @param {number} [options.h=0.0] Chiral bias field (chiral solvent beta-pinene concentration or mechanical torque)
   * @param {number} [options.temperature=0.25] Thermal noise / fluctuation level (k_B * T / J)
   * @param {boolean} [options.pinnedEnds=false] Whether ribbon ends are clamped (like tendril anchored at both ends)
   * @param {InitialState} [options.initialState='random'] Initial state configuration
   * @param {number} [options.seed=42] Pseudo-random number generator seed
   */
  constructor(options = {}) {
    this.N = options.N || 64;
    this.J = options.J !== undefined ? options.J : 1.0;
    this.h = options.h !== undefined ? options.h : 0.0;
    this.temperature = options.temperature !== undefined ? options.temperature : 0.25;
    this.pinnedEnds = options.pinnedEnds !== undefined ? options.pinnedEnds : false;
    this.systemMode = /** @type {SystemMode} */ (options.systemMode || 'graphene');
    
    // State arrays:
    // spins: discrete chirality (-1 = left-handed / M, +1 = right-handed / P)
    // angles: continuous twist angle [-pi/2, +pi/2]
    // vel: angular velocities for smooth elastic inertia
    this.spins = new Float64Array(this.N);
    this.angles = new Float64Array(this.N);
    this.vel = new Float64Array(this.N);

    // 3D coordinates of the ribbon spine
    this.pointsX = new Float64Array(this.N);
    this.pointsY = new Float64Array(this.N);
    this.pointsZ = new Float64Array(this.N);

    // Track historical statistics
    this.time = 0;
    this.stepCount = 0;
    this.annihilationEvents = 0;

    // PRNG for deterministic reproducibility
    this._seed = options.seed || 42;
    this.reset(options.initialState || 'random');
  }

  /**
   * Linear Congruential Generator for reproducible pseudo-random numbers
   * @returns {number} Float in [0, 1)
   */
  _random() {
    this._seed = (this._seed * 1664525 + 1013904223) % 4294967296;
    return this._seed / 4294967296;
  }

  /**
   * Resets simulation to a specific configuration
   * @param {InitialState} state
   */
  reset(state = 'random') {
    this.annihilationEvents = 0;
    this.time = 0;
    this.stepCount = 0;

    for (let i = 0; i < this.N; i++) {
      let s = 1;
      if (state === 'random') {
        s = this._random() < 0.5 ? -1 : 1;
      } else if (state === 'uniform_left') {
        s = -1;
      } else if (state === 'uniform_right') {
        s = 1;
      } else if (state === 'single_perversion') {
        s = i < this.N / 2 ? -1 : 1;
      } else if (state === 'multi_kink') {
        const period = Math.max(4, Math.floor(this.N / 4));
        s = Math.floor(i / period) % 2 === 0 ? -1 : 1;
      }

      this.spins[i] = s;
      this.angles[i] = s * (Math.PI / 3);
      this.vel[i] = 0;
    }

    this.update3DGeometry();
  }

  /**
   * Advances the simulation by dt using hybrid Langevin & Monte Carlo Glauber dynamics
   * @param {number} dt Time step
   * @param {number} [mcSteps=4] Monte Carlo sweep sub-steps per frame
   */
  step(dt = 0.05, mcSteps = 4) {
    this.time += dt;
    this.stepCount++;

    const kBT = Math.max(0.001, this.temperature);
    let previousKinks = this.countPerversionKinks();

    // 1. Monte Carlo Glauber / Metropolis updates for discrete chiral bistability
    for (let s = 0; s < mcSteps; s++) {
      for (let i = 0; i < this.N; i++) {
        // If pinned ends, boundary spins cannot flip
        if (this.pinnedEnds && (i === 0 || i === this.N - 1)) {
          continue;
        }

        const leftSpin = i > 0 ? this.spins[i - 1] : (this.pinnedEnds ? this.spins[0] : this.spins[i]);
        const rightSpin = i < this.N - 1 ? this.spins[i + 1] : (this.pinnedEnds ? this.spins[this.N - 1] : this.spins[i]);

        // Hamiltonian: H = -J * sum(s_i * s_j) - h * sum(s_i)
        // Energy change upon flipping s_i -> -s_i:
        // Delta E = 2 * s_i * [ J * (s_{i-1} + s_{i+1}) + h ]
        const localField = this.J * (leftSpin + rightSpin) + this.h;
        const dE = 2 * this.spins[i] * localField;

        // Glauber transition probability: P(flip) = 1 / (1 + exp(dE / k_B T))
        const pFlip = 1.0 / (1.0 + Math.exp(dE / kBT));

        if (this._random() < pFlip) {
          this.spins[i] = -this.spins[i];
        }
      }
    }

    // 2. Overdamped Langevin relaxation for continuous ribbon twist angles
    const damping = 0.35;
    const couplingK = this.J * 2.0;

    for (let i = 0; i < this.N; i++) {
      const targetAngle = this.spins[i] * (Math.PI / 3);
      const angleLeft = i > 0 ? this.angles[i - 1] : this.angles[i];
      const angleRight = i < this.N - 1 ? this.angles[i + 1] : this.angles[i];

      // Elastic curvature & bias torque
      const elasticTorque = couplingK * (angleLeft + angleRight - 2 * this.angles[i]);
      const bistableTorque = (targetAngle - this.angles[i]) * 4.0;
      const biasTorque = this.h * 1.5;

      // Thermal noise on continuous angle
      const thermalForce = (this._random() - 0.5) * 2 * Math.sqrt(kBT) * 0.8;

      const totalTorque = elasticTorque + bistableTorque + biasTorque + thermalForce;
      this.vel[i] = (this.vel[i] + totalTorque * dt) * (1.0 - damping);
      this.angles[i] += this.vel[i] * dt;

      // Clamp angle limits
      if (this.angles[i] > Math.PI / 2) this.angles[i] = Math.PI / 2;
      if (this.angles[i] < -Math.PI / 2) this.angles[i] = -Math.PI / 2;
    }

    const currentKinks = this.countPerversionKinks();
    if (currentKinks < previousKinks) {
      this.annihilationEvents += (previousKinks - currentKinks);
    }

    this.update3DGeometry();
  }

  /**
   * Reconstructs 3D spiral centerline curve from local torsion and curvature
   */
  update3DGeometry() {
    const radius = 26; // Helix radius
    const totalLength = 520; // Length along Z axis
    const dz = totalLength / this.N;

    let cumulativePhase = 0;
    const startZ = -totalLength / 2;

    for (let i = 0; i < this.N; i++) {
      // Local torsion determines the rate of angular winding
      // Right-handed (+angle) winds counter-clockwise, Left-handed (-angle) winds clockwise
      const localTorsion = this.angles[i] * 0.45;
      cumulativePhase += localTorsion;

      const z = startZ + i * dz;
      const x = radius * Math.cos(cumulativePhase);
      const y = radius * Math.sin(cumulativePhase);

      this.pointsX[i] = x;
      this.pointsY[i] = y;
      this.pointsZ[i] = z;
    }
  }

  /**
   * Calculates Enantiomeric Excess (ee): range [-1.0, +1.0]
   * ee = (N_R - N_L) / N
   * @returns {number}
   */
  getEnantiomericExcess() {
    let sum = 0;
    for (let i = 0; i < this.N; i++) {
      sum += this.spins[i];
    }
    return sum / this.N;
  }

  /**
   * Counts the number of chiral domain walls (perversion points / kinks)
   * where adjacent segments have opposite handedness.
   * @returns {number}
   */
  countPerversionKinks() {
    let kinks = 0;
    for (let i = 0; i < this.N - 1; i++) {
      if (this.spins[i] !== this.spins[i + 1]) {
        kinks++;
      }
    }
    return kinks;
  }

  /**
   * Returns positions of all perversion kinks along ribbon index (e.g. 12.5)
   * @returns {number[]}
   */
  getPerversionLocations() {
    const locs = [];
    for (let i = 0; i < this.N - 1; i++) {
      if (this.spins[i] !== this.spins[i + 1]) {
        locs.push(i + 0.5);
      }
    }
    return locs;
  }

  /**
   * Calculates the 1D spatial spin correlation function: C(r) = <s_i * s_{i+r}>
   * @param {number} maxR Maximum separation
   * @returns {Float64Array}
   */
  getSpatialCorrelations(maxR = 20) {
    const rLimit = Math.min(maxR, this.N - 1);
    const corr = new Float64Array(rLimit);
    for (let r = 1; r <= rLimit; r++) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < this.N - r; i++) {
        sum += this.spins[i] * this.spins[i + r];
        count++;
      }
      corr[r - 1] = count > 0 ? sum / count : 0;
    }
    return corr;
  }

  /**
   * Theoretical 1D Ising correlation length: xi = -1 / ln(tanh(J / k_B T))
   * @returns {number}
   */
  getTheoreticalCorrelationLength() {
    const kBT = Math.max(0.001, this.temperature);
    const arg = Math.tanh(this.J / kBT);
    if (arg >= 0.9999999) return 1e6;
    return -1.0 / Math.log(arg);
  }

  /**
   * Non-interacting single-unit thermal expectation: <s_0> = tanh(h / k_B T)
   * Used to calculate the cooperative amplification factor: |<s_chain>| / |<s_0>|
   * @returns {number}
   */
  getSingleUnitExpectation() {
    const kBT = Math.max(0.001, this.temperature);
    return Math.tanh(this.h / kBT);
  }
}
