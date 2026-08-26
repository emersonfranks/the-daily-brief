// @ts-check
import test from 'node:test';
import { claims } from './claims.js';

for (const claim of claims) {
  test(`${claim.id}: ${claim.title}`, () => {
    const evidence = claim.verify();
    for (const [key, value] of Object.entries(evidence)) {
      console.log(`    ${key}: ${value}`);
    }
  });
}
