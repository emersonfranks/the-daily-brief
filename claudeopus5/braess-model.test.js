// @ts-check

import test from 'node:test';
import { claims } from './claims.js';

for (const claim of claims) {
  test(claim.name, () => {
    const evidence = claim.verify();
    if (typeof evidence !== 'string' || evidence.length === 0) {
      throw new Error(`claim ${claim.id} returned no evidence`);
    }
    console.log(`  ${claim.id}: ${evidence}`);
  });
}
