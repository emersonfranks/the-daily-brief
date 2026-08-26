// @ts-check

/**
 * @typedef {Object} DoubleWellState
 * @property {number} x
 * @property {number} t
 * @property {number} signal
 * @property {number} noise
 * @property {number} macroState
 * @property {number} wellPotential
 */

/**
 * @typedef {Object} NeuronState
 * @property {number} v
 * @property {number} t
 * @property {number} signal
 * @property {boolean} spiked
 * @property {number} refractoryTimer
 * @property {number[]} spikeTimes
 */

/**
 * @typedef {Object} DoubleWellParams
 * @property {number} a
 * @property {number} b
 * @property {number} amplitude
 * @property {number} frequency
 * @property {number} noiseIntensity
 * @property {number} dt
 */

/**
 * @typedef {Object} NeuronParams
 * @property {number} vRest
 * @property {number} vThreshold
 * @property {number} vReset
 * @property {number} tau
 * @property {number} amplitude
 * @property {number} frequency
 * @property {number} noiseIntensity
 * @property {number} refractoryPeriod
 * @property {number} dt
 */

/**
 * @typedef {Object} SweepPoint
 * @property {number} noise
 * @property {number} snr
 * @property {number} correlation
 * @property {number} transitions
 * @property {number} phaseLocking
 */

export class FastRandom {
  /**
   * @param {number} seed
   */
  constructor(seed = 123456789) {
    this.s0 = (seed >>> 0) || 1;
    this.s1 = ((seed * 1812433253 + 1) >>> 0) || 2;
    this.hasSpare = false;
    this.spareGaussian = 0;
  }

  /**
   * @returns {number}
   */
  nextFloat() {
    let s1 = this.s0;
    const s0 = this.s1;
    this.s0 = s0;
    s1 ^= s1 << 23;
    this.s1 = (s1 ^ s0 ^ (s1 >>> 17) ^ (s0 >>> 26)) >>> 0;
    return ((this.s1 + s0) >>> 0) / 4294967296;
  }

  /**
   * @returns {number}
   */
  nextGaussian() {
    if (this.hasSpare) {
      this.hasSpare = false;
      return this.spareGaussian;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = this.nextFloat() * 2 - 1;
      v = this.nextFloat() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);

    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    this.spareGaussian = v * mul;
    this.hasSpare = true;
    return u * mul;
  }
}

export class DoubleWellSimulator {
  /**
   * @param {Partial<DoubleWellParams>} [options]
   * @param {number} [seed]
   */
  constructor(options = {}, seed = 42) {
    this.a = options.a ?? 1.0;
    this.b = options.b ?? 1.0;
    this.amplitude = options.amplitude ?? 0.18;
    this.frequency = options.frequency ?? 0.04;
    this.noiseIntensity = options.noiseIntensity ?? 0.12;
    this.dt = options.dt ?? 0.05;
    this.rng = new FastRandom(seed);
    this.x = -1.0;
    this.t = 0;
  }

  /**
   * @param {number} xVal
   * @param {number} timeVal
   * @returns {number}
   */
  potential(xVal, timeVal) {
    const s = this.amplitude * Math.cos(2 * Math.PI * this.frequency * timeVal);
    return -0.5 * this.a * xVal * xVal + 0.25 * this.b * Math.pow(xVal, 4) - s * xVal;
  }

  /**
   * @param {number} [steps]
   * @returns {DoubleWellState}
   */
  step(steps = 1) {
    for (let i = 0; i < steps; i++) {
      const omega = 2 * Math.PI * this.frequency;
      const s = this.amplitude * Math.cos(omega * this.t);
      const grad = this.a * this.x - this.b * Math.pow(this.x, 3) + s;
      const noise = Math.sqrt(2 * this.noiseIntensity * this.dt) * this.rng.nextGaussian();
      this.x = this.x + grad * this.dt + noise;
      if (this.x > 3.0) this.x = 3.0;
      if (this.x < -3.0) this.x = -3.0;
      this.t += this.dt;
    }

    const currentSignal = this.amplitude * Math.cos(2 * Math.PI * this.frequency * this.t);
    const macroState = this.x >= 0 ? 1.0 : -1.0;
    return {
      x: this.x,
      t: this.t,
      signal: currentSignal,
      noise: this.noiseIntensity,
      macroState,
      wellPotential: this.potential(this.x, this.t)
    };
  }

  /**
   * @param {number} count
   * @returns {{ times: Float64Array, states: Float64Array, macroStates: Float64Array, signals: Float64Array, transitions: number }}
   */
  record(count) {
    const times = new Float64Array(count);
    const states = new Float64Array(count);
    const macroStates = new Float64Array(count);
    const signals = new Float64Array(count);
    let transitions = 0;

