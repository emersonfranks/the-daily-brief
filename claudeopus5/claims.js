// @ts-check

/**
 * Every assertion this page makes, as data. `node --test` and the browser panel both import this
 * file, so the reader runs exactly what CI runs.
 *
 * Thresholds are set from measurement, not from taste: each sweep below was run over five seeds
 * (1-5) and six target variabilities before a limit was written down, and the limit is the worst
 * value observed plus headroom. The worst observations are recorded next to each threshold.
 */

import { runNetwork, runBuses, predictedInflation } from './inspection-model.js';

const SEEDS = [1, 2, 3, 4, 5];
const TARGET_CVS = [0, 0.3, 0.6, 0.9, 1.2, 1.5];
const NETWORK = { n: 3000, draws: 60000 };
const BUSES = { buses: 3000, riders: 60000 };

/**
 * @typedef {object} Claim
 * @property {string} name
 * @property {string} catches What a failure of this claim would mean.
 * @property {() => string} verify Returns the evidence it measured, or throws.
 */

/**
 * @param {boolean} condition
 * @param {string} message
 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** @param {number} value */
const pct = (value) => `${(value * 100).toFixed(2)}%`;

/** @type {Claim[]} */
export const claims = [
  {
    name: 'A person reached through a friendship has 1 + CV\u00b2 times the average number of friends',
    catches:
      'If this fails, the friendship paradox is not size-biased sampling and the whole page is wrong. ' +
      'Worst deviation observed over seeds 1-5 was 0.87%; the limit is 4%.',
    verify() {
      let worst = 0;
      let worstAt = '';
      for (const seed of SEEDS) {
        for (const cv of TARGET_CVS) {
          const run = runNetwork({ ...NETWORK, cv, seed });
          const deviation = Math.abs(run.friendshipInflation / run.predicted - 1);
          if (deviation > worst) {
            worst = deviation;
            worstAt = `seed ${seed}, realised CV ${run.cv.toFixed(3)}: measured \u00d7${run.friendshipInflation.toFixed(4)} against predicted \u00d7${run.predicted.toFixed(4)}`;
          }
        }
      }
      assert(worst < 0.04, `worst deviation ${pct(worst)} exceeds 4% (${worstAt})`);
      return `30 runs, worst deviation from 1 + CV\u00b2 was ${pct(worst)}\n${worstAt}`;
    },
  },
  {
    name: 'A passenger arriving at random waits 1 + CV\u00b2 times half the average gap',
    catches:
      'If this fails, the bus half of the pairing is not the same phenomenon. Worst deviation over ' +
      'seeds 1-5 was 2.53%, at a timetable whose own realised CV had run away to 2.47; the limit is 5%.',
    verify() {
      let worst = 0;
      let worstAt = '';
      for (const seed of SEEDS) {
        for (const cv of TARGET_CVS) {
          const run = runBuses({ ...BUSES, cv, seed });
          const deviation = Math.abs(run.inflation / run.predicted - 1);
          if (deviation > worst) {
            worst = deviation;
            worstAt = `seed ${seed}, realised CV ${run.cv.toFixed(3)}: waited \u00d7${run.inflation.toFixed(4)} against predicted \u00d7${run.predicted.toFixed(4)}`;
          }
        }
      }
      assert(worst < 0.05, `worst deviation ${pct(worst)} exceeds 5% (${worstAt})`);
      return `30 runs, worst deviation from 1 + CV\u00b2 was ${pct(worst)}\n${worstAt}`;
    },
  },
  {
    name: 'Both systems sit on one curve, each measured against its own variability',
    catches:
      'The cross-domain claim. A failure would mean the two inflations are separate coincidences ' +
      'rather than one formula. Note what is NOT asserted: the two raw inflations are not compared ' +
      'to each other, because a 3000-bus timetable and a 3000-person network drawn at the same ' +
      'target do not end up with the same realised CV.',
    verify() {
      let worst = 0;
      let worstAt = '';
      /** @type {string[]} */
      const rows = [];
      for (const cv of TARGET_CVS) {
        const network = runNetwork({ ...NETWORK, cv, seed: 1 });
        const buses = runBuses({ ...BUSES, cv, seed: 1 });
        for (const [label, measured, predicted, realised] of /** @type {[string, number, number, number][]} */ ([
          ['friends', network.friendshipInflation, network.predicted, network.cv],
          ['waits', buses.inflation, buses.predicted, buses.cv],
        ])) {
          const deviation = Math.abs(measured / predicted - 1);
          if (deviation > worst) {
            worst = deviation;
            worstAt = `${label} at realised CV ${realised.toFixed(3)}`;
          }
        }
        rows.push(
          `CV ${network.cv.toFixed(2)} \u2192 friends \u00d7${network.friendshipInflation.toFixed(3)} (pred \u00d7${network.predicted.toFixed(3)})  |  ` +
            `CV ${buses.cv.toFixed(2)} \u2192 waits \u00d7${buses.inflation.toFixed(3)} (pred \u00d7${buses.predicted.toFixed(3)})`,
        );
      }
      assert(worst < 0.04, `worst deviation ${pct(worst)} exceeds 4% (${worstAt})`);
      return `${rows.join('\n')}\nworst deviation across both domains: ${pct(worst)} (${worstAt})`;
    },
  },
  {
    name: 'Take the variability away and both paradoxes vanish',
    catches:
      'This is the falsifier. If a regular network and a perfectly punctual timetable still showed ' +
      'inflation, the effect would be coming from somewhere other than variance and the explanation ' +
      'on this page would be wrong. Worst residual observed was 0.57%; the limit is 2%.',
    verify() {
      let worst = 0;
      /** @type {string[]} */
      const rows = [];
      for (const seed of SEEDS) {
        const network = runNetwork({ ...NETWORK, cv: 0, seed });
        const buses = runBuses({ ...BUSES, cv: 0, seed });
        worst = Math.max(worst, Math.abs(network.friendshipInflation - 1), Math.abs(buses.inflation - 1));
        rows.push(`seed ${seed}: friends \u00d7${network.friendshipInflation.toFixed(4)}, waits \u00d7${buses.inflation.toFixed(4)}`);
      }
      assert(worst < 0.02, `residual inflation of ${pct(worst)} at zero variability exceeds 2%`);
      assert(predictedInflation(0) === 1, 'the formula itself must give exactly 1 at CV = 0');
      return `${rows.join('\n')}\nlargest residual: ${pct(worst)} away from \u00d71.0000`;
    },
  },
  {
    name: 'Sampling people directly shows no inflation at all',
    catches:
      'The control. Popular people existing is not the paradox; reaching people through their ' +
      'friendships is. If uniform sampling also came out high, the bias would be in the graph ' +
      'generator rather than in the sampling. Worst deviation observed was 0.81%; the limit is 2%.',
    verify() {
      let worst = 0;
      let worstAt = '';
      for (const seed of SEEDS) {
        for (const cv of TARGET_CVS) {
          const run = runNetwork({ ...NETWORK, cv, seed });
          const deviation = Math.abs(run.uniformMean / run.meanDegree - 1);
          if (deviation > worst) {
            worst = deviation;
            worstAt = `seed ${seed}, realised CV ${run.cv.toFixed(3)}: \u00d7${(run.uniformMean / run.meanDegree).toFixed(4)}`;
          }
        }
      }
      assert(worst < 0.02, `uniform sampling drifted ${pct(worst)} from \u00d71, above the 2% limit`);
      return `30 runs, worst drift from \u00d71.0000 was ${pct(worst)}\n${worstAt}`;
    },
  },
  {
    name: 'Make popular people befriend popular people and the everyday version dies',
    catches:
      'The prediction that failed, kept as a test. "Ask a person about their friends" was expected ' +
      'to differ from friendship sampling in an ordinary network; it did not. It only breaks when ' +
      'degrees are correlated across friendships, and then it breaks completely.',
    verify() {
      /** @type {string[]} */
      const rows = [];
      let worstFriendshipDrift = 0;
      let strongestSurvivingPersonView = 0;
      for (const seed of SEEDS) {
        const mixed = runNetwork({ ...NETWORK, cv: 1.2, seed, assortativity: 1 });
        worstFriendshipDrift = Math.max(worstFriendshipDrift, Math.abs(mixed.friendshipInflation / mixed.predicted - 1));
        strongestSurvivingPersonView = Math.max(strongestSurvivingPersonView, mixed.personThenFriendInflation);
        rows.push(
          `seed ${seed}: assortativity r = ${mixed.assortativity.toFixed(3)}, ` +
            `friendship sampling \u00d7${mixed.friendshipInflation.toFixed(3)} (pred \u00d7${mixed.predicted.toFixed(3)}), ` +
            `person-then-friend \u00d7${mixed.personThenFriendInflation.toFixed(3)}`,
        );
      }
      assert(
        worstFriendshipDrift < 0.03,
        `friendship sampling should be untouched by mixing, but drifted ${pct(worstFriendshipDrift)}`,
      );
      assert(
        strongestSurvivingPersonView < 1.05,
        `person-then-friend sampling should collapse to \u00d71 under perfect mixing, but reached \u00d7${strongestSurvivingPersonView.toFixed(3)}`,
      );
      return `${rows.join('\n')}\nfriendship sampling held to within ${pct(worstFriendshipDrift)}; person-then-friend fell to at most \u00d7${strongestSurvivingPersonView.toFixed(3)}`;
    },
  },
  {
    name: 'What gets unreliable at high variability is the input, not the law',
    catches:
      'An honest caveat, encoded so it cannot be quietly dropped. Ask for a heavy-tailed timetable ' +
      'and the timetable you actually get has a realised CV that wanders a long way from what was ' +
      'requested. The law still holds \u2014 but only when measured against the CV that occurred.',
    verify() {
      let worstInputDrift = 0;
      let worstLawDrift = 0;
      let worstAt = '';
      for (const seed of SEEDS) {
        const run = runBuses({ ...BUSES, cv: 1.5, seed });
        const inputDrift = Math.abs(run.cv / 1.5 - 1);
        if (inputDrift > worstInputDrift) {
          worstInputDrift = inputDrift;
          worstAt = `seed ${seed}: asked for CV 1.500, got ${run.cv.toFixed(3)}`;
        }
        worstLawDrift = Math.max(worstLawDrift, Math.abs(run.inflation / run.predicted - 1));
      }
      assert(worstInputDrift > 0.05, 'the caveat is only worth recording if the input really does drift');
      assert(worstLawDrift < 0.05, `the law drifted ${pct(worstLawDrift)} against the realised CV, above 5%`);
      return `requested CV missed by up to ${pct(worstInputDrift)} (${worstAt})\nyet against the realised CV the law held to ${pct(worstLawDrift)}`;
    },
  },
];
