// @ts-check

/** @typedef {{ phases: number[], frequencies: number[], coupling: number, time: number }} OscillatorState */

const TAU = Math.PI * 2;

/** @param {number} seed */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** @param {number} count @param {number} seed @param {number} coupling */
export function createOscillators(count, seed, coupling) {
  const random = createRandom(seed);
  return {
    phases: Array.from({ length: count }, () => random() * TAU),
    frequencies: Array.from({ length: count }, () => (random() - 0.5) * 1.2),
    coupling,
    time: 0,
  };
}

/** @param {OscillatorState} state @param {number} dt */
export function stepOscillators(state, dt) {
  const count = state.phases.length;
  let meanSine = 0;
  let meanCosine = 0;

  for (const phase of state.phases) {
    meanSine += Math.sin(phase);
    meanCosine += Math.cos(phase);
  }

  meanSine /= count;
  meanCosine /= count;

  for (let index = 0; index < count; index += 1) {
    const phase = state.phases[index];
    const pull = meanSine * Math.cos(phase) - meanCosine * Math.sin(phase);
    state.phases[index] = (phase + (state.frequencies[index] + state.coupling * pull) * dt + TAU) % TAU;
  }

  state.time += dt;
  return state;
}

/** @param {OscillatorState} state */
export function coherence(state) {
  let sine = 0;
  let cosine = 0;

  for (const phase of state.phases) {
    sine += Math.sin(phase);
    cosine += Math.cos(phase);
  }

  return Math.hypot(sine, cosine) / state.phases.length;
}

/** @param {OscillatorState} state @param {number} offset */
export function disturbOscillators(state, offset) {
  for (let index = 0; index < state.phases.length; index += 3) {
    state.phases[index] = (state.phases[index] + offset + TAU) % TAU;
  }
  return state;
}

/** @param {number} seed @param {number} coupling @param {number} steps */
export function measureRun(seed, coupling, steps = 1600) {
  const state = createOscillators(48, seed, coupling);
  for (let index = 0; index < steps; index += 1) {
    stepOscillators(state, 0.025);
  }
  return coherence(state);
}