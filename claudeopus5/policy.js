// @ts-check

/**
 * Two noisy-gradient searchers that share one accumulator.
 *
 * Both live on a line. Both are trying to get to large `x`. Both only ever learn about the
 * landscape through a single noisy scalar measurement per step. The only thing they share
 * mechanically is the running second-moment estimate `v` and the option to divide by its square
 * root — variance adaptation in the biology literature, RMSProp in the optimisation literature.
 *
 * What differs is the response law applied to the normalised measurement:
 *   swimmer   — exponential, one-sided: a turn probability p0 * exp(-lambda * r), clipped to [0,1]
 *   optimizer — linear: a step of size eta * r
 *
 * Nothing here touches the DOM, so the same code runs under `node --test` and in the browser.
 */

/** @typedef {'swimmer' | 'optimizer'} System */

/**
 * @typedef {object} Params
 * @property {System} system      Which response law to apply.
 * @property {boolean} adaptive   Divide the measurement by the running RMS?
 * @property {number} gradient    True gradient steepness G, in signal units per step.
 * @property {number} noise       Measurement noise sigma, in the same units as the gradient.
 * @property {number} lambda      Swimmer response gain (dimensionless).
 * @property {number} p0          Swimmer baseline turn probability per step.
 * @property {number} eta         Optimizer step size.
 * @property {number} beta        Memory of the running second-moment estimate, in [0,1).
 * @property {number} speed       Swimmer path length per step.
 * @property {number} epsilon     Floor added to the RMS to keep the division finite.
 */

/**
 * @typedef {object} Agent
 * @property {Params} params
 * @property {number} x           Position along the line.
 * @property {number} heading     Swimmer heading, +1 or -1. Unused by the optimizer.
 * @property {number} v           Running mean of the squared measurement.
 * @property {number} pathLength  Total distance travelled.
 * @property {number} steps       Steps taken.
 * @property {number} turns       Swimmer direction reversals.
 * @property {number} responseSq  Running sum of squared normalised responses.
 * @property {number} saturated   Steps where the swimmer's turn probability hit 0 or 1.
 * @property {() => number} rng
 */

/**
 * @typedef {object} StepRecord
 * @property {number} x           Position after the step.
 * @property {number} dx          Signed displacement produced by this step.
 * @property {number} measurement Raw noisy measurement before normalisation.
 * @property {number} scale       Divisor actually used this step.
 * @property {number} response    Normalised measurement fed to the response law.
 * @property {boolean} turned     Swimmer only: did it reverse?
 * @property {number} demand      Swimmer only: turn probability the response law asked for,
 *                                before clipping to [0,1]. This is what rails.
 */

/** Defaults chosen in `calibrate.md`; see `THRESHOLD_NOTES` at the foot of this file. */
export const DEFAULTS = /** @type {Params} */ ({
  system: 'swimmer',
  adaptive: true,
  gradient: 0.4,
  noise: 0.4,
  lambda: 4,
  p0: 0.2,
  eta: 0.4,
  beta: 0.9,
  speed: 1,
  epsilon: 1e-6,
});

/**
 * Deterministic 32-bit PRNG (mulberry32). Seeded runs are the whole point: every number this page
 * prints has to be reproducible by the reader.
 * @param {number} seed
 * @returns {() => number}
 */
export function makeRng(seed) {
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
 * Standard normal via Box-Muller. One value per call; the discarded twin costs nothing here and
 * keeps the function stateless, which keeps seeded runs reproducible under any call order.
 * @param {() => number} rng
 * @returns {number}
 */
export function gaussian(rng) {
  const u = Math.max(rng(), Number.MIN_VALUE);
  const w = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w);
}

/**
 * @param {Partial<Params>} overrides
 * @param {number} seed
 * @returns {Agent}
 */
export function createAgent(overrides, seed) {
  const params = { ...DEFAULTS, ...overrides };
  return {
    params,
    x: 0,
    heading: 1,
    v: params.gradient * params.gradient + params.noise * params.noise,
    pathLength: 0,
    steps: 0,
    turns: 0,
    responseSq: 0,
    saturated: 0,
    rng: makeRng(seed),
  };
}

/**
 * Advance one agent by one step, mutating it.
 * @param {Agent} agent
 * @returns {StepRecord}
 */
