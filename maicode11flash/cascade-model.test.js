import test from 'node:test';
import assert from 'node:assert/strict';

import { claims } from './claims.js';

test('low density stalls the cascade', () => {
  const result = claims[0].verify();
  assert.ok(result.activeCount <= 18, `Expected a small cascade, got ${JSON.stringify(result)}`);
});

test('higher density crosses the tipping point', () => {
  const result = claims[1].verify();
  assert.ok(result.lowDensity && result.highDensity, 'Expected measured density comparison data');
  assert.ok(result.highDensity.activeCount > result.lowDensity.activeCount, `Expected large growth, got ${JSON.stringify(result)}`);
});

test('lower threshold makes cascade easier', () => {
  const result = claims[2].verify();
  assert.ok(result.threshold2 > result.threshold4, `Expected stronger cascade at threshold 2, got ${JSON.stringify(result)}`);
});
