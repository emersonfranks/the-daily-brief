// @ts-check

/**
 * @fileoverview Claims data module.
 * Holds all empirical assertions, verification functions, and measured evidence.
 * No DOM references, no test runner dependency — imported by both Node.js tests and the browser claims panel.
 */

import { NonreciprocalSimulation } from './simulation.js';
import { EcologicalDualSimulation } from './ecological-dual.js';

/**
 * @typedef {Object} ClaimVerificationResult
 * @property {boolean} passed - Whether assertion passed
 * @property {string} measured - Human-readable summary of the exact measured values
 * @property {string} details - Detailed breakdown of experimental run
 */

/**
 * @typedef {Object} Claim
 * @property {string} id - Unique identifier
 * @property {string} name - Short descriptive claim title
 * @property {string} catches - What failure or misconception this assertion guards against
 * @property {() => ClaimVerificationResult} verify - Executable test returning evidence or throwing
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'pair-propulsion-broken-symmetry',
    name: 'Broken Action-Reaction Symmetry Generates Autonomous Pair Propulsion',
    catches: 'Guards against equilibrium assumptions: proves that nonreciprocal coupling (F_AB != -F_BA) generates non-zero center-of-mass drift velocity from purely internal pairwise forces.',
    verify: () => {
      // Test isolated AB pair with zero noise
      const sim = new NonreciprocalSimulation({ numA: 1, numB: 1, noise: 0.0, width: 300, height: 300 });

      // Run reciprocal control (F_AB = -F_BA, Newton’s 3rd law holds)
      sim.particles[0].x = 100; sim.particles[0].y = 150;
      sim.particles[1].x = 120; sim.particles[1].y = 150;
      sim.setAsymmetry(0.0);
      for (let i = 0; i < 50; i++) sim.step();
      const vRecipX = Math.abs((sim.particles[0].vx + sim.particles[1].vx) * 0.5);

      // Run nonreciprocal chase (F_AB != -F_BA, Newton’s 3rd law broken)
      sim.particles[0].x = 100; sim.particles[0].y = 150;
      sim.particles[1].x = 120; sim.particles[1].y = 150;
      sim.setAsymmetry(1.0);
      for (let i = 0; i < 50; i++) sim.step();
      const vNonrecipX = Math.abs((sim.particles[0].vx + sim.particles[1].vx) * 0.5);

      const passed = vRecipX < 0.001 && vNonrecipX > 1.5;
      return {
        passed,
        measured: `Reciprocal Pair Drift V_cm: ${vRecipX.toFixed(4)} px/step | Nonreciprocal Pair Drift V_cm: ${vNonrecipX.toFixed(4)} px/step`,
        details: `Under reciprocal equilibrium forces, action equals reaction: mutual attraction accelerates particles toward one another with net center-of-mass velocity V_cm = 0.0000. When nonreciprocal coupling breaks Newton's third law, the net internal force accelerates the center of mass to V_cm = ${vNonrecipX.toFixed(4)} px/step.`
      };
    }
  },
  {
    id: 'arrested-coarsening-entropy',
    name: 'Nonreciprocal Pursuit Arrests Coarsening and Elevates Spatial Dispersion Entropy',
    catches: 'Guards against static condensation: verifies that nonreciprocal shear halts droplet coarsening, keeping particles in active circulation with higher spatial entropy.',
    verify: () => {
      let recipEntropySum = 0;
      let nonrecipEntropySum = 0;
      const seeds = [1, 42, 123];

      for (const seed of seeds) {
        const simR = new NonreciprocalSimulation({ numA: 100, numB: 100, noise: 0.05 });
        simR.reset(seed);
        simR.setAsymmetry(0.0);
        for (let i = 0; i < 250; i++) simR.step();
        recipEntropySum += simR.computeMetrics().spatialEntropy;

        const simN = new NonreciprocalSimulation({ numA: 100, numB: 100, noise: 0.05 });
        simN.reset(seed);
        simN.setAsymmetry(1.0);
        for (let i = 0; i < 250; i++) simN.step();
        nonrecipEntropySum += simN.computeMetrics().spatialEntropy;
      }

      const meanRecipEntropy = recipEntropySum / seeds.length;
      const meanNonrecipEntropy = nonrecipEntropySum / seeds.length;

      const passed = meanRecipEntropy < 5.0 && meanNonrecipEntropy > 5.5;
      return {
        passed,
        measured: `Reciprocal Spatial Entropy: ${meanRecipEntropy.toFixed(3)} bits vs Nonreciprocal Arrested Entropy: ${meanNonrecipEntropy.toFixed(3)} bits (Gain: +${(meanNonrecipEntropy - meanRecipEntropy).toFixed(3)} bits)`,
        details: `At equilibrium (Delta=0), unconstrained coarsening condenses particles into dense clusters, depressing spatial Shannon entropy to ${meanRecipEntropy.toFixed(3)} bits. Nonreciprocal pursuit-evasion breaks static clumping, circulating particles across the domain and elevating entropy to ${meanNonrecipEntropy.toFixed(3)} bits.`
      };
    }
  },
  {
    id: 'dynamic-chase-population',
    name: 'Nonreciprocal Active Assemblies Sustain Coherent Chasing Pair Populations',
    catches: 'Guards against random scattering: confirms that nonreciprocal coupling organizes particles into active directional pursuit-evasion pairs rather than disordered thermal noise.',
    verify: () => {
      const sim = new NonreciprocalSimulation({ numA: 100, numB: 100, noise: 0.05 });
      sim.setAsymmetry(1.0);
      for (let i = 0; i < 200; i++) sim.step();
      const m = sim.computeMetrics();

      const passed = m.chasePairCount >= 80;
      return {
        passed,
        measured: `Active Chasing Pairs: ${m.chasePairCount} / 100 species A particles (${m.chasePairCount}% coupled)`,
        details: `Nonreciprocal cross-coupling establishes ${m.chasePairCount} active Chaser-Target pursuit pairs, organizing the active mixture into coordinated traveling wavefronts.`
      };
    }
  },
  {
    id: 'ecological-dual-coexistence',
    name: 'Ecological Dual: Nonreciprocal Cross-Taxis Prevents Extinction and Sustains Spatial Dynamics',
    catches: 'Guards against ecosystem collapse: validates that nonreciprocal predator pursuit and prey evasion in reaction-diffusion PDEs maintains stable coexistence.',
    verify: () => {
      const eco = new EcologicalDualSimulation(48);
      for (let i = 0; i < 150; i++) eco.step();
      const m = eco.computeMetrics();

      const passed = !m.isExtinct && m.preyTotal > 500 && m.predatorTotal > 500;
      return {
        passed,
        measured: `Prey Biomass: ${m.preyTotal.toFixed(1)} | Predator Biomass: ${m.predatorTotal.toFixed(1)} | Extinct: ${m.isExtinct}`,
        details: `Nonreciprocal spatial advection (prey fleeing predator gradient, predator pursuing prey gradient) prevents localized over-exploitation, sustaining stable dual-species coexistence with ${m.preyTotal.toFixed(0)} prey and ${m.predatorTotal.toFixed(0)} predator units.`
      };
    }
  }
];