export function step(agent) {
  const p = agent.params;
  const isSwimmer = p.system === 'swimmer';

  // The measurement. The swimmer senses the concentration change along its current heading; the
  // optimizer senses the directional derivative pointing towards the minimum. Both are the true
  // gradient plus zero-mean Gaussian sensor noise of standard deviation `noise`.
  const signal = isSwimmer ? p.gradient * agent.heading : p.gradient;
  const measurement = signal + p.noise * gaussian(agent.rng);

  // The one line both systems share.
  agent.v = p.beta * agent.v + (1 - p.beta) * measurement * measurement;
  const scale = p.adaptive ? Math.sqrt(agent.v) + p.epsilon : 1;
  const response = measurement / scale;

  let dx = 0;
  let turned = false;
  let demand = 0;

  if (isSwimmer) {
    const raw = p.p0 * Math.exp(-p.lambda * response);
    demand = raw;
    const turnProbability = Math.min(1, Math.max(0, raw));
    // A raw probability above 1 is the response law demanding more turning than a step can
    // deliver. Clipping it is unavoidable, and how often it happens turns out to matter a lot.
    if (raw >= 1) agent.saturated += 1;
    if (agent.rng() < turnProbability) {
      agent.heading = -agent.heading;
      agent.turns += 1;
      turned = true;
    }
    dx = p.speed * agent.heading;
  } else {
    dx = p.eta * response;
  }

  agent.x += dx;
  agent.pathLength += Math.abs(dx);
  agent.responseSq += response * response;
  agent.steps += 1;
  return { x: agent.x, dx, measurement, scale, response, turned, demand };
}

/**
 * @typedef {object} TrialResult
 * @property {number} efficiency      Net displacement divided by path length, in [-1, 1].
 * @property {number} net             Net displacement.
 * @property {number} pathLength      Total distance travelled.
 * @property {number} meanScale       Mean divisor used, averaged over the run.
 * @property {number} meanStepSize    Mean absolute displacement per step. * @property {number} responseRms     RMS of the normalised response over the run.
 * @property {number} saturation      Fraction of swimmer steps whose turn probability was clipped.
 * @property {number} meanRunLength   Mean steps between swimmer turns. * @property {number} steps
 */

/**
 * Run one agent for a fixed number of steps and report the summary statistics.
 *
 * `efficiency` is the chemotactic index: the fraction of the distance travelled that turned into
 * progress. It is scale-free, bounded in [-1, 1], and means the same thing on both sides of the
 * pairing, which is why it is the headline observable.
 *
 * @param {Partial<Params>} overrides
 * @param {number} seed
 * @param {number} steps
 * @returns {TrialResult}
 */
export function runTrial(overrides, seed, steps) {
  const agent = createAgent(overrides, seed);
  const start = agent.x;
  let scaleSum = 0;
  for (let i = 0; i < steps; i += 1) {
    scaleSum += step(agent).scale;
  }
  const net = agent.x - start;
  return {
    efficiency: agent.pathLength === 0 ? 0 : net / agent.pathLength,
    net,
    pathLength: agent.pathLength,
    meanScale: scaleSum / steps,
    meanStepSize: agent.pathLength / steps,
    responseRms: Math.sqrt(agent.responseSq / steps),
    saturation: agent.saturated / steps,
    meanRunLength: agent.turns === 0 ? steps : steps / agent.turns,
    steps,
  };
}

/**
 * Average `runTrial` over several seeds. Every published figure on the page comes through here, so
 * no single lucky seed can carry a claim.
 *
 * @param {Partial<Params>} overrides
 * @param {number[]} seeds
 * @param {number} steps
 * @returns {{ mean: number, min: number, max: number, spread: number, trials: TrialResult[] }}
 */
export function runEnsemble(overrides, seeds, steps) {
  const trials = seeds.map((seed) => runTrial(overrides, seed, steps));
  const values = trials.map((t) => t.efficiency);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { mean, min, max, spread: max - min, trials };
}

/**
 * Noise levels used for every sweep on the page and in the tests. Geometric, so the log-log fit
 * weights each decade evenly.
 * @returns {number[]}
 */
