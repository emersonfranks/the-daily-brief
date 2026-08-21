// @ts-check
// Hands each claim to Node's built-in runner. Discovered automatically as a
// *.test.js file. Never references the DOM.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claims } from './claims.js';

for (const claim of claims) {
  test(claim.name, () => {
    const evidence = claim.verify();
    assert.ok(evidence && typeof evidence === 'object', 'verify() must return evidence');
  });
}
