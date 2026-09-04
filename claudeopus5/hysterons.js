// @ts-check

/**
 * The domain model: an ensemble of hysterons.
 *
 * A hysteron is the smallest object that can remember anything. It is a two-state switch with two
 * different thresholds: it flips ON when the drive rises above `up`, and does not flip back until
 * the drive falls below `down`. Because `down < up`, the switch's state depends not on where the
 * drive is now but on where it has been.
 *
 * This module is deliberately free of any physical units. A hysteron ensemble is the shared
 * skeleton of the two systems on the page: elastic fibres buckling inside microfluidic channels
 * (Rajput & Pahlavan, arXiv:2607.15122) and magnetic domains flipping inside a ferromagnet
 * (Preisach 1935). `observables.js` is what puts pressure or field units back on top.
 *
 * No DOM, no canvas, no globals — everything here runs under `node --test`.
 */

/**
 * @typedef {Object} Hysteron
 * @property {number} up   drive at or above which an OFF hysteron switches ON
 * @property {number} down drive at or below which an ON hysteron switches OFF
 */

/**
 * @typedef {Object} Ensemble
 * @property {Hysteron[]} hysterons
 * @property {Int8Array} interaction  flattened n x n matrix of interaction signs, zero diagonal
 * @property {number} couplingStrength
 * @property {Uint8Array} state
 * @property {number} drive
 * @property {number} n
 */

/**
 * @typedef {Object} StepResult
 * @property {number} flips      how many hysterons switched, i.e. the avalanche size
 * @property {boolean} converged whether relaxation reached a stable state within the flip budget
 */

/**
 * Coupling layouts.
 * - `none`       the Preisach limit: switches ignore each other entirely.
 * - `ferro`      every interaction positive, so switching one nudges every other the same way.
 * - `frustrated` mixed signs, still symmetric: i pushes j exactly as hard as j pushes i.
 * - `asymmetric` mixed signs and *not* symmetric: i can push j without j pushing i back.
 */
export const COUPLING_KINDS = /** @type {const} */ (['none', 'ferro', 'frustrated', 'asymmetric']);

/** @typedef {'none' | 'ferro' | 'frustrated' | 'asymmetric'} CouplingKind */

/**
 * Deterministic PRNG (mulberry32). Every measurement on this page is reproducible from its seed.
 * @param {number} seed
 * @returns {() => number} uniform in [0, 1)
 */
export function rng(seed) {
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
 * @param {Object} options
 * @param {number} options.n              number of hysterons
 * @param {number} options.seed
 * @param {CouplingKind} [options.kind]
 * @param {number} [options.couplingStrength]
 * @returns {Ensemble}
 */
export function createEnsemble({ n, seed, kind = 'none', couplingStrength = 0 }) {
  const random = rng(seed);
  /** @type {Hysteron[]} */
  const hysterons = [];
  for (let i = 0; i < n; i += 1) {
    const centre = -0.55 + 1.1 * random();
    const halfWidth = 0.06 + 0.3 * random();
    hysterons.push({ up: centre + halfWidth, down: centre - halfWidth });
  }

  const interaction = new Int8Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (kind === 'ferro') {
        interaction[i * n + j] = 1;
        interaction[j * n + i] = 1;
      } else if (kind === 'frustrated') {
        const sign = random() < 0.5 ? -1 : 1;
        interaction[i * n + j] = sign;
        interaction[j * n + i] = sign;
      } else if (kind === 'asymmetric') {
        interaction[i * n + j] = random() < 0.5 ? -1 : 1;
        interaction[j * n + i] = random() < 0.5 ? -1 : 1;
      }
    }
  }

  return {
    n,
    hysterons,
    interaction,
    couplingStrength: kind === 'none' ? 0 : couplingStrength,
    state: new Uint8Array(n),
    drive: -2,
  };
}

/**
 * Local drive felt by hysteron `i`: the global drive plus the mean interaction with everyone else.
 * In the fluid this is the hydraulic cross-talk a bypass channel carries between fibres; in the
 * magnet it is the field neighbouring domains add to the applied one.
 * @param {Ensemble} ensemble
 * @param {number} i
 * @returns {number}
 */
export function localDrive(ensemble, i) {
  const { n, state, interaction, couplingStrength, drive } = ensemble;
  if (couplingStrength === 0 || n < 2) return drive;
  let sum = 0;
  const row = i * n;
  for (let j = 0; j < n; j += 1) {
    const sign = interaction[row + j];
    if (sign !== 0) sum += sign * (state[j] === 1 ? 1 : -1);
  }
  return drive + (couplingStrength * sum) / (n - 1);
}

/**
 * Athermal quasistatic relaxation. While the drive is rising only ON-switches are allowed, and
 * while it is falling only OFF-switches: that is the standard adiabatic protocol, and it is what
 * makes an avalanche a one-way cascade rather than a chattering oscillation. The most-violated
 * hysteron goes first, which keeps the sequence deterministic.
 *
 * @param {Ensemble} ensemble
 * @param {1 | -1} direction
 * @returns {StepResult}
 */
