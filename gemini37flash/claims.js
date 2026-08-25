// @ts-check

import { SocEngine } from './engine.js';

/**
 * @typedef {Object} ClaimEvidence
 * @property {boolean} pass
 * @property {string} summary
 * @property {Record<string, number | string | boolean>} metrics
 */

/**
 * @typedef {Object} Claim
 * @property {string} id
 * @property {string} name
 * @property {string} statement
 * @property {string} falsification
 * @property {() => Promise<ClaimEvidence> | ClaimEvidence} verify
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'claim-conservation',
    name: 'Conservative Lattice Energy Invariant',
    statement:
      'In a zero-leak BTW lattice, energy is strictly conserved: total grains injected plus initial lattice energy equals current lattice energy plus boundary dissipation.',
    falsification:
      'Any discrepancy where (Initial + Added) != (Current + Lost) falsifies the conservation of the discrete toppling rule.',
    verify() {
      const engine = new SocEngine({ gridSize: 30, leakRate: 0, gain: 1.0, seed: 101 });
      const initialEnergy = engine.getTotalEnergy();

      let totalBoundaryLost = 0;
      const drops = 600;
      for (let i = 0; i < drops; i++) {
        const x = Math.floor(engine.rng() * engine.gridSize);
        const y = Math.floor(engine.rng() * engine.gridSize);
        const res = engine.drop(x, y);
        totalBoundaryLost += res.boundaryLoss;
      }

      const finalEnergy = engine.getTotalEnergy();
      const expectedTotal = initialEnergy + engine.totalGrainsAdded;
      const actualTotal = finalEnergy + totalBoundaryLost;
      const delta = Math.abs(expectedTotal - actualTotal);

      if (delta !== 0) {
        throw new Error(`Conservation violated: expected ${expectedTotal}, got ${actualTotal} (delta: ${delta})`);
      }

      return {
        pass: true,
        summary: `Strict conservation held across ${drops} drops with exactly 0 unit delta.`,
        metrics: {
          initialEnergy,
          grainsAdded: engine.totalGrainsAdded,
          finalEnergy,
          boundaryLost: totalBoundaryLost,
          delta
        }
      };
    }
  },
  {
    id: 'claim-critical-branching',
    name: 'Critical Branching Ratio Equilibrium',
    statement:
      'At self-organized critical steady state, the primary branching ratio sigma = <N_1 | N_0=1> balances at 1.24 +/- 0.08 on the 2D lattice, sustaining multi-scale cascades without explosive runaway.',
    falsification:
      'A conservative steady-state branching ratio deviating outside [1.16, 1.32] over 800 avalanches falsifies critical equilibrium.',
    verify() {
      const engine = new SocEngine({ gridSize: 32, leakRate: 0, gain: 1.0, seed: 202 });
      engine.warmup(500);

      const avalanches = 800;
      for (let i = 0; i < avalanches; i++) {
        const x = Math.floor(engine.rng() * engine.gridSize);
        const y = Math.floor(engine.rng() * engine.gridSize);
        engine.drop(x, y);
      }

      const meanSigma = engine.getMeanBranchingRatio(avalanches);
      const pass = meanSigma >= 1.16 && meanSigma <= 1.32;

      if (!pass) {
        throw new Error(`Critical branching ratio out of range: measured ${meanSigma.toFixed(4)}`);
      }

      return {
        pass: true,
        summary: `Branching ratio measured sigma = ${meanSigma.toFixed(3)}, matching the critical lattice equilibrium.`,
        metrics: {
          branchingRatio: Number(meanSigma.toFixed(3)),
          lowerBound: 1.16,
          upperBound: 1.32,
          sampleCount: avalanches
        }
      };
    }
  },
  {
    id: 'claim-power-law-scaling',
    name: 'Scale-Free Power-Law Avalanche Distribution (P(s) ~ s^-tau)',
    statement:
      'Avalanche sizes in the critical regime follow a power-law distribution P(s) ~ s^-tau with exponent tau between 1.10 and 1.65, with log-log R^2 >= 0.88.',
    falsification:
      'Linear log-log regression showing R^2 < 0.88 or exponent tau outside [1.10, 1.65] falsifies scale invariance.',
    verify() {
      const engine = new SocEngine({ gridSize: 36, leakRate: 0, gain: 1.0, seed: 303 });
      engine.warmup(800);

      const sampleSize = 1400;
      for (let i = 0; i < sampleSize; i++) {
        const x = Math.floor(engine.rng() * engine.gridSize);
        const y = Math.floor(engine.rng() * engine.gridSize);
        engine.drop(x, y);
      }

      const fit = SocEngine.fitPowerLaw(engine.historySizes, 2, 14);

      if (fit.rSquared < 0.88 || fit.exponent < 1.10 || fit.exponent > 1.65) {
        throw new Error(
          `Power-law fit failed: tau=${fit.exponent}, R^2=${fit.rSquared} (evaluated ${fit.pointsEvaluated} bins)`
        );
      }

      return {
        pass: true,
        summary: `Scale-free power-law confirmed: tau = ${fit.exponent}, R^2 = ${fit.rSquared} across ${fit.pointsEvaluated} log bins.`,
        metrics: {
          exponentTau: fit.exponent,
          rSquared: fit.rSquared,
          binsEvaluated: fit.pointsEvaluated,
          totalAvalanches: sampleSize
        }
      };
    }
  },
  {
    id: 'claim-subcritical-dissipation',
    name: 'Subcritical Truncation via Dissipative Leakage',
    statement:
      'Introducing membrane leak / dissipation rate gamma = 0.10 suppresses cascade propagation, dropping the branching ratio below sigma <= 0.95 and mean avalanche size by > 60%.',
    falsification:
      'A dissipative system retaining sigma > 0.95 or failing to reduce mean avalanche size by at least 60% falsifies subcritical damping.',
    verify() {
      const conservative = new SocEngine({ gridSize: 32, leakRate: 0, gain: 1.0, seed: 404 });
      conservative.warmup(500);
      for (let i = 0; i < 600; i++) {
        conservative.drop(Math.floor(conservative.rng() * 32), Math.floor(conservative.rng() * 32));
      }

      const meanConservativeSize =
        conservative.historySizes.reduce((a, b) => a + b, 0) / conservative.historySizes.length;

      const dissipative = new SocEngine({ gridSize: 32, leakRate: 0.1, gain: 1.0, seed: 404 });
      dissipative.warmup(500);
      for (let i = 0; i < 600; i++) {
        dissipative.drop(Math.floor(dissipative.rng() * 32), Math.floor(dissipative.rng() * 32));
      }

      const meanDissipativeSize =
        dissipative.historySizes.reduce((a, b) => a + b, 0) / dissipative.historySizes.length;
      const dissipativeSigma = dissipative.getMeanBranchingRatio(600);
      const sizeDropRatio = 1 - meanDissipativeSize / meanConservativeSize;

      if (dissipativeSigma > 0.95 || sizeDropRatio < 0.6) {
        throw new Error(
          `Subcritical dissipation test failed: sigma=${dissipativeSigma.toFixed(3)}, sizeDrop=${(sizeDropRatio * 100).toFixed(1)}%`
        );
      }

      return {
        pass: true,
        summary: `Subcritical decay confirmed: sigma dropped to ${dissipativeSigma.toFixed(3)} and mean avalanche size collapsed by ${(sizeDropRatio * 100).toFixed(1)}%.`,
        metrics: {
          dissipativeSigma: Number(dissipativeSigma.toFixed(3)),
          meanConservativeSize: Number(meanConservativeSize.toFixed(1)),
          meanDissipativeSize: Number(meanDissipativeSize.toFixed(1)),
          reductionPercent: Number((sizeDropRatio * 100).toFixed(1))
        }
      };
    }
  },
  {
    id: 'claim-supercritical-runaway',
    name: 'Supercritical Runaway Explosion via Transmission Gain',
    statement:
      'Increasing synaptic gain / transmission factor to g = 1.25 causes explosive cascades, driving sigma >= 1.15 and triggering giant avalanches spanning >= 70% of the lattice.',
    falsification:
      'Supercritical gain failing to produce sigma >= 1.15 or failing to produce a giant avalanche >= 70% of lattice cells falsifies supercritical instability.',
    verify() {
      const engine = new SocEngine({ gridSize: 30, leakRate: 0, gain: 1.25, seed: 505 });
      engine.warmup(300);

      const drops = 400;
      let maxAvalanche = 0;
      for (let i = 0; i < drops; i++) {
        const res = engine.drop(Math.floor(engine.rng() * 30), Math.floor(engine.rng() * 30));
        if (res.size > maxAvalanche) {
          maxAvalanche = res.size;
        }
      }

      const sigma = engine.getMeanBranchingRatio(drops);
      const maxCoverage = maxAvalanche / engine.totalCells;

      if (sigma < 1.15 || maxCoverage < 0.7) {
        throw new Error(
          `Supercritical test failed: sigma=${sigma.toFixed(3)}, maxCoverage=${(maxCoverage * 100).toFixed(1)}%`
        );
      }

      return {
        pass: true,
        summary: `Supercritical seizure confirmed: sigma = ${sigma.toFixed(3)} and peak avalanche engulfed ${(maxCoverage * 100).toFixed(1)}% of total lattice.`,
        metrics: {
          supercriticalSigma: Number(sigma.toFixed(3)),
          maxAvalancheSize: maxAvalanche,
          totalLatticeCells: engine.totalCells,
          latticeCoveragePct: Number((maxCoverage * 100).toFixed(1))
        }
      };
    }
  }
];
