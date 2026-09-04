// @ts-check

/**
 * @fileoverview Node.js test runner suite for nonreciprocal active matter and ecological dual claims.
 * Uses built-in node:test runner and node:assert to verify claims headlessly.
 */

import test from 'node:test';
import assert from 'node:assert';
import { claims } from './claims.js';

for (const claim of claims) {
  test(`Claim: ${claim.name}`, () => {
    const result = claim.verify();
    assert.strictEqual(
      result.passed,
      true,
      `Claim failed [${claim.id}]: ${result.details} (Measured: ${result.measured})`
    );
  });
}
