// @ts-check

/**
 * @typedef {Object} Oscillator
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} theta
 * @property {number} naturalFrequency
 * @property {number} instantaneousFrequency
 * @property {number} phaseVelocity
 */

/**
 * @typedef {Object} NetworkLink
 * @property {number} source
 * @property {number} target
 * @property {number} weight
 * @property {number} powerFlow
 */

/**
 * @typedef {Object} SimulationConfig
 * @property {number} oscillatorCount
 * @property {number} couplingStrength
 * @property {number} frequencySpread
 * @property {number} baseFrequency
 * @property {number} timeStep
 * @property {string} topology
 * @property {number} seed
 */

/**
 * @typedef {Object} SimulationMetrics
 * @property {number} orderParameter
 * @property {number} meanPhase
 * @property {number} frequencyVariance
 * @property {number} lockedFraction
 * @property {number} averagePowerFlow
 * @property {number} simulationTime
 */

export class KuramotoModel {
  /**
   * @param {Partial<SimulationConfig>} [config]
   */
  constructor(config = {}) {
    this.count = config.oscillatorCount ?? 48;
    this.coupling = config.couplingStrength ?? 2.5;
    this.spread = config.frequencySpread ?? 0.8;
    this.baseFreq = config.baseFrequency ?? 2.0;
    this.dt = config.timeStep ?? 0.02;
    this.topology = config.topology ?? 'all-to-all';
    this.seed = config.seed ?? 42;

    this.time = 0;
    this.randomState = this.seed;

    /** @type {Oscillator[]} */
    this.oscillators = [];
    /** @type {NetworkLink[]} */
    this.links = [];
    /** @type {number[][]} */
    this.adjacency = [];

    this.init();
  }

  nextRandom() {
    this.randomState = (this.randomState * 1664525 + 1013904223) % 4294967296;
    return this.randomState / 4294967296;
  }

  nextGaussian(mean = 0, stdDev = 1) {
    const u1 = Math.max(1e-7, this.nextRandom());
    const u2 = this.nextRandom();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  init() {
    this.time = 0;
    this.oscillators = [];
    this.links = [];
    this.adjacency = Array.from({ length: this.count }, () => Array(this.count).fill(0));

    for (let i = 0; i < this.count; i++) {
      const angle = (2 * Math.PI * i) / this.count;
      const radius = 0.35 + 0.5 * this.nextRandom();
      const x = 0.5 + radius * 0.45 * Math.cos(angle);
      const y = 0.5 + radius * 0.45 * Math.sin(angle);
      const initialPhase = this.nextRandom() * 2 * Math.PI;
      const naturalFreq = this.baseFreq + this.nextGaussian(0, this.spread);

      this.oscillators.push({
        id: i,
        x,
        y,
        theta: initialPhase,
        naturalFrequency: naturalFreq,
        instantaneousFrequency: naturalFreq,
        phaseVelocity: 0
      });
    }

    this.buildTopology();
  }

  buildTopology() {
    this.links = [];
    this.adjacency = Array.from({ length: this.count }, () => Array(this.count).fill(0));

    if (this.topology === 'all-to-all') {
      const weight = 1.0 / this.count;
      for (let i = 0; i < this.count; i++) {
        for (let j = i + 1; j < this.count; j++) {
          this.adjacency[i][j] = weight;
          this.adjacency[j][i] = weight;
          this.links.push({ source: i, target: j, weight, powerFlow: 0 });
        }
      }
    } else if (this.topology === 'grid-network') {
      const kNearest = 4;
      for (let i = 0; i < this.count; i++) {
        const distances = [];
        for (let j = 0; j < this.count; j++) {
          if (i === j) continue;
          const dx = this.oscillators[i].x - this.oscillators[j].x;
          const dy = this.oscillators[i].y - this.oscillators[j].y;
          distances.push({ index: j, dist: Math.hypot(dx, dy) });
        }
        distances.sort((a, b) => a.dist - b.dist);
        for (let k = 0; k < kNearest; k++) {
          const neighbor = distances[k].index;
          if (i < neighbor) {
            const weight = 1.0 / kNearest;
            this.adjacency[i][neighbor] = weight;
            this.adjacency[neighbor][i] = weight;
            this.links.push({ source: i, target: neighbor, weight, powerFlow: 0 });
          }
        }
      }
    }
  }

  /**
   * @param {number[]} phases
   * @returns {number[]}
   */
  computeDerivatives(phases) {
    const derivatives = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      let couplingSum = 0;
      const thetaI = phases[i];
      for (let j = 0; j < this.count; j++) {
        const weight = this.adjacency[i][j];
        if (weight > 0) {
          couplingSum += weight * Math.sin(phases[j] - thetaI);
        }
      }
      derivatives[i] = this.oscillators[i].naturalFrequency + this.coupling * couplingSum;
    }
    return derivatives;
  }

