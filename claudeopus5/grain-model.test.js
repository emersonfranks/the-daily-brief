// @ts-check

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { GrainModel, RateAccumulator, weightedLeastSquares, vonNeumannRate } from './grain-model.js';

/**
 * The run every claim below is checked against. Sized so the fitted line actually converges:
 * at 224 sites with a short warmup the zero crossing is still contaminated by the artificial
 * Voronoi start, and the intercept comes out around 0.04 rather than 0.02.
 */
const RUN = { size: 256, seeds: 1200, sweeps: 1100, seed: 12345, warmup: 400, interval: 20 };

/**
 * Thresholds are the worst value observed across seeds 12345, 777, 4242, 99 and 31337,
 * with headroom, rather than numbers tuned to make a single run pass.
 */
const EXPECTED = {
  minR2: 0.99,
  maxInterceptFraction: 0.08,
  minK: 0.4,
  maxK: 0.7,
  maxTriangleFidelity: 0.85,
  maxSideExcess: 0.05,
  maxSideDeficit: 0.35,
};

/**
 * One shared simulation, measured the way the page measures itself. Every claim below is
 * checked against this run rather than against numbers typed in by hand.
 */
function measureRun() {
  const model = new GrainModel({ size: RUN.size, seeds: RUN.seeds, seed: RUN.seed });
  const rates = new RateAccumulator();

  const meanAreaHistory = /** @type {{ x: number, y: number, weight: number }[]} */ ([]);
  const meanSidesSamples = /** @type {number[]} */ ([]);
  const strictMeanSidesSamples = /** @type {number[]} */ ([]);
  const areaBySides = /** @type {Map<number, { total: number, samples: number }>} */ (new Map());
  let liveEverIncreased = false;
  let areaAlwaysConserved = true;
  let previousLive = model.live;

  for (let step = 0; step <= RUN.sweeps; step++) {
    if (step % RUN.interval === 0) {
      model.census();
      if (model.totalArea() !== model.siteCount) areaAlwaysConserved = false;
      if (model.live > previousLive) liveEverIncreased = true;
      previousLive = model.live;
      meanSidesSamples.push(model.meanSides);
      strictMeanSidesSamples.push(model.meanSidesAtThreshold(2));

      if (model.time >= RUN.warmup) {
        rates.record(model);
        meanAreaHistory.push({ x: model.time, y: model.meanArea(), weight: 1 });
        const mean = model.meanArea();
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
    }
    model.sweep();
  }

  return { model, rates, meanAreaHistory, meanSidesSamples, strictMeanSidesSamples, areaBySides, liveEverIncreased, areaAlwaysConserved };
}

describe('the law itself', () => {
  it('is flat at six, negative below, positive above', () => {
    assert.equal(vonNeumannRate(0.539, 6), 0);
    assert.ok(vonNeumannRate(0.539, 5) < 0, 'five must shrink');
    assert.ok(vonNeumannRate(0.539, 7) > 0, 'seven must grow');
  });

  it('does not depend on area or shape, only on side count', () => {
    assert.equal(vonNeumannRate(0.539, 8), vonNeumannRate(0.539, 8));
    assert.equal(vonNeumannRate(1, 9) - vonNeumannRate(1, 8), vonNeumannRate(1, 5) - vonNeumannRate(1, 4));
  });
});

describe('the fitting tool', () => {
  it('recovers a line it was given', () => {
    const fit = weightedLeastSquares([
      { x: -1, y: -2, weight: 1 }, { x: 0, y: 0, weight: 1 },
      { x: 1, y: 2, weight: 1 }, { x: 2, y: 4, weight: 1 },
    ]);
    assert.ok(fit, 'expected a fit');
    assert.ok(Math.abs(fit.slope - 2) < 1e-9);
    assert.ok(Math.abs(fit.intercept) < 1e-9);
    assert.ok(Math.abs(fit.r2 - 1) < 1e-9);
  });

  it('refuses to fit a single x value instead of inventing a slope', () => {
    assert.equal(weightedLeastSquares([{ x: 1, y: 1, weight: 1 }, { x: 1, y: 2, weight: 1 }]), null);
  });
});

describe('the simulation, measured', { timeout: 120000 }, () => {
  /** @type {ReturnType<typeof measureRun>} */
  let run;
  before(() => { run = measureRun(); });

  it('never creates or destroys lattice area', () => {
    assert.ok(run.areaAlwaysConserved, 'total occupied area must always equal the lattice');
  });

  it('never resurrects a dead cell', () => {
    assert.ok(!run.liveEverIncreased, 'cell count must be monotonically non-increasing');
  });

  it('coarsens, rather than sitting still', () => {
    assert.ok(run.model.live < RUN.seeds * 0.75, `expected coarsening, ${run.model.live} of ${RUN.seeds} alive`);
    assert.ok(run.model.live > 20, 'run ended too coarse to measure');
  });

  it('pins the mean side count to six, and leaks upward far less than downward', () => {
    const excess = Math.max(0, ...run.meanSidesSamples.map(sample => sample - 6));
    const deficit = Math.max(0, ...run.meanSidesSamples.map(sample => 6 - sample));
    assert.ok(excess < EXPECTED.maxSideExcess,
      `mean sides rose ${excess.toFixed(4)} above six, further than the lattice artifact explains`);
    assert.ok(deficit < EXPECTED.maxSideDeficit, `mean sides fell ${deficit.toFixed(4)} below six`);
    assert.ok(deficit > excess, 'the ceiling at six should be harder than the floor');
  });

  it('traces every excursion above six to single-site contacts', () => {
    const overshoots = run.meanSidesSamples.filter(sample => sample > 6 + 1e-9).length;
    const strictOvershoots = run.strictMeanSidesSamples.filter(sample => sample > 6 + 1e-9).length;
    assert.ok(overshoots > 0,
      'expected the permissive count to breach six at least once; if it no longer does, the page overstates the effect');
    assert.equal(strictOvershoots, 0,
      `requiring two sites of shared wall left ${strictOvershoots} sample(s) above six, so single-site contacts are not the whole story`);
  });

  it('reproduces dA/dt = k(n-6) over the range the lattice can resolve', () => {
    const fit = run.rates.fit({ min: 5, max: 9 });
    assert.ok(fit, 'expected enough samples to fit');
    assert.ok(fit.r2 >= EXPECTED.minR2, `R^2 was ${fit.r2.toFixed(4)}, expected at least ${EXPECTED.minR2}`);
    assert.ok(fit.slope > EXPECTED.minK && fit.slope < EXPECTED.maxK,
      `k was ${fit.slope.toFixed(4)}, outside the measured range`);
    assert.ok(Math.abs(fit.intercept) < EXPECTED.maxInterceptFraction * fit.slope,
      `line missed the zero crossing at six by ${fit.intercept.toFixed(4)}`);
  });

  it('shows five-sided cells dying and seven-sided cells growing in the measured data', () => {
    const five = run.rates.meanRate(5);
    const seven = run.rates.meanRate(7);
    assert.ok(five !== null && seven !== null, 'expected both bins to be populated');
    assert.ok(five < 0, `five-sided cells grew at ${five}`);
    assert.ok(seven > 0, `seven-sided cells shrank at ${seven}`);
  });

  it('still breaks at three sides, exactly as the page reports', () => {
    const fit = run.rates.fit({ min: 5, max: 9 });
    const observed = run.rates.meanRate(3);
    assert.ok(fit && observed !== null, 'expected a fit and a three-sided bin');
    const predicted = vonNeumannRate(fit.slope, 3);
    const fidelity = observed / predicted;
    assert.ok(fidelity < EXPECTED.maxTriangleFidelity,
      `triangles tracked the law at ${(fidelity * 100).toFixed(0)}%; the page claims they fall well short. ` +
      'The shortfall deepens with lattice size, reaching 39% in the published 512-site run.');
  });

  it('grows mean cell area linearly in time', () => {
    const fit = weightedLeastSquares(run.meanAreaHistory);
    assert.ok(fit, 'expected a fit');
    assert.ok(fit.slope > 0, 'cells must get bigger on average');
    assert.ok(fit.r2 >= 0.99, `area-versus-time R^2 was ${fit.r2.toFixed(4)}`);
  });

  it("loses Lewis's law to a quadratic, as published", () => {
    const points = [...run.areaBySides]
      .filter(([, bin]) => bin.samples >= 200)
      .map(([sides, bin]) => ({ sides, relativeArea: bin.total / bin.samples, weight: bin.samples }));
    assert.ok(points.length >= 3, 'expected enough side-count bins to compare fits');

    const linear = weightedLeastSquares(points.map(p => ({ x: p.sides, y: p.relativeArea, weight: p.weight })));
    const quadratic = weightedLeastSquares(points.map(p => ({ x: p.sides ** 2, y: p.relativeArea, weight: p.weight })));
    assert.ok(linear && quadratic, 'expected both fits');
    assert.ok(quadratic.r2 > linear.r2,
      `Lewis's linear law won this time (linear ${linear.r2.toFixed(4)} vs quadratic ${quadratic.r2.toFixed(4)}) - the page says otherwise`);
  });
});
