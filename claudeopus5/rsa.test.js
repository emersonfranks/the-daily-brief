// @ts-check

import test from 'node:test';
import { claims } from './claims.js';

for (const claim of claims) {
  test(`${claim.id}: ${claim.title}`, () => {
    const evidence = claim.verify();
    console.log(`  ${claim.id}`, evidence);
  });
}
