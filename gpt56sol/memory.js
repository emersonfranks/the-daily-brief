// @ts-check

const SIGMA = 0.45;
const START_TIME = 0;
const END_TIME = 20;
const STEP = 0.02;

/** @typedef {'credit-first' | 'debit-first'} PulseOrder */

/**
 * @typedef {object} ExperimentOptions
 * @property {number} amplitude
 * @property {number} separation
 * @property {PulseOrder} order
 */

/**
 * @typedef {object} Sample
 * @property {number} time
 * @property {number} signal
 * @property {number} cumulative
 */

/**
 * @typedef {object} Experiment
 * @property {Sample[]} samples
 * @property {number} net
 * @property {number} firstMoment
 * @property {number} memory
 * @property {number} predictedMemory
 * @property {number} peakCumulative
 * @property {ExperimentOptions} options
 */

/** @param {number} time @param {number} center */
function gaussian(time, center) {
  const offset = (time - center) / SIGMA;
  return Math.exp(-0.5 * offset * offset) / (SIGMA * Math.sqrt(2 * Math.PI));
}

/** @param {ExperimentOptions} options @returns {Experiment} */
export function createExperiment(options) {
  const direction = options.order === 'credit-first' ? 1 : -1;
  const firstCenter = 10 - options.separation / 2;
  const secondCenter = 10 + options.separation / 2;
  const samples = [];
  let net = 0;
  let firstMoment = 0;
  let memory = 0;
  let peakCumulative = 0;
  let previousSignal = 0;
  let previousCumulative = 0;

  for (let time = START_TIME; time <= END_TIME + STEP / 2; time += STEP) {
    const signal = direction * options.amplitude
      * (gaussian(time, firstCenter) - gaussian(time, secondCenter));

    if (samples.length > 0) {
      const previousTime = time - STEP;
      net += (previousSignal + signal) * STEP / 2;
      firstMoment += (previousTime * previousSignal + time * signal) * STEP / 2;
      const cumulative = net;
      memory += (previousCumulative + cumulative) * STEP / 2;
      peakCumulative = Math.max(peakCumulative, Math.abs(cumulative));
      samples.push({ time, signal, cumulative });
      previousCumulative = cumulative;
    } else {
      samples.push({ time, signal, cumulative: 0 });
    }

    previousSignal = signal;
  }

  return {
    samples,
    net,
    firstMoment,
    memory,
    predictedMemory: direction * options.amplitude * options.separation,
    peakCumulative,
    options: { ...options },
  };
}