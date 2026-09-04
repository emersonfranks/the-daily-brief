// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claims } from './claims.js';

for (const claim of claims) {
  test(claim.title, async () => {
    const result = await claim.verify();
    assert.equal(
      result.passed,
      true,
      `Claim "${claim.title}" failed verification: ${result.details} (measured: ${result.measured})`
    );
  });
}
