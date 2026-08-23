// @ts-check

/**
 * @fileoverview Node.js test runner for the Reaction-Diffusion Morphogenesis claims.
 * Discovered and executed by `node --test`.
 *
 * NO DOM, NO Canvas references.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CLAIMS } from './claims.js';
import { TuringSimulation, PRESETS } from './turing-model.js';

describe('Turing Reaction-Diffusion Morphogenesis: Mammalian Pelt ↔ Desert Vegetation', () => {
  for (const claim of CLAIMS) {
    test(`${claim.title} (${claim.id})`, () => {
      const result = claim.verify();
      assert.equal(
        result.passed,
        true,
        `Claim failed: ${claim.title}\nEvidence: ${result.evidence}`
      );
    });
  }

  test('Preset configurations initialize valid simulation instances', () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      const sim = new TuringSimulation({
        width: 32,
        height: 32,
        Du: preset.Du,
        Dv: preset.Dv,
        F: preset.F,
        k: preset.k,
        slopeAdvection: preset.slopeAdvection
      });
      sim.step(10);
      const stats = sim.getStats();
      assert.ok(stats.meanU >= 0 && stats.meanU <= 1.0, `${key} meanU out of bounds`);
      assert.ok(stats.meanV >= 0 && stats.meanV <= 1.0, `${key} meanV out of bounds`);
    }
  });

  test('Interactive brush injection alters local concentrations', () => {
    const sim = new TuringSimulation({ width: 32, height: 32 });
    sim.reset('uniform');
    const beforeV = sim.v[sim.index(16, 16)];
    sim.inject(16, 16, 3, 0.5, 0.2);
    const afterV = sim.v[sim.index(16, 16)];
    assert.ok(afterV > beforeV, 'Brush injection should increase local V concentration');
  });
});
