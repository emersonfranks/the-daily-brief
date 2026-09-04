// @ts-check
/**
 * Thin adapter handing every claim in `claims.js` to Node's built-in test
 * runner. No DOM references live here, and none may: the browser side runs the
 * same claims through `claims-panel.js` instead.
 *
 *   node --test claudeopus5/
 */

import test from 'node:test';
import { claims } from './claims.js';

for (const claim of claims) {
  test(`${claim.id}: ${claim.title}`, () => {
    const evidence = claim.verify();
    console.log(`    evidence: ${evidence}`);
  });
}
