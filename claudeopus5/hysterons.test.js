// @ts-check

/**
 * The Node side of the proof. Each claim in `claims.js` becomes one test, so a failure names the
 * sentence on the page that is no longer true. There is deliberately nothing else in here: no DOM,
 * no rendering, no plumbing tests. A test that a button toggles proves nothing worth proving.
 *
 * Run: node --test claudeopus5/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { claims } from './claims.js';
import { createEnsemble, saturateDown, sweepTo, setDrive, returnPointExcursion } from './hysterons.js';

for (const claim of claims) {
  test(claim.title, () => {
    const evidence = claim.verify();
    assert.ok(evidence.length > 0, 'a claim must report the evidence it measured');
    console.log(`    ${claim.id}: ${evidence}`);
  });
}

test('the red path is real: the memory detector fires when memory is genuinely absent', () => {
  // A passing suite proves nothing unless the measurement can fail. Seed 21 with one-way
  // interactions at coupling 0.9 is a configuration measured to lose its turning point, so the
  // same function that reports "0 switches differed" everywhere else must report a difference here.
  const broken = createEnsemble({ n: 60, seed: 21, kind: 'asymmetric', couplingStrength: 0.9 });
  const { mismatched } = returnPointExcursion(broken, 0.15 + 0.5 * ((21 % 7) / 7), -0.35 - 0.4 * ((21 % 5) / 5), 0.01);
  assert.ok(mismatched > 0, 'the excursion measurement failed to notice a system with no return point memory');

  // And the ordinary path still behaves: an ensemble driven nowhere cannot change.
  const still = createEnsemble({ n: 20, seed: 3, kind: 'none' });
  saturateDown(still);
  const before = Array.from(still.state);
  setDrive(still, still.drive);
  assert.deepEqual(before, Array.from(still.state));
  sweepTo(still, 1.4, 0.01);
  assert.notDeepEqual(before, Array.from(still.state), 'driving the ensemble to saturation must change it');
});
