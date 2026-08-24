// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';

import { claims } from './claims.js';
import { lorentzianFrequencies, coherence, predictedOrder, criticalCoupling } from './kuramoto.js';

for (const claim of claims) {
  test(claim.title, () => {
    const evidence = claim.verify();
    assert.ok(evidence.length > 0, 'a claim must return the evidence it measured');
    for (const row of evidence) assert.notEqual(row.ok, false, `${row.label}: ${row.value}`);
  });
}

test('the frequency sampler is symmetric and centred on zero', () => {
  const omega = lorentzianFrequencies(101, 0.5);
  assert.equal(omega.length, 101);
  assert.ok(Math.abs(omega[50]) < 1e-12, 'the middle oscillator should sit at the centre frequency');
  for (let i = 0; i < 50; i++) {
    assert.ok(Math.abs(omega[i] + omega[100 - i]) < 1e-9, 'the spread should be symmetric about zero');
    assert.ok(omega[i] < omega[i + 1], 'frequencies should be sorted');
    assert.ok(Number.isFinite(omega[i]), 'a Cauchy tail must not run to infinity');
  }
});

test('coherence is 1 for a locked swarm and near zero for an evenly spread one', () => {
  const locked = new Float64Array(64).fill(1.234);
  assert.ok(Math.abs(coherence(locked).r - 1) < 1e-12);

  const spread = new Float64Array(64);
  for (let i = 0; i < 64; i++) spread[i] = (2 * Math.PI * i) / 64;
  assert.ok(coherence(spread).r < 1e-12);
});

test('the amplitude law is pinned to zero at and below the critical coupling', () => {
  const gamma = 0.5;
  const kc = criticalCoupling(gamma);
  assert.equal(predictedOrder(kc, gamma), 0);
  assert.equal(predictedOrder(kc * 0.5, gamma), 0);
  assert.ok(predictedOrder(kc * 1.0001, gamma) > 0);
  assert.ok(Math.abs(predictedOrder(2 * kc, gamma) - Math.SQRT1_2) < 1e-12);
});