export function relax(ensemble, direction) {
  const budget = 40 * ensemble.n + 40;
  let flips = 0;
  for (;;) {
    let worst = -1;
    let worstViolation = 0;
    for (let i = 0; i < ensemble.n; i += 1) {
      const h = localDrive(ensemble, i);
      if (direction === 1 && ensemble.state[i] === 0) {
        const violation = h - ensemble.hysterons[i].up;
        if (violation > worstViolation) {
          worstViolation = violation;
          worst = i;
        }
      } else if (direction === -1 && ensemble.state[i] === 1) {
        const violation = ensemble.hysterons[i].down - h;
        if (violation > worstViolation) {
          worstViolation = violation;
          worst = i;
        }
      }
    }
    if (worst === -1) return { flips, converged: true };
    ensemble.state[worst] = ensemble.state[worst] === 1 ? 0 : 1;
    flips += 1;
    if (flips > budget) return { flips, converged: false };
  }
}

/**
 * Move the drive to a new value in one jump and let the ensemble avalanche.
 * @param {Ensemble} ensemble
 * @param {number} target
 * @returns {StepResult}
 */
export function setDrive(ensemble, target) {
  const direction = target >= ensemble.drive ? 1 : -1;
  ensemble.drive = target;
  return relax(ensemble, direction);
}

/**
 * Walk the drive to `target` in small increments, relaxing at each one. Sweeping rather than
 * jumping is what separates individual avalanches instead of merging them into one.
 * @param {Ensemble} ensemble
 * @param {number} target
 * @param {number} [increment]
 * @returns {{ flips: number[], maxAvalanche: number, converged: boolean }}
 */
export function sweepTo(ensemble, target, increment = 0.01) {
  const direction = target >= ensemble.drive ? 1 : -1;
  /** @type {number[]} */
  const flips = [];
  let converged = true;
  let guard = 0;
  while (direction === 1 ? ensemble.drive < target - 1e-12 : ensemble.drive > target + 1e-12) {
    const next = direction === 1
      ? Math.min(target, ensemble.drive + increment)
      : Math.max(target, ensemble.drive - increment);
    ensemble.drive = next;
    const result = relax(ensemble, direction);
    if (result.flips > 0) flips.push(result.flips);
    if (!result.converged) converged = false;
    guard += 1;
    if (guard > 100000) break;
  }
  const maxAvalanche = flips.length === 0 ? 0 : Math.max(...flips);
  return { flips, maxAvalanche, converged };
}

/**
 * Drive far below every `down` threshold, which is the only history-free starting point there is.
 * @param {Ensemble} ensemble
 */
export function saturateDown(ensemble) {
  ensemble.drive = 2;
  ensemble.state.fill(1);
  setDrive(ensemble, -2);
}

/**
 * @param {Ensemble} ensemble
 * @returns {Uint8Array} a copy, so callers can compare a later state against it
 */
export function snapshot(ensemble) {
  return Uint8Array.from(ensemble.state);
}

/**
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {number} how many hysterons differ
 */
export function mismatch(a, b) {
  let count = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) count += 1;
  return count;
}

/**
 * Run one closed excursion and report whether the ensemble came back to where it left.
 *
 * This is the return-point-memory experiment, and it is the whole page in six lines: saturate, walk
 * up to a turning point, remember the state there, take an arbitrary detour downward, come back to
 * exactly that turning point, and compare. A system with no memory of its turning points has no
 * reason to land on the same state.
 *
 * @param {Ensemble} ensemble
 * @param {number} turningPoint
 * @param {number} excursionBottom
 * @param {number} [increment]
 * @returns {{ mismatched: number, atTurningPoint: Uint8Array, afterReturn: Uint8Array }}
 */
export function returnPointExcursion(ensemble, turningPoint, excursionBottom, increment = 0.01) {
  saturateDown(ensemble);
  sweepTo(ensemble, turningPoint, increment);
  const atTurningPoint = snapshot(ensemble);
  sweepTo(ensemble, excursionBottom, increment);
  sweepTo(ensemble, turningPoint, increment);
  const afterReturn = snapshot(ensemble);
  return { mismatched: mismatch(atTurningPoint, afterReturn), atTurningPoint, afterReturn };
}

/**
 * Drive the ensemble around the same closed cycle repeatedly and report the period of the limit
 * cycle it settles into, measured in cycles. A period of 1 means the system repeats itself every
 * cycle; anything larger is a subharmonic response, where the system needs more than one pass
 * through the same drive history to get back to the same state.
 *
 * @param {Ensemble} ensemble
 * @param {number} low
 * @param {number} high
 * @param {number} cycles
 * @param {number} [increment]
 * @returns {{ period: number, transient: number }} period 0 means no repeat was seen at all
 */
export function limitCyclePeriod(ensemble, low, high, cycles, increment = 0.02) {
  saturateDown(ensemble);
  sweepTo(ensemble, high, increment);
  /** @type {string[]} */
  const seen = [];
  for (let c = 0; c < cycles; c += 1) {
    sweepTo(ensemble, low, increment);
    sweepTo(ensemble, high, increment);
    const key = ensemble.state.join('');
    const previous = seen.lastIndexOf(key);
    if (previous !== -1) return { period: seen.length - previous, transient: previous + 1 };
    seen.push(key);
  }
  return { period: 0, transient: cycles };
}
