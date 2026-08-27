// @ts-check

/**
 * @typedef {{phase: number, frequency: number}} Oscillator
 * @typedef {{time: number, coherence: number, phases: number[]}} SynchronyFrame
 * @typedef {{coupling: number, frames: SynchronyFrame[], finalCoherence: number, meanLateCoherence: number}} SynchronyRun
 */

/** @param {number} seed */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number[]} phases */
export function measureCoherence(phases) {
  const real = phases.reduce((sum, phase) => sum + Math.cos(phase), 0) / phases.length;
  const imaginary = phases.reduce((sum, phase) => sum + Math.sin(phase), 0) / phases.length;
  return Math.hypot(real, imaginary);
}

/**
 * @param {{coupling: number, seed: number, count?: number, duration?: number, step?: number, perturbAt?: number}} options
 * @returns {SynchronyRun}
 */
export function simulateSynchrony(options) {
  const count = options.count ?? 48;
  const duration = options.duration ?? 20;
  const step = options.step ?? 0.025;
  const random = createRandom(options.seed);
  /** @type {Oscillator[]} */
  const oscillators = Array.from({ length: count }, () => ({
    phase: random() * Math.PI * 2,
    frequency: 0.82 + random() * 0.36,
  }));
  /** @type {SynchronyFrame[]} */
  const frames = [];
  const captureEvery = Math.max(1, Math.round(0.1 / step));
  const totalSteps = Math.round(duration / step);

  for (let iteration = 0; iteration <= totalSteps; iteration += 1) {
    const time = iteration * step;
    if (options.perturbAt !== undefined && Math.abs(time - options.perturbAt) < step / 2) {
      for (let index = 0; index < Math.ceil(count / 4); index += 1) {
        oscillators[index].phase += Math.PI * 0.85;
      }
    }
    if (iteration % captureEvery === 0) {
      const phases = oscillators.map((oscillator) => oscillator.phase);
      frames.push({ time, coherence: measureCoherence(phases), phases });
    }
    const phases = oscillators.map((oscillator) => oscillator.phase);
    const velocities = oscillators.map((oscillator, index) => {
      const correction = phases.reduce((sum, phase) => sum + Math.sin(phase - phases[index]), 0) / count;
      return oscillator.frequency + options.coupling * correction;
    });
    oscillators.forEach((oscillator, index) => {
      oscillator.phase = (oscillator.phase + velocities[index] * step) % (Math.PI * 2);
    });
  }

  const lateFrames = frames.filter((frame) => frame.time >= duration * 0.75);
  return {
    coupling: options.coupling,
    frames,
    finalCoherence: frames.at(-1)?.coherence ?? 0,
    meanLateCoherence: lateFrames.reduce((sum, frame) => sum + frame.coherence, 0) / lateFrames.length,
  };
}

/** @param {number} coupling @param {number[]} seeds */
export function measureCoupling(coupling, seeds) {
  const runs = seeds.map((seed) => simulateSynchrony({ coupling, seed }));
  const values = runs.map((run) => run.meanLateCoherence);
  return {
    coupling,
    runs: runs.length,
    meanCoherence: values.reduce((sum, value) => sum + value, 0) / values.length,
    minimumCoherence: Math.min(...values),
    maximumCoherence: Math.max(...values),
  };
}