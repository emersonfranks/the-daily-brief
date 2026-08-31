// @ts-check

/**
 * @fileoverview Node test harness executing verifiable claims for Rate-Distortion Allostatic Categorization.
 * Free of DOM dependencies, discovered automatically by `node --test`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { CLAIMS } from './claims.js';

for (const claim of CLAIMS) {
  test(claim.name, () => {
    try {
      const result = claim.verify();
      assert.equal(result.passed, true, `Claim ${claim.name} returned false`);
    } catch (err) {
      assert.fail(`Claim failed [${claim.name}] - Catches: ${claim.catches}. Error: ${/** @type {Error} */ (err).message}`);
    }
  });
}
