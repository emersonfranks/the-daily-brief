// @ts-check

/**
 * Every assertion this page makes, as data. Each claim states what it catches
 * and returns the evidence it measured, or throws. No DOM and no test runner is
 * imported here, so `node --test` and the browser proof panel execute the same
 * code against the same thresholds.
 *
 * Thresholds are set from measured seed spread with headroom, and each one
 * records the run it came from.
 */

import {
  jamKerb,
  jamPoliteKerb,
  jamDimerLattice,
  kerbCoverageCurve,
  membraneCoverageCurve,
  createMembrane,
  createKerb,
  attemptAdsorb,
  attemptPark,
  kerbCoverage,
  checkKerbInvariant,
  checkMembraneInvariant,
  makeRandom,
  RENYI_CONSTANT,
  FLORY_DIMER_COVERAGE,
  DISK_JAMMING_COVERAGE,
  PALASTI_CONJECTURE,
} from './rsa.js';
import { summarise, linearFit, logSpace } from './analysis.js';

const SEEDS_8 = [1, 2, 3, 4, 5, 6, 7, 8];
const SEEDS_4 = [1, 2, 3, 4];

/** @param {number} v @param {number} [dp] */
const fx = (v, dp = 4) => Number(v.toFixed(dp));

/**
 * @param {boolean} ok
 * @param {string} message
 */
function require(ok, message) {
  if (!ok) throw new Error(message);
}

