// @ts-check

import { describe, it, before } from 'node:test';
import { CLAIMS, measureNow } from './claims.js';

/**
 * This file deliberately holds no assertions of its own. Every claim lives in claims.js, so the
 * button on the page runs the code CI runs rather than a second copy that can drift away from it.
 */

describe('claims that need no simulation', () => {
  for (const claim of CLAIMS.filter(c => !c.needsMeasurement)) {
    it(`${claim.name} \u2014 catches ${claim.catches}`, () => {
      console.log(`  evidence: ${claim.verify(null)}`);
    });
  }
});

describe('claims measured against the simulation', { timeout: 180000 }, () => {
  /** @type {ReturnType<typeof measureNow>} */
  let measurement;
  before(() => { measurement = measureNow(); });

  for (const claim of CLAIMS.filter(c => c.needsMeasurement)) {
    it(`${claim.name} \u2014 catches ${claim.catches}`, () => {
      console.log(`  evidence: ${claim.verify(measurement)}`);
    });
  }
});
