// @ts-check

/**
 * The two concrete systems this page compares, both expressed as the same modal object.
 *
 * The string is a fixed-end string carrying six normal modes, lightly damped, driven by a random
 * force applied at one point. The community is six species linearised about a coexistence fixed
 * point, driven by one fluctuating environmental variable. Neither function touches the DOM.
 */

/** @typedef {import('./modal.js').Matrix} Matrix */

export const MODES = 6;
/** Index of the string's near-critical mode: the third harmonic. */
export const STRING_SOFT = 2;
/** Index of the community's soft mode. */
export const COMMUNITY_SOFT = 0;
/** Amplitude of the shared environmental driver. */
export const SIGMA_ENV = 1;
/** Amplitude of the independent per-mode background that is always present. */
export const SIGMA_0 = 0.01;
/** Damping of the string's ordinary modes, before the n^2 frequency scaling. */
const STRING_DAMPING = 0.9;

/**
 * @typedef {object} ModalSystem
 * @property {number[]} lambdas
 * @property {number[]} p unit-norm projection of the driver onto each mode
 * @property {number} soft index of the near-critical mode
 */

/**
 * @param {number[]} v
 * @returns {number[]}
 */
function normalise(v) {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
}

/**
 * Modal projections of a point force applied at `x` on a string of unit length.
 *
 * @param {number} x drive position in (0, 1)
 * @returns {number[]} unit-norm projections onto modes 1..MODES
 */
export function stringDriveProjection(x) {
  const raw = [];
  for (let n = 1; n <= MODES; n++) raw.push(Math.SQRT2 * Math.sin(n * Math.PI * x));
  return normalise(raw);
}

/**
 * How much of a point pluck lands on the third harmonic. Zero exactly at its nodes, x = 1/3
 * and x = 2/3.
 *
 * @param {number} x
 * @returns {number}
 */
export function alignmentFromDrivePoint(x) {
  return Math.abs(stringDriveProjection(x)[STRING_SOFT]);
}

/**
 * @param {number} epsilon relaxation rate of the third harmonic
 * @param {number} driveX where the string is driven, in (0, 1)
 * @returns {ModalSystem}
 */
export function stringSystem(epsilon, driveX) {
  const lambdas = [];
  for (let n = 1; n <= MODES; n++) {
    lambdas.push(n - 1 === STRING_SOFT ? epsilon : STRING_DAMPING * n * n);
  }
  return { lambdas, p: stringDriveProjection(driveX), soft: STRING_SOFT };
}

/**
 * Displacement basis of the string, sampled at `points` equally spaced positions.
 *
 * @param {number} points
 * @returns {Matrix}
 */
export function stringShapeBasis(points) {
  /** @type {Matrix} */
  const basis = [];
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    /** @type {number[]} */
    const row = [];
    for (let n = 1; n <= MODES; n++) row.push(Math.SQRT2 * Math.sin(n * Math.PI * x));
    basis.push(row);
  }
  return basis;
}

/** Relaxation rates of the community's five stiff modes. */
const COMMUNITY_STIFF = [0.9, 1.2, 1.5, 1.8, 2.2];
/** Unnormalised weights with which the environment drives those stiff modes. */
const COMMUNITY_STIFF_DRIVE = [0.5, 0.45, 0.4, 0.42, 0.46];
/** The soft mode: a seesaw in which some species rise while others fall. */
const COMMUNITY_SOFT_VECTOR = [0.55, -0.42, 0.38, -0.3, 0.35, -0.4];

/**
 * Orthonormal eigenvector basis of the community matrix, built deterministically by
 * Gram-Schmidt so that column 0 is the soft mode. Column k gives mode k's weight on each species.
 *
 * @returns {Matrix} basis[species][mode]
 */
export function communityBasis() {
  /** @type {number[][]} */
  const columns = [normalise(COMMUNITY_SOFT_VECTOR)];
  for (let seed = 0; seed < MODES && columns.length < MODES; seed++) {
    const candidate = new Array(MODES).fill(0);
    candidate[seed] = 1;
    for (const c of columns) {
      const dot = c.reduce((s, v, i) => s + v * candidate[i], 0);
      for (let i = 0; i < MODES; i++) candidate[i] -= dot * c[i];
    }
    if (Math.hypot(...candidate) > 1e-6) columns.push(normalise(candidate));
  }
  /** @type {Matrix} */
  const basis = [];
  for (let i = 0; i < MODES; i++) basis.push(columns.map((c) => c[i]));
  return basis;
}

/**
 * @param {number} epsilon relaxation rate of the soft mode; zero is the tipping point
 * @param {number} alignment |cos| of the angle between the environmental driver and the soft mode
 * @returns {ModalSystem}
 */
export function communitySystem(epsilon, alignment) {
  const a = Math.min(1, Math.max(0, alignment));
  const rest = normalise(COMMUNITY_STIFF_DRIVE).map((w) => w * Math.sqrt(1 - a * a));
  return {
    lambdas: [epsilon, ...COMMUNITY_STIFF],
    p: [a, ...rest],
    soft: COMMUNITY_SOFT,
  };
}
