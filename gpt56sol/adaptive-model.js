// @ts-check

export const BASELINE_SIGNAL = 1;
export const MEMORY_SECONDS = 2.4;

/**
 * @typedef {{ memory: number, response: number }} AdaptiveState
 * @typedef {{ time: number, signal: number, memory: number, response: number }} Sample
 */

/**
 * @param {number} signal
 * @returns {AdaptiveState}
 */
export function createState(signal = BASELINE_SIGNAL) {
  if (!(signal > 0)) {
    throw new RangeError("Signal must be greater than zero.");
  }

  return { memory: signal, response: 0 };
}

/**
 * @param {AdaptiveState} state
 * @param {number} signal
 * @param {number} elapsedSeconds
 * @param {number} [memorySeconds]
 * @returns {AdaptiveState}
 */
export function advance(state, signal, elapsedSeconds, memorySeconds = MEMORY_SECONDS) {
  if (!(signal > 0) || !(elapsedSeconds > 0) || !(memorySeconds > 0)) {
    throw new RangeError("Signal and time values must be greater than zero.");
  }

  const retainedMemory = Math.exp(-elapsedSeconds / memorySeconds);
  const memory = signal + (state.memory - signal) * retainedMemory;
  return {
    memory,
    response: Math.log(signal / memory),
  };
}

/**
 * @param {{ initialSignal?: number, changedSignal?: number, holdSeconds?: number, stepSeconds?: number, memorySeconds?: number }} [options]
 * @returns {Sample[]}
 */
export function runStepProtocol(options = {}) {
  const initialSignal = options.initialSignal ?? BASELINE_SIGNAL;
  const changedSignal = options.changedSignal ?? 4;
  const holdSeconds = options.holdSeconds ?? 12;
  const stepSeconds = options.stepSeconds ?? 0.02;
  const memorySeconds = options.memorySeconds ?? MEMORY_SECONDS;
  let state = createState(initialSignal);
  const samples = [{ time: 0, signal: changedSignal, memory: state.memory, response: Math.log(changedSignal / state.memory) }];

  for (let time = stepSeconds; time <= holdSeconds + stepSeconds / 2; time += stepSeconds) {
    state = advance(state, changedSignal, stepSeconds, memorySeconds);
    samples.push({ time, signal: changedSignal, ...state });
  }

  return samples;
}

/**
 * @param {Sample[]} samples
 */
export function summarize(samples) {
  const responses = samples.map((sample) => sample.response);
  return {
    peak: Math.max(...responses),
    final: responses.at(-1) ?? Number.NaN,
    settledFraction: Math.abs(responses.at(-1) ?? Number.NaN) / Math.max(...responses.map(Math.abs)),
  };
}