// @ts-check

/**
 * Linear modal dynamics shared by both halves of the pairing.
 *
 * A lightly damped string driven by noise at a point, and a community matrix linearised about a
 * fixed point and driven by environmental noise, are the same object once written in the basis of
 * the system's own modes: an Ornstein-Uhlenbeck process
 *
 *     da_k = -lambda_k a_k dt + sigmaEnv p_k dW_k + sigma0 dZ_k
 *
 * where lambda_k is the mode's relaxation rate and p_k is the projection of the environmental
 * driver onto mode k. The dW_k are either one shared scalar (a single point force, which is what a
 * pluck is) or independent per mode (several uncorrelated environmental variables). That choice
 * leaves the modal variances untouched and changes only the correlations between observables --
 * which is itself one of the things this page measures. Nothing here knows about strings, species
 * or the DOM.
 */

/** @typedef {number[][]} Matrix */

/**
 * Stationary covariance of the modal amplitudes, solving the Lyapunov equation exactly.
 *
 * @param {number[]} lambdas relaxation rate of each mode, all strictly positive
 * @param {number[]} p projection of the driver onto each mode
 * @param {number} sigmaEnv amplitude of the environmental driver
 * @param {number} sigma0 amplitude of the independent per-mode background
 * @param {boolean} [shared] true if one scalar driver forces every mode at once
 * @returns {Matrix} covariance of the modal amplitudes
 */
export function modalCovariance(lambdas, p, sigmaEnv, sigma0, shared = false) {
  const n = lambdas.length;
  /** @type {Matrix} */
  const c = [];
  for (let j = 0; j < n; j++) {
    /** @type {number[]} */
    const row = [];
    for (let k = 0; k < n; k++) {
      const drive = shared || j === k ? sigmaEnv * sigmaEnv * p[j] * p[k] : 0;
      const background = j === k ? sigma0 * sigma0 : 0;
      row.push((drive + background) / (lambdas[j] + lambdas[k]));
    }
    c.push(row);
  }
  return c;
}

/**
 * @param {Matrix} m
 * @returns {number}
 */
export function trace(m) {
  let t = 0;
  for (let i = 0; i < m.length; i++) t += m[i][i];
  return t;
}

/**
 * Fraction of the total fluctuation variance carried by each mode.
 *
 * @param {Matrix} c modal covariance
 * @returns {number[]}
 */
export function varianceShares(c) {
  const t = trace(c);
  return c.map((row, i) => row[i] / t);
}

/**
 * Visibility of one mode: the share of the fluctuations that it accounts for.
 *
 * @param {Matrix} c modal covariance
 * @param {number} soft index of the mode of interest
 * @returns {number}
 */
export function softVisibility(c, soft) {
  return c[soft][soft] / trace(c);
}

/**
 * Reduced drive G: the single dimensionless group that the visibility depends on. It is the
 * soft mode's stationary variance divided by the summed variance of every other mode.
 *
 * @param {number[]} lambdas
 * @param {number[]} p
 * @param {number} sigmaEnv
 * @param {number} sigma0
 * @param {number} soft
 * @returns {number}
 */
export function reducedDrive(lambdas, p, sigmaEnv, sigma0, soft) {
  const c = modalCovariance(lambdas, p, sigmaEnv, sigma0, false);
  let background = 0;
  for (let k = 0; k < lambdas.length; k++) if (k !== soft) background += c[k][k];
  return c[soft][soft] / background;
}

/**
 * The law the two systems are claimed to share: visibility as a function of reduced drive alone.
 *
 * @param {number} g
 * @returns {number}
 */
export function visibilityLaw(g) {
  return g / (1 + g);
}

/**
 * Push a modal covariance back into the observable coordinates (species abundances, or
 * displacement at sample points along a string).
 *
 * @param {Matrix} basis basis[i][k] is the amplitude of mode k at observable i
 * @param {Matrix} c modal covariance
 * @returns {Matrix}
 */
export function observableCovariance(basis, c) {
  const rows = basis.length;
  const modes = c.length;
  /** @type {Matrix} */
  const out = [];
  for (let i = 0; i < rows; i++) {
    /** @type {number[]} */
    const row = [];
    for (let j = 0; j < rows; j++) {
      let s = 0;
      for (let a = 0; a < modes; a++) {
        for (let b = 0; b < modes; b++) s += basis[i][a] * c[a][b] * basis[j][b];
      }
      row.push(s);
    }
    out.push(row);
  }
  return out;
}