/**
 * @typedef {Object} Claim
 * @property {string} id
 * @property {string} title
 * @property {string} catches      what a failure of this claim would mean
 * @property {() => Record<string, unknown>} verify returns evidence, or throws
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'renyi-parking-constant',
    title: 'Random parking jams at 74.76% of the kerb',
    catches:
      'An acceptance test that lets cars overlap, or a placement rule that is not uniform, would push the ceiling away from Rényi\u2019s constant.',
    verify() {
      const runs = SEEDS_8.map((s) => jamKerb(4000, s).coverage);
      const stats = summarise(runs);
      // Threshold: 0.006. Worst single seed observed over 8 runs was 0.7508,
      // i.e. 0.0033 from the constant; the mean sits 0.0002 away.
      const delta = Math.abs(stats.mean - RENYI_CONSTANT);
      require(delta <= 0.006, `mean coverage ${fx(stats.mean, 5)} is ${fx(delta, 5)} from Rényi's ${fx(RENYI_CONSTANT, 5)}`);
      return {
        'measured jamming coverage': fx(stats.mean, 5),
        'Rényi\u2019s constant': fx(RENYI_CONSTANT, 5),
        'gap': fx(delta, 5),
        'seed spread (sd)': fx(stats.sd, 5),
        'runs': `${stats.n} streets of 4000 car lengths`,
      };
    },
  },

  {
    id: 'flory-dimer-coverage',
    title: 'Dimers on a lattice jam at 1 − e⁻² = 86.47%',
    catches:
      'The discrete case has a closed form Flory derived in 1939. Missing it would mean the lattice version is not really doing sequential adsorption.',
    verify() {
      const runs = SEEDS_8.map((s) => jamDimerLattice(20000, s).coverage);
      const stats = summarise(runs);
      const delta = Math.abs(stats.mean - FLORY_DIMER_COVERAGE);
      // Threshold: 0.006, against an observed seed sd of 0.0017.
      require(delta <= 0.006, `mean coverage ${fx(stats.mean, 5)} is ${fx(delta, 5)} from 1 − e⁻²`);
      return {
        'measured coverage': fx(stats.mean, 5),
        '1 − e⁻²': fx(FLORY_DIMER_COVERAGE, 5),
        'gap': fx(delta, 5),
        'seed spread (sd)': fx(stats.sd, 5),
        'runs': `${stats.n} lattices of 20000 sites`,
      };
    },
  },

  {
    id: 'palasti-conjecture-fails',
    title: 'Discs jam at 54.7%, not at Palásti\u2019s conjectured 55.9%',
    catches:
      'Palásti conjectured in 1960 that the two-dimensional limit is the square of the one-dimensional one. If our extrapolation landed on 0.5589 the conjecture would survive this test.',
    verify() {
      const times = logSpace(50, 2000, 16);
      // Feder's law is imposed here, not tested: with the exponent fixed at 1/2,
      // coverage is linear in t^(-1/2) and the intercept is the jamming limit.
      const perSeed = SEEDS_4.map((s) => {
        const curve = membraneCoverageCurve(40, s, times);
        return linearFit(curve.map((p) => p.t ** -0.5), curve.map((p) => p.coverage)).intercept;
      });
      const stats = summarise(perSeed);
      const delta = Math.abs(stats.mean - DISK_JAMMING_COVERAGE);
      // Thresholds: 0.010 against the accepted value (observed 0.00003), and
      // every individual seed below Palásti (worst observed 0.5534, margin 0.0055).
      require(delta <= 0.01, `extrapolated limit ${fx(stats.mean, 5)} is ${fx(delta, 5)} from the accepted 0.54707`);
      require(stats.max < PALASTI_CONJECTURE, `a seed reached ${fx(stats.max, 5)}, at or above Palásti's ${fx(PALASTI_CONJECTURE, 5)}`);
      return {
        'extrapolated jamming coverage': fx(stats.mean, 5),
        'accepted value': fx(DISK_JAMMING_COVERAGE, 5),
        'Palásti\u2019s conjecture': fx(PALASTI_CONJECTURE, 5),
        'highest seed': fx(stats.max, 5),
        'distance to Palásti': fx(Math.abs(stats.mean - PALASTI_CONJECTURE), 5),
        'runs': `${stats.n} periodic patches of 40 × 40 diameters, to t = 2000`,
      };
    },
  },

  {
    id: 'feder-exponent-one-dimension',
    title: 'The crawl toward jamming is a power law with exponent ≈ 1',
    catches:
      'If the approach were exponential the last gaps would fill quickly and the ceiling would be an accident of run length rather than a real limit.',
    verify() {
      const times = logSpace(50, 3000, 14);
      const alphas = SEEDS_8.map((s) => {
        // theta_J is measured by running the same seed to a full jam, so the
        // regression has one free parameter instead of the degenerate three.
        const jam = jamKerb(6000, s).coverage;
        const curve = kerbCoverageCurve(6000, s, times);
        /** @type {number[]} */ const lx = [];
        /** @type {number[]} */ const ly = [];
        for (const p of curve) {
          const deficit = jam - p.coverage;
          if (deficit > 0) {
            lx.push(Math.log(p.t));
            ly.push(Math.log(deficit));
          }
        }
        return -linearFit(lx, ly).slope;
      });
      const stats = summarise(alphas);
      // Threshold: 0.35 on the mean. Observed mean 1.089, seed sd 0.172, with
      // individual seeds ranging 0.88 to 1.42 — the spread is real, so the claim
      // is made on the mean and the spread is reported alongside it.
      require(Math.abs(stats.mean - 1) <= 0.35, `fitted exponent ${fx(stats.mean, 3)} is not within 0.35 of 1`);
      return {
        'fitted exponent': fx(stats.mean, 3),
        'Feder\u2019s prediction (1/d, d = 1)': 1,
        'seed spread (sd)': fx(stats.sd, 3),
        'seed range': `${fx(stats.min, 3)} to ${fx(stats.max, 3)}`,
        'runs': `${stats.n} streets of 6000 car lengths, fitted over t = 50 to 3000`,
      };
    },
  },

  {
    id: 'ceiling-is-scale-free',
    title: 'The ceiling does not depend on how long the street is',
    catches:
      'If the limit moved with street length it would be a boundary artefact of one particular simulation rather than a property of the process.',
    verify() {
      const short = summarise(SEEDS_8.map((s) => jamKerb(1000, s).coverage));
      const long = summarise(SEEDS_8.map((s) => jamKerb(4000, s).coverage));
      const delta = Math.abs(short.mean - long.mean);
      // Threshold: 0.012. The short street's own seed sd is 0.009, so anything
      // tighter would be testing noise; the observed difference is 0.0004.
      require(delta <= 0.012, `1000-length streets jam at ${fx(short.mean, 5)} but 4000-length at ${fx(long.mean, 5)}`);
      return {
        'coverage, 1000 car lengths': fx(short.mean, 5),
        'coverage, 4000 car lengths': fx(long.mean, 5),
        'difference': fx(delta, 5),
        'spread of the shorter street (sd)': fx(short.sd, 5),
        'runs': `${short.n} streets at each length`,
      };
    },
  },

  {
    id: 'coordination-recovers-the-gap',
    title: 'Parking flush against a neighbour recovers the missing quarter',
    catches:
      'The shortfall must be caused by where drivers stop, not by the cars. If courteous parking also jammed near 75% the story would be about geometry rather than about irreversible random choice.',
    verify() {
      const random = summarise(SEEDS_4.map((s) => jamKerb(4000, s).coverage));
      const polite = summarise(SEEDS_4.map((s) => jamPoliteKerb(4000, s).coverage));
      const gain = polite.mean - random.mean;
      // Thresholds: flush parking above 0.98 (observed 0.99975) and a gain of
      // at least 0.20 over random parking (observed 0.252).
      require(polite.mean >= 0.98, `flush parking only reached ${fx(polite.mean, 5)}`);
      require(gain >= 0.2, `flush parking gained only ${fx(gain, 5)} over random parking`);
      return {
        'random parking': fx(random.mean, 5),
        'flush parking': fx(polite.mean, 5),
        'kerb recovered': fx(gain, 5),
        'runs': `${random.n} streets of 4000 car lengths each way`,
      };
    },
  },

  {
    id: 'animated-path-agrees',
    title: 'The street you watch fill is the same process as the one measured',
    catches:
      'Every other kerb check uses a shortcut that skips over failed attempts analytically. The panel above instead simulates each refused driver so you can see the rejections. If those two disagreed, the animation would be a decoration rather than the experiment.',
    verify() {
      const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const coverages = [];
      let tightest = Infinity;
      for (const seed of seeds) {
        const kerb = createKerb(1200);
        const rand = makeRandom(seed);
        let guard = 0;
        while (!kerb.jammed && guard < 1200 * 20000) {
          attemptPark(kerb, rand);
          guard += 1;
        }
        require(kerb.jammed, `seed ${seed} ran out of attempts before the street jammed`);
        const invariant = checkKerbInvariant(kerb);
        require(invariant.ok, `seed ${seed} parked two cars on top of each other`);
        tightest = Math.min(tightest, invariant.minGap);
        coverages.push(kerbCoverage(kerb));
      }
      const stats = summarise(coverages);
      const delta = Math.abs(stats.mean - RENYI_CONSTANT);
      // Threshold: 0.008, about five standard errors of the observed seed sd
      // (0.0048 over 12 streets). The observed gap is 0.0016.
      require(delta <= 0.008, `simulating every refusal gives ${fx(stats.mean, 5)}, ${fx(delta, 5)} from the shortcut's answer`);
      return {
        'coverage, every refusal simulated': fx(stats.mean, 5),
        'R\u00e9nyi\u2019s constant': fx(RENYI_CONSTANT, 5),
        'gap': fx(delta, 5),
        'seed spread (sd)': fx(stats.sd, 5),
        'tightest gap between cars': fx(tightest, 8),
        'runs': `${stats.n} streets of 1200 car lengths, driven to a genuine jam`,
      };
    },
  },

  {
    id: 'nothing-overlaps',
    title: 'No car and no molecule ever overlaps its neighbour',
    catches:
      'This is the invariant every coverage number on the page rests on. A rejection test that is off by a rounding error would silently inflate all of them.',
    verify() {
      const kerb = jamKerb(2000, 9).kerb;
      const kerbCheck = checkKerbInvariant(kerb);
      require(kerbCheck.ok, `two parked cars overlap by ${fx(-kerbCheck.minGap, 8)}`);

      const membrane = createMembrane(20);
      const rand = makeRandom(9);
      for (let i = 0; i < 200000; i += 1) attemptAdsorb(membrane, rand);
      const membraneCheck = checkMembraneInvariant(membrane);
      require(membraneCheck.ok, `two discs sit ${fx(membraneCheck.minCentreDistance, 8)} apart, closer than one diameter`);

      return {
        'cars parked': kerb.cars.length,
        'tightest gap between cars': fx(kerbCheck.minGap, 8),
        'discs adsorbed': membrane.xs.length,
        'closest disc centres (one diameter = 1)': fx(membraneCheck.minCentreDistance, 8),
      };
    },
  },

  {
    id: 'runs-are-reproducible',
    title: 'A seed reproduces exactly, and different seeds genuinely differ',
    catches:
      'Every threshold above is quoted against a fixed seed set. If the stream were not deterministic those numbers would describe a run nobody can repeat.',
    verify() {
      const a = jamKerb(1500, 42);
      const b = jamKerb(1500, 42);
      const c = jamKerb(1500, 43);
      require(a.cars === b.cars && a.attempts === b.attempts, 'the same seed produced two different streets');

      const kerb = createKerb(200);
      const rand = makeRandom(7);
      let parked = 0;
      for (let i = 0; i < 5000; i += 1) if (attemptPark(kerb, rand)) parked += 1;
      require(parked === kerb.cars.length, 'the attempt counter and the car list disagree');
      require(a.cars !== c.cars, 'two different seeds produced identical streets');

      return {
        'seed 42, first run': `${a.cars} cars after ${a.attempts} attempts`,
        'seed 42, second run': `${b.cars} cars after ${b.attempts} attempts`,
        'seed 43': `${c.cars} cars`,
        'rejection sampling agrees with the car list': `${parked} parked from 5000 attempts`,
      };
    },
  },
];
