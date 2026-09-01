// @ts-check

import { createExperiment } from './memory.js';

const NET_TOLERANCE = 1e-11;
const LAW_TOLERANCE = 1e-9;

/**
 * @typedef {object} Claim
 * @property {string} name
 * @property {string} catches
 * @property {() => string} verify
 */

/** @type {Claim[]} */
export const claims = [
  {
    name: 'Equal pulses cancel',
    catches: 'An unbalanced waveform masquerading as memory.',
    verify() {
      let worstNet = 0;
      let runCount = 0;
      for (const amplitude of [1, 3, 5]) {
        for (const separation of [2, 7, 12]) {
          for (const order of /** @type {const} */ (['credit-first', 'debit-first'])) {
            const result = createExperiment({ amplitude, separation, order });
            worstNet = Math.max(worstNet, Math.abs(result.net));
            runCount += 1;
          }
        }
      }
      if (worstNet >= NET_TOLERANCE) {
        throw new Error(`Worst residual ${worstNet.toExponential(3)} exceeds ${NET_TOLERANCE}`);
      }
      return `${runCount} runs; worst residual ${worstNet.toExponential(3)}`;
    },
  },
  {
    name: 'Memory equals amplitude times gap',
    catches: 'A visual effect that does not obey the first-moment law.',
    verify() {
      let worstError = 0;
      for (const amplitude of [1, 2, 3, 4, 5]) {
        for (const separation of [2, 4, 6, 8, 10, 12]) {
          const result = createExperiment({ amplitude, separation, order: 'credit-first' });
          worstError = Math.max(worstError, Math.abs(result.memory - amplitude * separation));
        }
      }
      if (worstError >= LAW_TOLERANCE) {
        throw new Error(`Worst law error ${worstError.toExponential(3)} exceeds ${LAW_TOLERANCE}`);
      }
      return `30 settings; worst law error ${worstError.toExponential(3)}`;
    },
  },
  {
    name: 'First moment and held balance agree',
    catches: 'The two domain readings drifting into different mathematics.',
    verify() {
      let worstMismatch = 0;
      for (const separation of [2, 5, 8, 12]) {
        const result = createExperiment({ amplitude: 4, separation, order: 'credit-first' });
        worstMismatch = Math.max(worstMismatch, Math.abs(result.memory + result.firstMoment));
      }
      if (worstMismatch >= LAW_TOLERANCE) {
        throw new Error(`Worst mismatch ${worstMismatch.toExponential(3)} exceeds ${LAW_TOLERANCE}`);
      }
      return `4 gaps; worst mismatch ${worstMismatch.toExponential(3)}`;
    },
  },
  {
    name: 'Order reverses the memory',
    catches: 'A sign convention that ignores which pulse arrived first.',
    verify() {
      const positiveFirst = createExperiment({ amplitude: 3, separation: 9, order: 'credit-first' });
      const negativeFirst = createExperiment({ amplitude: 3, separation: 9, order: 'debit-first' });
      const reversalError = Math.abs(positiveFirst.memory + negativeFirst.memory);
      if (reversalError >= LAW_TOLERANCE || positiveFirst.memory <= 0 || negativeFirst.memory >= 0) {
        throw new Error(`Reversal error ${reversalError.toExponential(3)}`);
      }
      return `memories ${positiveFirst.memory.toFixed(6)} and ${negativeFirst.memory.toFixed(6)}`;
    },
  },
];