/**
 * @param {Matrix} cov
 * @returns {Matrix}
 */
export function correlationMatrix(cov) {
  const n = cov.length;
  /** @type {Matrix} */
  const out = [];
  for (let i = 0; i < n; i++) {
    /** @type {number[]} */
    const row = [];
    for (let j = 0; j < n; j++) {
      row.push(cov[i][j] / Math.sqrt(cov[i][i] * cov[j][j]));
    }
    out.push(row);
  }
  return out;
}

/**
 * The ecologist's actual instrument: the strongest pairwise correlation between distinct species.
 *
 * @param {Matrix} corr
 * @returns {number}
 */
export function maxAbsPairCorrelation(corr) {
  let best = 0;
  for (let i = 0; i < corr.length; i++) {
    for (let j = i + 1; j < corr.length; j++) best = Math.max(best, Math.abs(corr[i][j]));
  }
  return best;
}

/**
 * Lower-triangular Cholesky factor, used to draw the modal amplitudes straight from their
 * stationary distribution so a run does not have to wait out the soft mode's relaxation time.
 *
 * @param {Matrix} m symmetric positive definite
 * @returns {Matrix}
 */
export function cholesky(m) {
  const n = m.length;
  /** @type {Matrix} */
  const l = [];
  for (let i = 0; i < n; i++) l.push(new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = m[i][j];
      for (let k = 0; k < j; k++) s -= l[i][k] * l[j][k];
      if (i === j) l[i][j] = Math.sqrt(Math.max(s, 0));
      else l[i][j] = l[j][j] === 0 ? 0 : s / l[j][j];
    }
  }
  return l;
}

/**
 * Deterministic uniform generator, so every measurement on this page is reproducible.
 *
 * @param {number} seed
 * @returns {() => number}
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {() => number} rng
 * @returns {() => number} standard normal deviates
 */
export function makeGaussian(rng) {
  return () => {
    let u = 0;
    while (u === 0) u = rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

/**
 * @typedef {object} RunSpec
 * @property {number[]} lambdas
 * @property {number[]} p
 * @property {number} sigmaEnv
 * @property {number} sigma0
 * @property {number} seed
 * @property {boolean} [shared]
 * @property {boolean} [startFromStationary]
 */

/**
 * @typedef {object} Run
 * @property {number[]} amplitudes live modal amplitudes
 * @property {(dt: number) => void} step advance by Euler-Maruyama
 */

/**
 * @param {RunSpec} spec
 * @returns {Run}
 */
export function createRun(spec) {
  const { lambdas, p, sigmaEnv, sigma0, seed } = spec;
  const isShared = spec.shared === true;
  const n = lambdas.length;
  const gauss = makeGaussian(makeRng(seed));
  const amplitudes = new Array(n).fill(0);
  if (spec.startFromStationary !== false) {
    const l = cholesky(modalCovariance(lambdas, p, sigmaEnv, sigma0, isShared));
    const z = Array.from({ length: n }, () => gauss());
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k <= i; k++) s += l[i][k] * z[k];
      amplitudes[i] = s;
    }
  }
  return {
    amplitudes,
    step(dt) {
      const root = Math.sqrt(dt);
      const common = gauss() * root;
      for (let k = 0; k < n; k++) {
        const drive = isShared ? common : gauss() * root;
        const own = gauss() * root;
        amplitudes[k] += -lambdas[k] * amplitudes[k] * dt + sigmaEnv * p[k] * drive + sigma0 * own;
      }
    },
  };
}

/**
 * Sample covariance of the modal amplitudes over a long run. Used to check the closed-form
 * stationary covariance against the dynamics that are actually integrated.
 *
 * @param {RunSpec} spec
 * @param {number} steps
 * @param {number} dt
 * @param {number} burnIn steps discarded before accumulating
 * @returns {Matrix}
 */
export function sampleModalCovariance(spec, steps, dt, burnIn) {
  const run = createRun(spec);
  const n = spec.lambdas.length;
  /** @type {Matrix} */
  const acc = [];
  for (let i = 0; i < n; i++) acc.push(new Array(n).fill(0));
  for (let s = 0; s < burnIn; s++) run.step(dt);
  for (let s = 0; s < steps; s++) {
    run.step(dt);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) acc[i][j] += run.amplitudes[i] * run.amplitudes[j];
    }
  }
  return acc.map((row) => row.map((v) => v / steps));
}
