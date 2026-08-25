// @ts-check

const TAU = Math.PI * 2;

export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createOscillators(count, seed) {
  const random = createRandom(seed);
  return Array.from({ length: count }, (_, index) => ({
    phase: random() * TAU,
    frequency: 0.72 + random() * 0.56,
    radius: 0.58 + random() * 0.36,
    angle: (index / count) * TAU + (random() - 0.5) * 0.16,
  }));
}

export function coherence(oscillators) {
  const sum = oscillators.reduce(
    (accumulator, oscillator) => ({
      x: accumulator.x + Math.cos(oscillator.phase),
      y: accumulator.y + Math.sin(oscillator.phase),
    }),
    { x: 0, y: 0 },
  );
  return Math.hypot(sum.x, sum.y) / oscillators.length;
}

export function stepOscillators(oscillators, coupling, deltaTime) {
  const meanX = oscillators.reduce((sum, oscillator) => sum + Math.cos(oscillator.phase), 0) / oscillators.length;
  const meanY = oscillators.reduce((sum, oscillator) => sum + Math.sin(oscillator.phase), 0) / oscillators.length;
  const meanPhase = Math.atan2(meanY, meanX);

  return oscillators.map((oscillator) => ({
    ...oscillator,
    phase: (oscillator.phase + (oscillator.frequency + coupling * Math.sin(meanPhase - oscillator.phase)) * deltaTime + TAU) % TAU,
  }));
}

export function runExperiment({ seed, coupling, seconds, count = 36, deltaTime = 1 / 60 }) {
  let oscillators = createOscillators(count, seed);
  const samples = [];
  const steps = Math.round(seconds / deltaTime);

  for (let step = 0; step < steps; step += 1) {
    oscillators = stepOscillators(oscillators, coupling, deltaTime);
    if (step >= steps * 0.75) samples.push(coherence(oscillators));
  }

  return {
    oscillators,
    meanCoherence: samples.reduce((sum, value) => sum + value, 0) / samples.length,
  };
}

export function disturbOscillators(oscillators, seed, fraction = 0.4) {
  const random = createRandom(seed);
  const disturbedCount = Math.round(oscillators.length * fraction);
  return oscillators.map((oscillator, index) => index < disturbedCount
    ? { ...oscillator, phase: random() * TAU }
    : oscillator);
}

export function recoverFromDisturbance(seed, coupling) {
  const settled = runExperiment({ seed, coupling, seconds: 18 }).oscillators;
  const disturbed = disturbOscillators(settled, seed + 1000);
  let oscillators = disturbed;
  for (let step = 0; step < 600; step += 1) {
    oscillators = stepOscillators(oscillators, coupling, 1 / 60);
  }
  return {
    disturbed: coherence(disturbed),
    recovered: coherence(oscillators),
  };
}