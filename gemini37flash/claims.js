// @ts-check
import { ChiralRibbonSim } from './simulation.js';

/**
 * @typedef {Object} ClaimResult
 * @property {boolean} passed
 * @property {string} measured
 * @property {string} details
 */

/**
 * @typedef {Object} Claim
 * @property {string} id
 * @property {string} title
 * @property {string} hypothesis
 * @property {string} expected
 * @property {() => Promise<ClaimResult> | ClaimResult} verify
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'cooperative-amplification',
    title: 'Cooperative Chiral Amplification (Sergeants-and-Soldiers Effect)',
    hypothesis:
      'A weak chiral bias field (h = 0.08 J) applied to an interacting ribbon (J = 1.0, k_B T = 0.25 J, N = 64) produces near-total enantiomeric excess (|ee| >= 0.85), amplifying the single-unit thermal expectation by over 2.5x through neighbor coupling.',
    expected: 'Enantiomeric excess |ee| >= 0.85 and cooperative amplification factor >= 2.5x',
    verify: () => {
      const N = 64;
      const J = 1.0;
      const h = 0.08;
      const T = 0.25;
      const sim = new ChiralRibbonSim({ N, J, h, temperature: T, seed: 101, initialState: 'random' });

      for (let s = 0; s < 300; s++) {
        sim.step(0.05, 5);
      }

      const ee = sim.getEnantiomericExcess();
      const singleUnitExp = sim.getSingleUnitExpectation();
      const amplification = Math.abs(ee) / Math.max(0.001, Math.abs(singleUnitExp));

      const passed = Math.abs(ee) >= 0.85 && amplification >= 2.5;
      return {
        passed,
        measured: `ee = ${(ee * 100).toFixed(1)}%, amplification = ${amplification.toFixed(2)}x`,
        details: `Simulated N=${N} chain with J=${J}, h=${h}, k_B*T=${T}. Chain reached |ee|=${Math.abs(ee).toFixed(3)} vs single-unit expectation ${Math.abs(singleUnitExp).toFixed(3)} (amplification ${amplification.toFixed(2)}x).`
      };
    }
  },
  {
    id: 'thermal-racemization',
    title: 'Thermal Racemization and Perversion Kink Proliferation',
    hypothesis:
      'Above the cooperative coherence threshold (k_B T >= 1.8 J), thermal fluctuations disrupt steric locking, nucleating multiple wandering perversion kinks and collapsing average enantiomeric excess below 0.30.',
    expected: 'Average |ee| < 0.30 and average perversion count >= 6.0 across 5 independent thermal runs',
    verify: () => {
      const trials = 5;
      let totalAbsEE = 0;
      let totalKinks = 0;

      for (let i = 0; i < trials; i++) {
        const sim = new ChiralRibbonSim({
          N: 64,
          J: 1.0,
          h: 0.08,
          temperature: 1.8,
          seed: 200 + i,
          initialState: 'random'
        });

        for (let s = 0; s < 250; s++) {
          sim.step(0.05, 5);
        }

        totalAbsEE += Math.abs(sim.getEnantiomericExcess());
        totalKinks += sim.countPerversionKinks();
      }

      const avgEE = totalAbsEE / trials;
      const avgKinks = totalKinks / trials;
      const passed = avgEE < 0.30 && avgKinks >= 6.0;

      return {
        passed,
        measured: `avg |ee| = ${(avgEE * 100).toFixed(1)}%, avg perversion kinks = ${avgKinks.toFixed(1)}`,
        details: `Evaluated 5 runs at k_B*T=1.8 J with h=0.08. Measured mean |ee|=${avgEE.toFixed(3)} (< 0.30) and mean kink count=${avgKinks.toFixed(1)} (>= 6.0), confirming high-temperature domain fragmentation.`
      };
    }
  },
  {
    id: 'topological-annihilation-vs-pinned',
    title: 'Topological Kink Annihilation vs Pinned End-State Metastability',
    hypothesis:
      'In a free ribbon with initial multi-kink state and non-zero bias (h = 0.15), domain walls drift and annihilate to 0 kinks (pure uniform spiral). When boundary ends are pinned with opposite chirality, topological domain walls are trapped, preserving >= 1 persistent perversion node.',
    expected: 'Free ribbon kinks = 0, Pinned ribbon kinks >= 1',
    verify: () => {
      // 1. Free ends with bias field -> total annihilation
      const simFree = new ChiralRibbonSim({
        N: 64,
        J: 1.0,
        h: 0.15,
        temperature: 0.20,
        initialState: 'multi_kink',
        pinnedEnds: false,
        seed: 301
      });
      for (let s = 0; s < 300; s++) {
        simFree.step(0.05, 5);
      }
      const freeKinks = simFree.countPerversionKinks();

      // 2. Pinned ends with fixed opposite boundary conditions -> trapped perversion
      const simPinned = new ChiralRibbonSim({
        N: 64,
        J: 1.0,
        h: 0.15,
        temperature: 0.20,
        initialState: 'single_perversion',
        pinnedEnds: true,
        seed: 302
      });
      for (let s = 0; s < 300; s++) {
        simPinned.step(0.05, 5);
      }
      const pinnedKinks = simPinned.countPerversionKinks();

      const passed = freeKinks === 0 && pinnedKinks >= 1;
      return {
        passed,
        measured: `Free ribbon final kinks = ${freeKinks}, Pinned ribbon final kinks = ${pinnedKinks}`,
        details: `Free boundary conditions swept all ${simFree.annihilationEvents} initial domain walls out of the strand. Clamped boundary conditions preserved ${pinnedKinks} topological perversion node despite bias field h=0.15.`
      };
    }
  },
  {
    id: 'correlation-length-scaling',
    title: 'Exponential Growth of Cooperative Correlation Length',
    hypothesis:
      'The 1D Ising correlation length xi(T) = -1 / ln(tanh(J / k_B T)) diverges exponentially at low temperatures, exceeding the physical ribbon length (N = 64) when k_B T <= 0.40 J.',
    expected: 'xi(T=0.35) > 64 and xi(T=0.35) / xi(T=1.0) > 20x',
    verify: () => {
      const simLowT = new ChiralRibbonSim({ N: 64, J: 1.0, temperature: 0.35 });
      const simHighT = new ChiralRibbonSim({ N: 64, J: 1.0, temperature: 1.0 });

      const xiLow = simLowT.getTheoreticalCorrelationLength();
      const xiHigh = simHighT.getTheoreticalCorrelationLength();
      const ratio = xiLow / xiHigh;

      const passed = xiLow > 64 && ratio > 20;
      return {
        passed,
        measured: `xi(T=0.35) = ${xiLow.toFixed(1)} segments, xi(T=1.0) = ${xiHigh.toFixed(2)} segments (growth = ${ratio.toFixed(1)}x)`,
        details: `At T=0.35 J, correlation length xi=${xiLow.toFixed(1)} comfortably exceeds chain length N=64 by ${(xiLow / 64).toFixed(1)}x, ensuring that the entire molecule acts as a single coherent macro-switch.`
      };
    }
  }
];