    let prevSign = this.x >= 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const res = this.step(1);
      times[i] = res.t;
      states[i] = res.x;
      macroStates[i] = res.macroState;
      signals[i] = res.signal;

      const currSign = res.x >= 0 ? 1 : -1;
      if (currSign !== prevSign) {
        transitions++;
        prevSign = currSign;
      }
    }

    return { times, states, macroStates, signals, transitions };
  }

  reset() {
    this.x = -1.0;
    this.t = 0;
  }
}

export class NeuronSimulator {
  /**
   * @param {Partial<NeuronParams>} [options]
   * @param {number} [seed]
   */
  constructor(options = {}, seed = 84) {
    this.vRest = options.vRest ?? -70.0;
    this.vThreshold = options.vThreshold ?? -55.0;
    this.vReset = options.vReset ?? -75.0;
    this.tau = options.tau ?? 10.0;
    this.amplitude = options.amplitude ?? 10.0;
    this.frequency = options.frequency ?? 0.04;
    this.noiseIntensity = options.noiseIntensity ?? 2.8;
    this.refractoryPeriod = options.refractoryPeriod ?? 2.0;
    this.dt = options.dt ?? 0.05;
    this.rng = new FastRandom(seed);
    this.v = this.vRest;
    this.t = 0;
    this.refractoryTimer = 0;
    /** @type {number[]} */
    this.spikeTimes = [];
  }

  /**
   * @param {number} [steps]
   * @returns {NeuronState}
   */
  step(steps = 1) {
    let spikedInStep = false;
    for (let i = 0; i < steps; i++) {
      const omega = 2 * Math.PI * this.frequency;
      const s = this.amplitude * Math.cos(omega * this.t);

      if (this.refractoryTimer > 0) {
        this.refractoryTimer -= this.dt;
        this.v = this.vReset;
      } else {
        const dV = (-(this.v - this.vRest) + s) / this.tau;
        const noise = this.noiseIntensity * Math.sqrt(this.dt) * this.rng.nextGaussian();
        this.v = this.v + dV * this.dt + noise;

        if (this.v >= this.vThreshold) {
          this.v = 20.0;
          this.refractoryTimer = this.refractoryPeriod;
          this.spikeTimes.push(this.t);
          spikedInStep = true;
        }
      }
      this.t += this.dt;
    }

    const currentSignal = this.amplitude * Math.cos(2 * Math.PI * this.frequency * this.t);
    return {
      v: this.v,
      t: this.t,
      signal: currentSignal,
      spiked: spikedInStep,
      refractoryTimer: this.refractoryTimer,
      spikeTimes: this.spikeTimes
    };
  }

  /**
   * @param {number} count
   * @returns {{ times: Float64Array, voltages: Float64Array, signals: Float64Array, spikes: number[] }}
   */
  record(count) {
    const times = new Float64Array(count);
    const voltages = new Float64Array(count);
    const signals = new Float64Array(count);
    const spikes = [];

    for (let i = 0; i < count; i++) {
      const res = this.step(1);
      times[i] = res.t;
      voltages[i] = res.v;
      signals[i] = res.signal;
      if (res.spiked) spikes.push(res.t);
    }

    return { times, voltages, signals, spikes };
  }

  reset() {
    this.v = this.vRest;
    this.t = 0;
    this.refractoryTimer = 0;
    this.spikeTimes = [];
  }
}

/**
 * @param {Float64Array} signalA
 * @param {Float64Array} signalB
 * @returns {number}
 */
export function computeCorrelation(signalA, signalB) {
  const n = Math.min(signalA.length, signalB.length);
  if (n === 0) return 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += signalA[i];
    sumB += signalB[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const diffA = signalA[i] - meanA;
    const diffB = signalB[i] - meanB;
    cov += diffA * diffB;
    varA += diffA * diffA;
    varB += diffB * diffB;
  }
  if (varA <= 1e-12 || varB <= 1e-12) return 0;
  return cov / Math.sqrt(varA * varB);
}

/**
 * @param {Float64Array} values
 * @param {number} dt
 * @param {number} targetFreq
 * @returns {{ snrLinear: number, snrDb: number, peakPower: number, noiseFloor: number }}
 */
