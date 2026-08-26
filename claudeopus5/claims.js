// @ts-check
import {
  makeRng,
  sampleGaps,
  degreeSequence,
  configurationModel,
  adjacency,
  rewireAssortative,
  landedGaps,
  meanOf,
  cvOf,
  sizeBiasedMean,
  predictedInflation,
  edgeEndpointMeanDegree,
  personAveragedFriendDegree,
  degreeAssortativity,
} from './sizebias.js';

/**
 * @typedef {{ id: string, title: string, catches: string, threshold: string, verify: () => Record<string, string> }} Claim
 */

/**
 * @param {number} x
 * @param {number} places
 * @returns {string}
 */
function num(x, places) {
  return Number(x).toFixed(places);
}

/**
 * @param {boolean} ok
 * @param {string} message
 */
function must(ok, message) {
  if (!ok) throw new Error(message);
}

/** @type {Claim[]} */
export const claims = [
  {
    id: 'algebraic-identity',
    title: 'The inflation factor is algebra, not an approximation',
    catches:
      'Catches this page overstating its own result. If size-biasing were only approximately 1 + CV squared, every headline number here would be a fit rather than an identity.',
    threshold: 'Relative error below 1e-12. Worst observed across 20 runs when thresholds were set: 1.5e-14.',
    verify() {
      let worst = 0;
      for (const cv of [0.2, 0.6, 1.0, 1.4, 1.6]) {
        for (const seed of [1, 2, 3, 4]) {
          const gaps = sampleGaps(makeRng(seed), 4000, 10, cv);
          const lhs = sizeBiasedMean(gaps) / meanOf(gaps);
          const rhs = predictedInflation(gaps);
          worst = Math.max(worst, Math.abs(lhs / rhs - 1));
        }
      }
      must(worst < 1e-12, `identity broke: relative error ${worst.toExponential(2)}`);
      return { 'worst relative error': worst.toExponential(2), threshold: '1e-12' };
    },
  },
  {
    id: 'arrivals-land-in-big-gaps',
    title: 'A random arrival really does land in an inflated gap',
    catches:
      'Catches the claim being a property of the formula but not of the world. The timetable is untouched here; only the passenger is random.',
    threshold: 'Relative error below 1.5% at 200,000 arrivals. Worst observed across 80 runs: 0.50%.',
    verify() {
      let worst = 0;
      let sample = 0;
      let samplePred = 0;
      for (const cv of [0.2, 0.8, 1.6]) {
        for (const seed of [1, 2, 3]) {
          const gaps = sampleGaps(makeRng(seed), 4000, 10, cv);
          const landed = landedGaps(makeRng(seed * 104729), gaps, 200000);
          const measured = meanOf(landed) / meanOf(gaps);
          const predicted = predictedInflation(gaps);
          if (cv === 0.8 && seed === 1) {
            sample = measured;
            samplePred = predicted;
          }
          worst = Math.max(worst, Math.abs(measured / predicted - 1));
        }
      }
      must(worst < 0.015, `arrival sampling missed the formula by ${num(worst * 100, 2)}%`);
      return {
        'worst relative error': `${num(worst * 100, 3)}%`,
        threshold: '1.5%',
        'example at CV 0.8': `measured ${num(sample, 4)} against predicted ${num(samplePred, 4)}`,
      };
    },
  },
  {
    id: 'random-friendship-is-exact',
    title: 'Sampling a random friendship is the same operator, exactly',
    catches:
      'Catches the network side being a loose analogy. Picking a friendship at random and reading one end of it must equal sum of k squared over sum of k on the nose, for any wiring at all.',
    threshold: 'Relative error below 1e-12, including on a network rewired to degree assortativity above 0.6.',
    verify() {
      let worst = 0;
      let worstR = 0;
      for (const cv of [0.4, 0.8, 1.4]) {
        for (const seed of [1, 2, 3]) {
          const rng = makeRng(seed);
          const degrees = degreeSequence(rng, 4000, 6, cv);
          const neutral = configurationModel(rng, degrees);
          const sorted = rewireAssortative(rng, neutral, 20000);
          for (const g of [neutral, sorted]) {
            worst = Math.max(worst, Math.abs(edgeEndpointMeanDegree(g) / sizeBiasedMean(g.degrees) - 1));
          }
          worstR = Math.max(worstR, degreeAssortativity(sorted));
        }
      }
      must(worst < 1e-12, `edge-endpoint sampling drifted by ${worst.toExponential(2)}`);
      return {
        'worst relative error': worst.toExponential(2),
        threshold: '1e-12',
        'held up to assortativity': `r = ${num(worstR, 3)}`,
      };
    },
  },
  {
    id: 'asking-each-person-neutral',
    title: 'On an unsorted network, asking each person also matches',
    catches:
      'Catches the friendship paradox being asserted for the everyday version of the question when only the edge-weighted version was ever tested.',
    threshold: 'Relative error below 4% at 4,000 people. Worst observed across 80 runs: 1.83%.',
    verify() {
      let worst = 0;
      for (const cv of [0.2, 0.8, 1.6]) {
        for (const seed of [1, 2, 3]) {
          const rng = makeRng(seed);
          const degrees = degreeSequence(rng, 4000, 6, cv);
          const graph = configurationModel(rng, degrees);
          const measured = personAveragedFriendDegree(adjacency(graph), degrees) / meanOf(degrees);
          worst = Math.max(worst, Math.abs(measured / predictedInflation(degrees) - 1));
        }
      }
      must(worst < 0.04, `person-averaged sampling missed by ${num(worst * 100, 2)}%`);
      return { 'worst relative error': `${num(worst * 100, 2)}%`, threshold: '4%' };
    },
  },
  {
    id: 'sorting-breaks-the-everyday-version',
    title: 'Sorting friends by popularity breaks the everyday version and not the exact one',
    catches:
      'This is the published failure. It catches the page pretending one clean law covers both ways of asking the question.',
    threshold:
      'At CV of 0.6 and above, the person-averaged answer must move more than 10% off the formula while random-friendship sampling stays within 1e-12. Smallest deviation observed across 60 runs: 18.7%.',
    verify() {
      let minDeviation = Infinity;
      let worstExact = 0;
      let worstR = 0;
      for (const cv of [0.6, 1.0, 1.4]) {
        for (const seed of [1, 2, 3, 4]) {
          const rng = makeRng(seed);
          const degrees = degreeSequence(rng, 4000, 6, cv);
          const sorted = rewireAssortative(rng, configurationModel(rng, degrees), 20000);
          const person = personAveragedFriendDegree(adjacency(sorted), degrees) / meanOf(degrees);
          minDeviation = Math.min(minDeviation, Math.abs(person / predictedInflation(degrees) - 1));
          worstExact = Math.max(worstExact, Math.abs(edgeEndpointMeanDegree(sorted) / sizeBiasedMean(degrees) - 1));
          worstR = Math.max(worstR, degreeAssortativity(sorted));
        }
      }
      must(minDeviation > 0.1, `sorting failed to break it: smallest deviation only ${num(minDeviation * 100, 2)}%`);
      must(worstExact < 1e-12, `sorting also broke the exact route by ${worstExact.toExponential(2)}`);
      return {
        'smallest deviation of the everyday answer': `${num(minDeviation * 100, 1)}%`,
        threshold: 'above 10%',
        'random-friendship answer meanwhile': `${worstExact.toExponential(2)} relative error`,
        'assortativity reached': `r up to ${num(worstR, 3)}`,
      };
    },
  },
  {
    id: 'no-spread-no-illusion',
    title: 'Remove the spread and the illusion disappears',
    catches:
      'This is the falsifier. If the inflation were an artefact of the sampler rather than of the spread, it would survive here. It must not.',
    threshold: 'At CV 0.05 both systems must sit within 1% of 1.0. Worst observed: 0.27%.',
    verify() {
      let worst = 0;
      for (const seed of [1, 2, 3, 4]) {
        const gaps = sampleGaps(makeRng(seed), 4000, 10, 0.05);
        const bus = meanOf(landedGaps(makeRng(seed * 31), gaps, 100000)) / meanOf(gaps);
        const rng = makeRng(seed);
        const degrees = degreeSequence(rng, 4000, 6, 0.05);
        const net = edgeEndpointMeanDegree(configurationModel(rng, degrees)) / meanOf(degrees);
        worst = Math.max(worst, Math.abs(bus - 1), Math.abs(net - 1));
      }
      must(worst < 0.01, `inflation survived zero spread: ${num(worst * 100, 2)}%`);
      return { 'worst deviation from 1.0': `${num(worst * 100, 3)}%`, threshold: '1%' };
    },
  },
  {
    id: 'matched-spread-matches-worlds',
    title: 'Matched on spread, the two worlds report the same inflation',
    catches:
      'This is the pairing claim itself. It catches the two panels being driven by one slider while secretly sitting at different spreads, which is exactly what happens at the top of the range.',
    threshold: 'Agreement within 12% once the realised spreads are matched. Worst observed across 40 runs: 7.1%.',
    verify() {
      let worst = 0;
      let sampleBus = 0;
      let sampleNet = 0;
      for (const cv of [0.4, 0.8, 1.2, 1.6]) {
        for (const seed of [1, 2, 3]) {
          const rng = makeRng(seed);
          const degrees = degreeSequence(rng, 4000, 6, cv);
          const graph = configurationModel(rng, degrees);
          const gaps = sampleGaps(makeRng(seed * 17), 6000, 10, cvOf(degrees));
          const bus = meanOf(landedGaps(makeRng(seed * 97), gaps, 100000)) / meanOf(gaps);
          const net = edgeEndpointMeanDegree(graph) / meanOf(degrees);
          if (cv === 0.8 && seed === 1) {
            sampleBus = bus;
            sampleNet = net;
          }
          worst = Math.max(worst, Math.abs(bus / net - 1));
        }
      }
      must(worst < 0.12, `the two worlds disagreed by ${num(worst * 100, 2)}%`);
      return {
        'worst disagreement': `${num(worst * 100, 2)}%`,
        threshold: '12%',
        'example at CV 0.8': `buses ${num(sampleBus, 3)} against friends ${num(sampleNet, 3)}`,
      };
    },
  },
];