  step() {
    const n = this.count;
    const currentPhases = this.oscillators.map((o) => o.theta);

    const k1 = this.computeDerivatives(currentPhases);

    const p2 = new Array(n);
    for (let i = 0; i < n; i++) {
      p2[i] = currentPhases[i] + 0.5 * this.dt * k1[i];
    }
    const k2 = this.computeDerivatives(p2);

    const p3 = new Array(n);
    for (let i = 0; i < n; i++) {
      p3[i] = currentPhases[i] + 0.5 * this.dt * k2[i];
    }
    const k3 = this.computeDerivatives(p3);

    const p4 = new Array(n);
    for (let i = 0; i < n; i++) {
      p4[i] = currentPhases[i] + this.dt * k3[i];
    }
    const k4 = this.computeDerivatives(p4);

    for (let i = 0; i < n; i++) {
      const dTheta = (this.dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      let newTheta = (this.oscillators[i].theta + dTheta) % (2 * Math.PI);
      if (newTheta < 0) newTheta += 2 * Math.PI;

      this.oscillators[i].theta = newTheta;
      this.oscillators[i].phaseVelocity = dTheta / this.dt;
      this.oscillators[i].instantaneousFrequency = k1[i];
    }

    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      const thetaA = this.oscillators[link.source].theta;
      const thetaB = this.oscillators[link.target].theta;
      link.powerFlow = this.coupling * link.weight * Math.sin(thetaA - thetaB);
    }

    this.time += this.dt;
  }

  /**
   * @param {number} steps
   */
  run(steps) {
    for (let s = 0; s < steps; s++) {
      this.step();
    }
  }

  /**
   * @returns {SimulationMetrics}
   */
  getMetrics() {
    let sumCos = 0;
    let sumSin = 0;
    let sumFreq = 0;

    for (let i = 0; i < this.count; i++) {
      const theta = this.oscillators[i].theta;
      sumCos += Math.cos(theta);
      sumSin += Math.sin(theta);
      sumFreq += this.oscillators[i].instantaneousFrequency;
    }

    const meanCos = sumCos / this.count;
    const meanSin = sumSin / this.count;
    const orderParameter = Math.sqrt(meanCos * meanCos + meanSin * meanSin);
    const meanPhase = Math.atan2(meanSin, meanCos);
    const meanFreq = sumFreq / this.count;

    let varianceSum = 0;
    let lockedCount = 0;
    const frequencyTolerance = 0.15;

    for (let i = 0; i < this.count; i++) {
      const diff = this.oscillators[i].instantaneousFrequency - meanFreq;
      varianceSum += diff * diff;
      if (Math.abs(diff) < frequencyTolerance) {
        lockedCount++;
      }
    }

    const frequencyVariance = varianceSum / this.count;
    const lockedFraction = lockedCount / this.count;

    let totalPowerFlow = 0;
    for (let i = 0; i < this.links.length; i++) {
      totalPowerFlow += Math.abs(this.links[i].powerFlow);
    }
    const averagePowerFlow = this.links.length > 0 ? totalPowerFlow / this.links.length : 0;

    return {
      orderParameter,
      meanPhase,
      frequencyVariance,
      lockedFraction,
      averagePowerFlow,
      simulationTime: this.time
    };
  }

  /**
   * @param {number} targetIndex
   * @param {number} phaseDelta
   */
  perturb(targetIndex, phaseDelta) {
    if (targetIndex >= 0 && targetIndex < this.count) {
      let nextTheta = (this.oscillators[targetIndex].theta + phaseDelta) % (2 * Math.PI);
      if (nextTheta < 0) nextTheta += 2 * Math.PI;
      this.oscillators[targetIndex].theta = nextTheta;
    }
  }

  /**
   * @param {number} fraction
   */
  perturbFraction(fraction = 0.3) {
    const countToPerturb = Math.floor(this.count * fraction);
    for (let i = 0; i < countToPerturb; i++) {
      const idx = Math.floor(this.nextRandom() * this.count);
      const delta = (this.nextRandom() - 0.5) * Math.PI * 1.5;
      this.perturb(idx, delta);
    }
  }

  /**
   * @param {number} newCoupling
   */
  setCoupling(newCoupling) {
    this.coupling = newCoupling;
  }

  /**
   * @param {number} newSpread
   */
  setSpread(newSpread) {
    this.spread = newSpread;
    for (let i = 0; i < this.count; i++) {
      this.oscillators[i].naturalFrequency = this.baseFreq + this.nextGaussian(0, this.spread);
    }
  }
}
