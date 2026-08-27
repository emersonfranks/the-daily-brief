// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLAIMS } from './claims.js';

test('Physarum Transport & Routing Claims Suite', async (t) => {
  for (const claim of CLAIMS) {
    await t.test(claim.name, async () => {
      const result = await claim.verify();
      assert.strictEqual(
        result.passed,
        true,
        `Claim "${claim.name}" failed: ${result.evidence}`
      );
    });
  }
});
