// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { claims } from './claims.js';

for (const claim of claims) {
  test(claim.name, () => {
    const evidence = claim.verify();
    assert.ok(Object.keys(evidence).length > 0, 'a claim must report the evidence it measured');
  });
}
