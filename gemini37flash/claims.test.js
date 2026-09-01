// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { claims } from './claims.js';

for (const claim of claims) {
  test(`Claim: ${claim.title}`, async () => {
    const result = await claim.verify();
    assert.equal(result.passed, true, `Claim failed: ${claim.catches}`);
    assert.ok(result.evidence, 'Claim must provide measured evidence');
  });
}
