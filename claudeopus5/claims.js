// @ts-check

/**
 * The claims this page makes, written once and executed twice: by `node --test` in CI, and by
 * the reader pressing a button in the browser. Neither is a reimplementation of the other, so a
 * green run on the page means exactly what a green run in CI means.
 */

import { GrainModel, RateAccumulator, weightedLeastSquares, vonNeumannRate } from './grain-model.js';

/**
 * Sized so the fitted line converges: at 224 sites with a short warmup the zero crossing is still
 * contaminated by the artificial Voronoi start and the intercept lands near 0.04 instead of 0.02.
 */
export const RUN = { size: 256, seeds: 1200, sweeps: 1100, seed: 12345, warmup: 400, interval: 20 };

/**
 * Every threshold is the worst value observed across seeds 12345, 777, 4242, 99 and 31337,
 * with headroom, rather than a number tuned until one run went green.
 */
export const EXPECTED = {
  minR2: 0.99,
  maxInterceptFraction: 0.08,
  minK: 0.4,
  maxK: 0.7,
  maxTriangleFidelity: 0.85,
  maxSideExcess: 0.05,
  maxSideDeficit: 0.35,
};

/** Thrown when a claim does not survive contact with the measurement. */
export class ClaimFailure extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'ClaimFailure';
  }
}

/**
 * @param {boolean} condition
 * @param {string} message
 * @returns {asserts condition}
 */
function require(condition, message) {
  if (!condition) throw new ClaimFailure(message);
}

/** @typedef {{ sides: number, relativeArea: number, weight: number }} AreaBin */
/**
 * @typedef {{
 *   model: GrainModel,
 *   rates: RateAccumulator,
 *   meanAreaHistory: { x: number, y: number, weight: number }[],
 *   meanSidesSamples: number[],
 *   strictMeanSidesSamples: number[],
 *   areaBins: AreaBin[],
 *   liveEverIncreased: boolean,
 *   areaAlwaysConserved: boolean
 * }} Measurement
 */

/**
 * Runs the shared simulation, pausing at each census so a browser can keep painting.
 * Node drains it in a tight loop; the page pumps it a slice at a time.
 * @returns {Generator<{ sweep: number, sweeps: number }, Measurement, void>}
 */
export function* measure() {
  const model = new GrainModel({ size: RUN.size, seeds: RUN.seeds, seed: RUN.seed });
  const rates = new RateAccumulator();

  /** @type {{ x: number, y: number, weight: number }[]} */
  const meanAreaHistory = [];
  /** @type {number[]} */
  const meanSidesSamples = [];
  /** @type {number[]} */
  const strictMeanSidesSamples = [];
  /** @type {Map<number, { total: number, samples: number }>} */
  const areaBySides = new Map();

  let liveEverIncreased = false;
  let areaAlwaysConserved = true;
  let previousLive = model.live;

  for (let sweep = 0; sweep <= RUN.sweeps; sweep++) {
    if (sweep % RUN.interval === 0) {
      model.census();
      if (model.totalArea() !== model.siteCount) areaAlwaysConserved = false;
      if (model.live > previousLive) liveEverIncreased = true;
      previousLive = model.live;
      meanSidesSamples.push(model.meanSides);
      strictMeanSidesSamples.push(model.meanSidesAtThreshold(2));

      if (model.time >= RUN.warmup) {
        rates.record(model);
        const mean = model.meanArea();
        meanAreaHistory.push({ x: model.time, y: mean, weight: 1 });
        for (let cell = 0; cell < model.seedCount; cell++) {
          const sides = model.sides[cell];
          if (model.area[cell] > 0 && sides >= 3) {
            let bin = areaBySides.get(sides);
            if (!bin) { bin = { total: 0, samples: 0 }; areaBySides.set(sides, bin); }
            bin.total += model.area[cell] / mean;
            bin.samples++;
          }
        }
      }
      yield { sweep, sweeps: RUN.sweeps };
    }
    model.sweep();
  }

  const areaBins = [...areaBySides]
    .filter(([, bin]) => bin.samples >= 200)
    .map(([sides, bin]) => ({ sides, relativeArea: bin.total / bin.samples, weight: bin.samples }));

  return {
    model, rates, meanAreaHistory, meanSidesSamples, strictMeanSidesSamples,
    areaBins, liveEverIncreased, areaAlwaysConserved,
  };
}

/** @returns {Measurement} */
export function measureNow() {
  const iterator = measure();
  let step = iterator.next();
  while (!step.done) step = iterator.next();
  return step.value;
}

/** @typedef {{ name: string, catches: string, needsMeasurement: boolean, verify: (measurement: Measurement | null) => string }} Claim */

