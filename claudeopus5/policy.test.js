// @ts-check

/**
 * Hands every claim in `claims.js` to the built-in Node test runner. Node discovers `*.test.js`
 * on its own, so there is nothing to install and nothing to configure. This file must never
 * mention `document`: the browser-side runner lives in `claims-panel.js`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { claims } from './claims.js';

for (const claim of claims) {
  test(claim.name, () => {
    const evidence = claim.verify();
    assert.equal(typeof evidence, 'string');
    assert.ok(evidence.length > 0, 'a claim must return the evidence it measured');
    console.log(`    evidence: ${evidence}`);
  });
}
