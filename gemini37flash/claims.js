// @ts-check

/**
 * @fileoverview Claims and verification suite for Reaction-Diffusion Morphogenesis.
 * Shared by both Node.js headless tests and the in-browser verification panel.
 *
 * NO DOM, NO Canvas, NO node:test imports. Pure portable ES module.
 */

import { TuringSimulation, PRESETS } from './turing-model.js';

/**
 * @typedef {Object} ClaimResult
 * @property {string} id Unique claim identifier
 * @property {string} title Short descriptive title
 * @property {string} statement Plain English falsifiable claim
 * @property {boolean} passed Whether the empirical verification succeeded
 * @property {string} evidence Formatted measured numbers and thresholds
 * @property {Record<string, number | string | boolean>} metrics Raw measured data
 */

/**
 * @typedef {Object} ClaimDefinition
 * @property {string} id
 * @property {string} title
 * @property {string} statement
 * @property {() => ClaimResult} verify
 */

/** @type {ClaimDefinition[]} */
export const CLAIMS = [
  {
    id: 'turing-symmetry-breaking',
    title: 'Symmetry Breaking & Characteristic Wavelength Emergence',
    statement:
      'Starting from stochastic initial perturbations, differential reaction-diffusion self-organizes into an ordered macro-scale spatial pattern with a measurable dominant wavelength (λ between 5 and 15 grid units) and sustained active coverage (>40%).',
    verify() {
      const p = PRESETS.JUNGLE_LABYRINTH;
      const sim = new TuringSimulation({
        width: 64,
        height: 64,
        Du: p.Du,
        Dv: p.Dv,
        F: p.F,
        k: p.k
      });

      sim.reset('random_noise', 77);
      const initialStats = sim.getStats();

      sim.step(1200);
      const finalStats = sim.getStats();
      const wave = sim.measureWavelength(24);

      const wavelengthValid = wave.dominantWavelength >= 5 && wave.dominantWavelength <= 15;
      const coverageValid = finalStats.activeCoverage > 0.40;
      const passed = finalStats.patternFormed && wavelengthValid && coverageValid && finalStats.maxV > 0.30;

      return {
        id: 'turing-symmetry-breaking',
        title: 'Symmetry Breaking & Characteristic Wavelength Emergence',
        statement:
          'Starting from stochastic initial perturbations, differential reaction-diffusion self-organizes into an ordered macro-scale spatial pattern with a measurable dominant wavelength (λ between 5 and 15 grid units) and sustained active coverage (>40%).',
        passed,
        evidence: `Initial coverage=${(initialStats.activeCoverage * 100).toFixed(1)}% → Final coverage=${(finalStats.activeCoverage * 100).toFixed(1)}% (threshold >40%). Dominant wavelength λ=${wave.dominantWavelength} grid units (target 5–15). Max V=${finalStats.maxV.toFixed(3)}, std(V)=${finalStats.stdV.toFixed(4)}.`,
        metrics: {
          initialCoverage: Number((initialStats.activeCoverage * 100).toFixed(1)),
          finalCoverage: Number((finalStats.activeCoverage * 100).toFixed(1)),
          dominantWavelength: wave.dominantWavelength,
          maxV: Number(finalStats.maxV.toFixed(3)),
          stdV: Number(finalStats.stdV.toFixed(4)),
          passed
        }
      };
    }
  },

  {
    id: 'differential-diffusivity-invariant',
    title: 'Differential Diffusivity Invariant (Turing Instability Condition)',
    statement:
      'Turing pattern formation strictly requires differential diffusion (Du > Dv). When diffusion rates are equalized (Du = Dv = 0.20), perturbations decay to homogeneous extinction (mean V < 1e-10). When Du/Dv = 2.33, spatial instability sustains persistent macro-scale structures (mean V > 0.10, max V > 0.30).',
    verify() {
      const p = PRESETS.JUNGLE_LABYRINTH;

      // 1. Equal diffusivity (Du = Dv = 0.20)
      const simEqual = new TuringSimulation({
        width: 64,
        height: 64,
        Du: 0.20,
        Dv: 0.20,
        F: p.F,
        k: p.k
      });
      simEqual.reset('random_noise', 77);
      simEqual.step(1200);
      const statsEqual = simEqual.getStats();

      // 2. Differential diffusivity (Du = 0.21, Dv = 0.09, ratio = 2.33)
      const simDiff = new TuringSimulation({
        width: 64,
        height: 64,
        Du: p.Du,
        Dv: p.Dv,
        F: p.F,
        k: p.k
      });
      simDiff.reset('random_noise', 77);
      simDiff.step(1200);
      const statsDiff = simDiff.getStats();

      const passed = statsEqual.meanV < 1e-10 && statsDiff.meanV > 0.10 && statsDiff.maxV > 0.30;

      return {
        id: 'differential-diffusivity-invariant',
        title: 'Differential Diffusivity Invariant (Turing Instability Condition)',
        statement:
          'Turing pattern formation strictly requires differential diffusion (Du > Dv). When diffusion rates are equalized (Du = Dv = 0.20), perturbations decay to homogeneous extinction (mean V < 1e-10). When Du/Dv = 2.33, spatial instability sustains persistent macro-scale structures (mean V > 0.10, max V > 0.30).',
        passed,
        evidence: `Equal diffusion (Du=Dv=0.20): mean(V)=${statsEqual.meanV.toExponential(2)} (complete decay). Differential diffusion (Du=0.21, Dv=0.09, ratio 2.33): mean(V)=${statsDiff.meanV.toFixed(3)}, max(V)=${statsDiff.maxV.toFixed(3)}, active coverage=${(statsDiff.activeCoverage * 100).toFixed(1)}%.`,
        metrics: {
          equalDiffMeanV: statsEqual.meanV,
          diffDiffMeanV: Number(statsDiff.meanV.toFixed(4)),
          diffDiffMaxV: Number(statsDiff.maxV.toFixed(3)),
          diffCoverage: Number((statsDiff.activeCoverage * 100).toFixed(1)),
          passed
        }
      };
    }
  },

  {
    id: 'feed-rate-bifurcation-cascade',
    title: 'Resource Influx Bifurcation Cascade (Drought / Morphogen Thresholds)',
    statement:
      'Varying feed rate F across high (0.050), intermediate (0.030), and severe deficit (0.010) at k=0.060 produces the complete bifurcation sequence: lush/dense cover (active coverage > 50%), discrete self-organized patterns (coverage 20%–50%), and catastrophic extinction collapse (coverage 0%).',
    verify() {
      // 1. High feed (lush canopy / solid coat cover)
      const simHigh = new TuringSimulation({ width: 64, height: 64, Du: 0.20, Dv: 0.10, F: 0.050, k: 0.060 });
      simHigh.reset('multi_spot', 88);
      simHigh.step(1200);
      const statsHigh = simHigh.getStats();

      // 2. Intermediate feed (patterned spots/clumps)
      const simMed = new TuringSimulation({ width: 64, height: 64, Du: 0.20, Dv: 0.10, F: 0.030, k: 0.060 });
      simMed.reset('multi_spot', 88);
      simMed.step(1200);
      const statsMed = simMed.getStats();

      // 3. Low feed (drought collapse / barren desert)
      const simLow = new TuringSimulation({ width: 64, height: 64, Du: 0.20, Dv: 0.10, F: 0.010, k: 0.060 });
      simLow.reset('multi_spot', 88);
      simLow.step(1200);
      const statsLow = simLow.getStats();

      const passed =
        statsHigh.activeCoverage > 0.50 &&
        statsMed.activeCoverage >= 0.20 && statsMed.activeCoverage <= 0.50 &&
        statsLow.activeCoverage === 0;

      return {
        id: 'feed-rate-bifurcation-cascade',
        title: 'Resource Influx Bifurcation Cascade (Drought / Morphogen Thresholds)',
        statement:
          'Varying feed rate F across high (0.050), intermediate (0.030), and severe deficit (0.010) at k=0.060 produces the complete bifurcation sequence: lush/dense cover (active coverage > 50%), discrete self-organized patterns (coverage 20%–50%), and catastrophic extinction collapse (coverage 0%).',
        passed,
        evidence: `High F=0.050: coverage=${(statsHigh.activeCoverage * 100).toFixed(1)}%, mean(V)=${statsHigh.meanV.toFixed(3)}. Med F=0.030: coverage=${(statsMed.activeCoverage * 100).toFixed(1)}%, mean(V)=${statsMed.meanV.toFixed(3)}. Low F=0.010: coverage=${(statsLow.activeCoverage * 100).toFixed(1)}%, mean(V)=${statsLow.meanV.toFixed(4)} (extinction).`,
        metrics: {
          highCoverage: Number((statsHigh.activeCoverage * 100).toFixed(1)),
          medCoverage: Number((statsMed.activeCoverage * 100).toFixed(1)),
          lowCoverage: Number((statsLow.activeCoverage * 100).toFixed(1)),
          passed
        }
      };
    }
  },

  {
    id: 'activator-depletion-halo',
    title: 'Short-Range Activation & Long-Range Resource Depletion Halo',
    statement:
      'Activator spots locally consume and trap substrate moisture U, generating a core depletion (U_center < 0.50) and surrounding depletion halo (r = 2..5) where substrate availability is markedly depressed relative to far-field background (depletion ratio U_halo / U_far < 0.88).',
    verify() {
      const p = PRESETS.LEOPARD_SPOTS;
      const sim = new TuringSimulation({
        width: 64,
        height: 64,
        Du: p.Du,
        Dv: p.Dv,
        F: p.F,
        k: p.k
      });
      sim.reset('multi_spot', 99);
      sim.step(1200);

      const halo = sim.measureDepletionHalo();
      const passed = halo.peakCount >= 4 && halo.depletionRatio < 0.88 && halo.avgPeakU < 0.50 && halo.avgPeakU < halo.avgFarU;

      return {
        id: 'activator-depletion-halo',
        title: 'Short-Range Activation & Long-Range Resource Depletion Halo',
        statement:
          'Activator spots locally consume and trap substrate moisture U, generating a core depletion (U_center < 0.50) and surrounding depletion halo (r = 2..5) where substrate availability is markedly depressed relative to far-field background (depletion ratio U_halo / U_far < 0.88).',
        passed,
        evidence: `Detected ${halo.peakCount} activator spots. Spot core U=${halo.avgPeakU.toFixed(3)} (<0.50), Halo U=${halo.avgHaloU.toFixed(3)}, Far-field U=${halo.avgFarU.toFixed(3)}. Depletion ratio=${halo.depletionRatio.toFixed(3)} (threshold <0.88).`,
        metrics: {
          peakCount: halo.peakCount,
          avgPeakU: Number(halo.avgPeakU.toFixed(3)),
          avgHaloU: Number(halo.avgHaloU.toFixed(3)),
          avgFarU: Number(halo.avgFarU.toFixed(3)),
          depletionRatio: Number(halo.depletionRatio.toFixed(3)),
          passed
        }
      };
    }
  }
];