export function noiseLadder() {
  const levels = [];
  for (let i = 0; i <= 12; i += 1) {
    levels.push(0.25 * Math.pow(2, i / 2));
  }
  return levels;
}

/** Seeds used for every published number. Fixed, and all of them are reported. */
export const SEEDS = [11, 23, 47, 91, 137, 211, 307, 419];

/**
 * @typedef {object} SweepPoint
 * @property {number} noise
 * @property {number} efficiency  Mean over seeds.
 * @property {number} min
 * @property {number} max
 * @property {number} meanScale
 * @property {number} meanStepSize
 * @property {number} responseRms
 * @property {number} saturation
 */

/**
 * Measure efficiency across the noise ladder.
 * @param {Partial<Params>} overrides
 * @param {number[]} [seeds]
 * @param {number} [steps]
 * @param {number[]} [levels]
 * @returns {SweepPoint[]}
 */
export function sweepNoise(overrides, seeds = SEEDS, steps = 4000, levels = noiseLadder()) {
  return levels.map((noise) => {
    const ensemble = runEnsemble({ ...overrides, noise }, seeds, steps);
    const meanScale =
      ensemble.trials.reduce((a, t) => a + t.meanScale, 0) / ensemble.trials.length;
    const meanStepSize =
      ensemble.trials.reduce((a, t) => a + t.meanStepSize, 0) / ensemble.trials.length;
    const responseRms =
      ensemble.trials.reduce((a, t) => a + t.responseRms, 0) / ensemble.trials.length;
    const saturation =
      ensemble.trials.reduce((a, t) => a + t.saturation, 0) / ensemble.trials.length;
    return {
      noise,
      efficiency: ensemble.mean,
      min: ensemble.min,
      max: ensemble.max,
      meanScale,
      meanStepSize,
      responseRms,
      saturation,
    };
  });
}

/**
 * @typedef {object} PowerLawFit
 * @property {number} exponent   Slope in log-log space.
 * @property {number} intercept
 * @property {number} r2         Coefficient of determination of the log-log fit.
 * @property {number} points     How many points survived the positivity filter.
 */

/**
 * Least-squares fit of log(y) against log(x).
 *
 * Points with non-positive y are dropped, because they have no logarithm. That is a post-hoc
 * choice and it matters: it is exactly the fixed-gain agent at high noise that goes non-positive,
 * so dropping those points flatters the fixed-gain fit rather than the adaptive one. The page
 * reports how many points each fit actually used for that reason.
 *
 * @param {{ x: number, y: number }[]} points
 * @returns {PowerLawFit}
 */
export function fitPowerLaw(points) {
  const usable = points.filter((p) => p.x > 0 && p.y > 0);
  const n = usable.length;
  if (n < 2) return { exponent: NaN, intercept: NaN, r2: NaN, points: n };
  const xs = usable.map((p) => Math.log(p.x));
  const ys = usable.map((p) => Math.log(p.y));
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) * (xs[i] - mx);
  }
  const exponent = sxy / sxx;
  const intercept = my - exponent * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    const predicted = intercept + exponent * xs[i];
    ssRes += (ys[i] - predicted) * (ys[i] - predicted);
    ssTot += (ys[i] - my) * (ys[i] - my);
  }
  return { exponent, intercept, r2: ssTot === 0 ? NaN : 1 - ssRes / ssTot, points: n };
}

/**
 * Fit only the high-noise tail, where the asymptotic behaviour lives.
 * @param {SweepPoint[]} sweep
 * @param {number} minNoise
 * @returns {PowerLawFit}
 */
export function fitTail(sweep, minNoise) {
  return fitPowerLaw(
    sweep.filter((p) => p.noise >= minNoise).map((p) => ({ x: p.noise, y: p.efficiency }))
  );
}

/**
 * Thresholds quoted in `claims.js` were set from measurement, not from taste. The procedure was:
 * sweep the eight seeds in `SEEDS` at 4000 steps, take the worst seed at each noise level, and then
 * widen by roughly a factor of two on the quantity being bounded. `calibrate.js` in this directory
 * reproduces the sweep that produced them.
 */
export const THRESHOLD_NOTES =
  'Thresholds set from the worst of 8 seeds at 4000 steps, then widened by about 2x.';
