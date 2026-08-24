// @ts-check

/**
 * Kuramoto mean-field model of coupled phase oscillators.
 * Pure numerics: no DOM, no globals, no rendering. Imported unchanged by the
 * browser page, by `node --test`, and by the in-page claims panel.
 *
 * dtheta_i/dt = omega_i + (K/N) * sum_j sin(theta_j - theta_i)
 *             = omega_i + K * r * sin(psi - theta_i)
 */

/**
 * @typedef {object} Swarm
 * @property {Float64Array} theta Phase of each oscillator, radians.
 * @property {Float64Array} omega Natural frequency of each oscillator, rad/s.
 * @property {number} n Population size.
 * @property {number} gamma Half-width at half-maximum of the frequency spread.
 */

/**
 * @typedef {object} Coherence
 * @property {number} r Order parameter in [0, 1]. 0 is incoherent, 1 is locked.
 * @property {number} psi Mean phase, radians.
 */

/**
 * Deterministic quantiles of a Lorentzian (Cauchy) distribution centred on zero.
 * Sampling the inverse CDF at evenly spaced probabilities instead of drawing at
 * random removes the sampling noise that otherwise dominates the order parameter
 * at small N, which is what makes the threshold measurable on a laptop.
 *
 * @param {number} n
 * @param {number} gamma Half-width at half-maximum.
 * @returns {Float64Array}
 */
export function lorentzianFrequencies(n, gamma) {
  const omega = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = (i + 1) / (n + 1);
    omega[i] = gamma * Math.tan(Math.PI * (p - 0.5));
  }
  return omega;
}

/**
 * @param {number} seed
 * @returns {() => number} Uniform [0, 1) generator.
 */
export function makeRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {object} options
 * @param {number} [options.n]
 * @param {number} [options.gamma]
 * @param {number} [options.seed]
 * @returns {Swarm}
 */
export function createSwarm({ n = 480, gamma = 0.5, seed = 7 } = {}) {
  const random = makeRandom(seed);
  const theta = new Float64Array(n);
  for (let i = 0; i < n; i++) theta[i] = random() * 2 * Math.PI;
  return { theta, omega: lorentzianFrequencies(n, gamma), n, gamma };
}

/**
 * @param {Float64Array} theta
 * @returns {Coherence}
 */
export function coherence(theta) {
  let sumCos = 0;
  let sumSin = 0;
  for (let i = 0; i < theta.length; i++) {
    sumCos += Math.cos(theta[i]);
    sumSin += Math.sin(theta[i]);
  }
  const n = theta.length;
  sumCos /= n;
  sumSin /= n;
  return { r: Math.hypot(sumCos, sumSin), psi: Math.atan2(sumSin, sumCos) };
}

/**
 * Advance the swarm by one explicit Euler step.
 *
 * @param {Swarm} swarm
 * @param {number} K Coupling strength.
 * @param {number} dt
 * @returns {Coherence} Coherence measured before the step was applied.
 */
export function step(swarm, K, dt) {
  const { theta, omega, n } = swarm;
  const field = coherence(theta);
  const drive = K * field.r;
  for (let i = 0; i < n; i++) {
    theta[i] += dt * (omega[i] + drive * Math.sin(field.psi - theta[i]));
  }
  return field;
}

/**
 * Settle the swarm at a fixed coupling and report the time-averaged order
 * parameter over a measurement window that starts after the transient.
 *
 * @param {Swarm} swarm
 * @param {object} options
 * @param {number} options.K
 * @param {number} [options.dt]
 * @param {number} [options.burnIn] Steps discarded before measuring.
 * @param {number} [options.window] Steps averaged.
 * @returns {number} Mean order parameter over the window.
 */
export function settle(swarm, { K, dt = 0.02, burnIn = 6000, window = 3000 }) {
  for (let i = 0; i < burnIn; i++) step(swarm, K, dt);
  let total = 0;
  for (let i = 0; i < window; i++) total += step(swarm, K, dt).r;
  return total / window;
}

/**
 * Mean-field prediction for the critical coupling of a Lorentzian frequency
 * distribution: K_c = 2 / (pi * g(0)) with g(0) = 1 / (pi * gamma).
 *
 * @param {number} gamma
 * @returns {number}
 */
export function criticalCoupling(gamma) {
  return 2 * gamma;
}

/**
 * Mean-field prediction for the locked-state order parameter.
 *
 * @param {number} K
 * @param {number} gamma
 * @returns {number} sqrt(1 - K_c/K) above threshold, 0 at or below it.
 */
export function predictedOrder(K, gamma) {
  const kc = criticalCoupling(gamma);
  return K <= kc ? 0 : Math.sqrt(1 - kc / K);
}

/**
 * Sweep coupling across a range, re-settling from a fresh swarm at each point.
 *
 * @param {object} options
 * @param {number[]} options.couplings
 * @param {number} [options.n]
 * @param {number} [options.gamma]
 * @param {number} [options.seed]
 * @param {number} [options.burnIn]
 * @param {number} [options.window]
 * @returns {{ K: number, r: number, predicted: number }[]}
 */
export function sweep({ couplings, n = 480, gamma = 0.5, seed = 7, burnIn = 6000, window = 3000 }) {
  return couplings.map((K) => {
    const swarm = createSwarm({ n, gamma, seed });
    return { K, r: settle(swarm, { K, burnIn, window }), predicted: predictedOrder(K, gamma) };
  });
}

/**
 * Sweep coupling without resetting the swarm, so each point inherits the state
 * left by the previous one. Running this up and then down is the standard test
 * for hysteresis: a first-order transition leaves the two branches apart.
 *
 * @param {object} options
 * @param {number[]} options.couplings Visited in the order given.
 * @param {Swarm} options.swarm Mutated in place.
 * @param {number} [options.burnIn]
 * @param {number} [options.window]
 * @returns {{ K: number, r: number }[]}
 */
export function continuationSweep({ couplings, swarm, burnIn = 4000, window = 2000 }) {
  return couplings.map((K) => ({ K, r: settle(swarm, { K, burnIn, window }) }));
}