/**
 * Each claim returns the evidence it measured, or throws with the reason it failed.
 * @type {readonly Claim[]}
 */
export const CLAIMS = [
  {
    name: 'the law is flat at six, and only at six',
    catches: 'the headline being backwards',
    needsMeasurement: false,
    verify: () => {
      require(vonNeumannRate(0.539, 6) === 0, 'six-sided cells were not break-even');
      require(vonNeumannRate(0.539, 5) < 0, 'five-sided cells did not shrink');
      require(vonNeumannRate(0.539, 7) > 0, 'seven-sided cells did not grow');
      return 'rate(5) < 0, rate(6) = 0, rate(7) > 0';
    },
  },
  {
    name: 'growth depends on side count and nothing else',
    catches: 'area or shape sneaking into the law',
    needsMeasurement: false,
    verify: () => {
      const highStep = vonNeumannRate(1, 9) - vonNeumannRate(1, 8);
      const lowStep = vonNeumannRate(1, 5) - vonNeumannRate(1, 4);
      require(highStep === lowStep, 'the law was not linear in side count');
      return `equal steps everywhere: ${highStep.toFixed(3)} per side`;
    },
  },
  {
    name: 'the fitter recovers a line it was handed',
    catches: 'a broken least-squares reporting false confidence',
    needsMeasurement: false,
    verify: () => {
      const fit = weightedLeastSquares([
        { x: -1, y: -2, weight: 1 }, { x: 0, y: 0, weight: 1 },
        { x: 1, y: 2, weight: 1 }, { x: 2, y: 4, weight: 1 },
      ]);
      require(fit !== null, 'the fitter refused a valid line');
      require(Math.abs(fit.slope - 2) < 1e-9, `slope came back as ${fit.slope}`);
      require(Math.abs(fit.r2 - 1) < 1e-9, `R^2 came back as ${fit.r2}`);
      return `slope ${fit.slope.toFixed(3)}, R\u00b2 ${fit.r2.toFixed(3)} on a known line`;
    },
  },
  {
    name: 'the fitter refuses one x value instead of inventing a slope',
    catches: 'a fit conjured from data that cannot support one',
    needsMeasurement: false,
    verify: () => {
      const fit = weightedLeastSquares([{ x: 1, y: 1, weight: 1 }, { x: 1, y: 2, weight: 1 }]);
      require(fit === null, 'the fitter invented a slope from a single x');
      return 'returned null rather than a slope';
    },
  },
  {
    name: 'never creates or destroys lattice area',
    catches: 'bookkeeping drift in the census',
    needsMeasurement: true,
    verify: (measurement) => {
      require(measurement !== null, 'no measurement');
      require(measurement.areaAlwaysConserved, 'occupied area drifted away from the lattice size');
      return `every census summed to ${measurement.model.siteCount} sites`;
    },
  },
  {
    name: 'never resurrects a dead cell',
    catches: 'identity leaking between grains',
    needsMeasurement: true,
    verify: (measurement) => {
      require(measurement !== null, 'no measurement');
      require(!measurement.liveEverIncreased, 'the cell count went up');
      return `${RUN.seeds} cells down to ${measurement.model.live}, monotonically`;
    },
  },
  {
    name: 'coarsens rather than sitting still',
    catches: 'a frozen lattice passing every other test',
    needsMeasurement: true,
    verify: (measurement) => {
      require(measurement !== null, 'no measurement');
      const { live } = measurement.model;
      require(live < RUN.seeds * 0.75, `only reached ${live} of ${RUN.seeds} cells`);
      require(live > 20, `ran down to ${live} cells, too coarse to measure`);
      return `${RUN.seeds} cells coarsened to ${live}`;
    },
  },
  {
    name: 'pins the mean side count to six',
    catches: 'the Euler argument being wrong',
    needsMeasurement: true,
    verify: (measurement) => {
      require(measurement !== null, 'no measurement');
      const excess = Math.max(0, ...measurement.meanSidesSamples.map(s => s - 6));
      const deficit = Math.max(0, ...measurement.meanSidesSamples.map(s => 6 - s));
      require(excess < EXPECTED.maxSideExcess, `mean rose ${excess.toFixed(4)} above six`);
      require(deficit < EXPECTED.maxSideDeficit, `mean fell ${deficit.toFixed(4)} below six`);
      require(deficit > excess, 'the ceiling at six was not harder than the floor');
      return `at most +${excess.toFixed(4)} above, \u2212${deficit.toFixed(4)} below`;
    },
  },
  {
    name: 'traces every excursion above six to single-site contacts',
    catches: 'the leak having some cause the page does not name',
    needsMeasurement: true,
    verify: (measurement) => {
      require(measurement !== null, 'no measurement');
      const loose = measurement.meanSidesSamples.filter(s => s > 6 + 1e-9).length;
      const strict = measurement.strictMeanSidesSamples.filter(s => s > 6 + 1e-9).length;
      require(loose > 0, 'the permissive count never breached six, so the page overstates the effect');
      require(strict === 0, `requiring two shared sites still left ${strict} sample(s) above six`);
      return `${loose} of ${measurement.meanSidesSamples.length} above six, ${strict} once corner contacts are excluded`;
    },
  },
  {
    name: 'reproduces dA/dt = k(n \u2212 6)',
    catches: 'the entire thesis of this page',
    needsMeasurement: true,
    verify: (measurement) => {
      require(measurement !== null, 'no measurement');
      const fit = measurement.rates.fit({ min: 5, max: 9 });
      require(fit !== null, 'not enough samples to fit');
      require(fit.r2 >= EXPECTED.minR2, `R^2 was ${fit.r2.toFixed(4)}`);
      require(fit.slope > EXPECTED.minK && fit.slope < EXPECTED.maxK, `k was ${fit.slope.toFixed(4)}`);
      require(Math.abs(fit.intercept) < EXPECTED.maxInterceptFraction * fit.slope,
        `the line missed the zero crossing at six by ${fit.intercept.toFixed(4)}`);
      return `k = ${fit.slope.toFixed(3)}, R\u00b2 = ${fit.r2.toFixed(4)}, zero crossing off by ${(Math.abs(fit.intercept) / fit.slope * 100).toFixed(1)}% of k`;
    },
  },
  {
    name: 'five dies and seven grows in the measured data',
    catches: 'the simulation disagreeing with the headline',
    needsMeasurement: true,
    verify: (measurement) => {
      require(measurement !== null, 'no measurement');
      const five = measurement.rates.meanRate(5);
      const seven = measurement.rates.meanRate(7);
      require(five !== null && seven !== null, 'both bins were not populated');
      require(five < 0, `five-sided cells grew at ${five.toFixed(3)}`);
      require(seven > 0, `seven-sided cells shrank at ${seven.toFixed(3)}`);
      return `five ${five.toFixed(3)}, seven +${seven.toFixed(3)} sites per sweep`;
    },
  },
  {
    name: 'still breaks at three sides',
    catches: 'a published failure quietly going away',
    needsMeasurement: true,
    verify: (measurement) => {
      require(measurement !== null, 'no measurement');
      const fit = measurement.rates.fit({ min: 5, max: 9 });
      const observed = measurement.rates.meanRate(3);
      require(fit !== null && observed !== null, 'no fit or no three-sided bin');
      const fidelity = observed / vonNeumannRate(fit.slope, 3);
      require(fidelity < EXPECTED.maxTriangleFidelity,
        `triangles tracked the law at ${(fidelity * 100).toFixed(0)}%, so the reported breakdown is gone`);
      return `triangles shrank at ${(fidelity * 100).toFixed(0)}% of the predicted rate`;
    },
  },
  {
    name: 'grows mean cell area linearly in time',
    catches: '\u27e8R\u27e9 \u221d \u221at coarsening not holding',
    needsMeasurement: true,
    verify: (measurement) => {
      require(measurement !== null, 'no measurement');
      const fit = weightedLeastSquares(measurement.meanAreaHistory);
      require(fit !== null, 'not enough history to fit');
      require(fit.slope > 0, 'mean area did not grow');
      require(fit.r2 >= EXPECTED.minR2, `area-versus-time R^2 was ${fit.r2.toFixed(4)}`);
      return `linear at R\u00b2 = ${fit.r2.toFixed(4)}`;
    },
  },
  {
    name: "loses Lewis's law to a quadratic",
    catches: 'the claim that Lewis loses',
    needsMeasurement: true,
    verify: (measurement) => {
      require(measurement !== null, 'no measurement');
      const bins = measurement.areaBins;
      require(bins.length >= 3, 'not enough side-count bins to compare fits');
      const linear = weightedLeastSquares(bins.map(b => ({ x: b.sides, y: b.relativeArea, weight: b.weight })));
      const quadratic = weightedLeastSquares(bins.map(b => ({ x: b.sides ** 2, y: b.relativeArea, weight: b.weight })));
      require(linear !== null && quadratic !== null, 'could not fit both curves');
      require(quadratic.r2 > linear.r2,
        `Lewis's linear law won: linear ${linear.r2.toFixed(4)} against quadratic ${quadratic.r2.toFixed(4)}`);
      return `linear R\u00b2 ${linear.r2.toFixed(4)} against quadratic ${quadratic.r2.toFixed(4)}`;
    },
  },
];