export function computeSpectralSNR(values, dt, targetFreq) {
  const n = values.length;
  if (n < 64) {
    return { snrLinear: 0, snrDb: 0, peakPower: 0, noiseFloor: 1e-6 };
  }

  let variance = 0;
  let mean = 0;
  for (let i = 0; i < n; i++) {
    mean += values[i];
  }
  mean /= n;
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean;
    variance += d * d;
  }
  variance /= n;

  if (variance <= 1e-10) {
    return { snrLinear: 0, snrDb: 0, peakPower: 0, noiseFloor: 1e-6 };
  }

  const samplingFreq = 1.0 / dt;
  const windowSize = Math.min(n, 4096);

  const powers = new Float64Array(Math.floor(windowSize / 2));
  for (let k = 1; k < powers.length; k++) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < windowSize; t++) {
      const angle = (2 * Math.PI * k * t) / windowSize;
      const val = values[t] - mean;
      re += val * Math.cos(angle);
      im -= val * Math.sin(angle);
    }
    powers[k] = (re * re + im * im) / windowSize;
  }

  const binIndex = Math.min(Math.max(1, Math.round((targetFreq * windowSize) / samplingFreq)), powers.length - 2);
  const peakPower = powers[binIndex];

  let bgSum = 0;
  let bgCount = 0;
  const radius = Math.max(3, Math.floor(powers.length * 0.05));
  for (let j = Math.max(1, binIndex - radius); j <= Math.min(powers.length - 1, binIndex + radius); j++) {
    if (Math.abs(j - binIndex) > 1) {
      bgSum += powers[j];
      bgCount++;
    }
  }

  const noiseFloor = bgCount > 0 ? Math.max(1e-9, bgSum / bgCount) : 1e-9;
  const snrLinear = Math.max(0, (peakPower - noiseFloor) / noiseFloor);
  const snrDb = snrLinear > 0 ? 10 * Math.log10(snrLinear + 1) : 0;

  return { snrLinear, snrDb, peakPower, noiseFloor };
}

/**
 * @param {number[]} spikeTimes
 * @param {number} signalFreq
 * @returns {number}
 */
export function computePhaseLockingFactor(spikeTimes, signalFreq) {
  if (spikeTimes.length === 0) return 0;
  const period = 1.0 / signalFreq;
  let sumCos = 0;
  let sumSin = 0;

  for (let i = 0; i < spikeTimes.length; i++) {
    const phase = (2 * Math.PI * (spikeTimes[i] % period)) / period;
    sumCos += Math.cos(phase);
    sumSin += Math.sin(phase);
  }

  const count = spikeTimes.length;
  return Math.sqrt(sumCos * sumCos + sumSin * sumSin) / count;
}

/**
 * @param {number} [noisePoints]
 * @param {number} [seed]
 * @returns {SweepPoint[]}
 */
export function runDoubleWellNoiseSweep(noisePoints = 16, seed = 100) {
  const points = [];
  const minNoise = 0.0;
  const maxNoise = 0.40;
  const sampleDuration = 1000;
  const dt = 0.05;
  const steps = Math.floor(sampleDuration / dt);

  for (let i = 0; i < noisePoints; i++) {
    const noise = minNoise + (maxNoise - minNoise) * (i / (noisePoints - 1));
    const sim = new DoubleWellSimulator({ noiseIntensity: noise, amplitude: 0.18, frequency: 0.04, dt }, seed + i * 7);
    sim.step(100);
    const recorded = sim.record(steps);
    const snrResult = computeSpectralSNR(recorded.macroStates, dt, 0.04);
    const corr = computeCorrelation(recorded.signals, recorded.macroStates);

    points.push({
      noise,
      snr: snrResult.snrDb,
      correlation: Math.max(0, corr),
      transitions: recorded.transitions,
      phaseLocking: 0
    });
  }

  return points;
}

/**
 * @param {number} [noisePoints]
 * @param {number} [seed]
 * @returns {SweepPoint[]}
 */
export function runNeuronNoiseSweep(noisePoints = 16, seed = 200) {
  const points = [];
  const minNoise = 0.0;
  const maxNoise = 8.0;
  const sampleDuration = 1000;
  const dt = 0.05;
  const steps = Math.floor(sampleDuration / dt);

  for (let i = 0; i < noisePoints; i++) {
    const noise = minNoise + (maxNoise - minNoise) * (i / (noisePoints - 1));
    const sim = new NeuronSimulator({ noiseIntensity: noise, amplitude: 10.0, frequency: 0.04, dt }, seed + i * 5);
    sim.step(100);
    const recorded = sim.record(steps);
    const plf = computePhaseLockingFactor(recorded.spikes, 0.04);
    const corr = computeCorrelation(recorded.signals, recorded.voltages);

    points.push({
      noise,
      snr: plf * 10,
      correlation: Math.max(0, corr),
      transitions: recorded.spikes.length,
      phaseLocking: plf
    });
  }

  return points;
}
