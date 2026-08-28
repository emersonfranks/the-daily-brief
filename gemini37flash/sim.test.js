// @ts-check
import test from 'node:test';
import assert from 'node:assert';
import { claims } from './claims.js';

for (const claim of claims) {
  test(`Claim: ${claim.name}`, () => {
    const result = claim.verify();
    assert.strictEqual(
      result.passed,
      true,
      `Claim "${claim.name}" failed: ${result.summary}`
    );
  });
}
