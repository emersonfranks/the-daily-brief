// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { claims, runClaim } from './claims.js';

for (const claim of claims) {
  test(`${claim.id} — ${claim.title}`, () => {
    const result = runClaim(claim);
    console.log(`    evidence ${JSON.stringify(result.evidence)}`);
    assert.equal(result.ok, true, result.error);
  });
}
