// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLAIMS } from './claims.js';

for (const claim of CLAIMS) {
  test(claim.title, () => {
    const result = claim.verify();
    assert.equal(result.passed, true, `Claim failed: ${claim.title}\nEvidence: ${result.evidence}`);
  });
}
