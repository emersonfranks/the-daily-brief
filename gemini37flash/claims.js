// @ts-check
import { DoubleDiffusiveSim } from './simulation.js';

/**
 * @typedef {Object} ClaimResult
 * @property {string} id
 * @property {string} title
 * @property {string} catches
 * @property {boolean} passed
 * @property {string} evidence
 * @property {number} [durationMs]
 */

/**
 * Verification claims for Double-Diffusive Fingering Convection
 */
export const claims = [
  {
    id: 'fingering-instability',
    title: 'Differential Diffusivity Triggers Fingering Instability',
    catches: 'Failing to develop spontaneous fingering convection when tau << 1 in a statically stable density stratification',
    /**
     * @returns {Promise<{ passed: boolean, evidence: string }>}
     */
    async verify() {
      const simFingering = new DoubleDiffusiveSim({ nx: 48, ny: 48, rRho: 1.5, tau: 0.03, prandtl: 2.0, raT: 25000, seed: 101 });
      const simControl = new DoubleDiffusiveSim({ nx: 48, ny: 48, rRho: 1.5, tau: 1.0, prandtl: 2.0, raT: 25000, seed: 101 });

      for (let s = 0; s < 500; s++) {
        simFingering.step(0.001);
        simControl.step(0.001);
      }

      const keFingering = simFingering.getKineticEnergy();
      const keControl = simControl.getKineticEnergy();
      const ratio = keFingering / (keControl + 1e-20);

      const passed = keFingering > 5.0 && keControl < 1e-5 && ratio > 1e6;
      const evidence = `Fingering KE = ${keFingering.toFixed(3)} | Equal-diffusivity KE = ${keControl.toExponential(3)} | Energy amplification ratio = ${ratio.toExponential(2)} (threshold: > 10^6)`;

      if (!passed) throw new Error(`Claim failed: ${evidence}`);
      return { passed, evidence };
    }
  },
  {
    id: 'solute-transport-enhancement',
    title: 'Solute / Metal Transport Amplification (Nu_S >> 1)',
    catches: 'Failing to enhance heavy composition flux downward beyond molecular diffusion rate',
    /**
     * @returns {Promise<{ passed: boolean, evidence: string }>}
     */
    async verify() {
      const sim = new DoubleDiffusiveSim({ nx: 48, ny: 48, rRho: 1.5, tau: 0.03, prandtl: 2.0, raT: 25000, seed: 101 });
      for (let s = 0; s < 500; s++) {
        sim.step(0.001);
      }

      const fluxes = sim.getFluxes();
      const nusseltS = fluxes.nusseltS;
      const passed = nusseltS >= 10.0;
      const evidence = `Solute Nusselt Number Nu_S = ${nusseltS.toFixed(2)} (convective flux is ${nusseltS.toFixed(1)}x faster than molecular diffusion; threshold: >= 10.0)`;

      if (!passed) throw new Error(`Claim failed: ${evidence}`);
      return { passed, evidence };
    }
  },
  {
    id: 'stern-flux-ratio',
    title: 'Stern Heat-to-Solute Flux Ratio Invariance (gamma < 1.0)',
    catches: 'Violating Stern flux ratio bounds (gamma = alpha*F_T / (beta*F_S) must be below 1.0)',
    /**
     * @returns {Promise<{ passed: boolean, evidence: string }>}
     */
    async verify() {
      const sim = new DoubleDiffusiveSim({ nx: 48, ny: 48, rRho: 1.5, tau: 0.03, prandtl: 2.0, raT: 25000, seed: 101 });
      for (let s = 0; s < 600; s++) {
        sim.step(0.001);
      }

      const fluxes = sim.getFluxes();
      const gamma = fluxes.fluxRatio;
      const passed = gamma >= 0.4 && gamma <= 0.95;
      const evidence = `Measured Stern Flux Ratio gamma = ${gamma.toFixed(3)} (predicted literature window: 0.40 - 0.95)`;

      if (!passed) throw new Error(`Claim failed: ${evidence}`);
      return { passed, evidence };
    }
  },
  {
    id: 'stability-threshold',
    title: 'Suppression at High Density Ratio (R_rho > 1 / tau)',
    catches: 'Allowing fingering instability when stabilizing thermal gradient exceeds 1/tau threshold',
    /**
     * @returns {Promise<{ passed: boolean, evidence: string }>}
     */
    async verify() {
      // tau = 0.03 -> critical R_rho_crit = 1/tau = 33.3
      const simStable = new DoubleDiffusiveSim({ nx: 48, ny: 48, rRho: 40.0, tau: 0.03, prandtl: 2.0, raT: 25000, seed: 101 });
      for (let s = 0; s < 500; s++) {
        simStable.step(0.001);
      }

      const ke = simStable.getKineticEnergy();
      const fluxes = simStable.getFluxes();
      const passed = ke < 1e-4 && fluxes.nusseltS < 1.5;
      const evidence = `At R_rho = 40.0 (> 1/tau = 33.3): KE = ${ke.toExponential(3)} | Nu_S = ${fluxes.nusseltS.toFixed(2)} (pure conduction preserved)`;

      if (!passed) throw new Error(`Claim failed: ${evidence}`);
      return { passed, evidence };
    }
  },
  {
    id: 'universal-domain-equivalence',
    title: 'Cross-Domain Equivalence: Oceanographic vs White Dwarf Regimes',
    catches: 'Failing to reproduce fingering convection in both oceanic (Pr=7.0) and white dwarf plasma (Pr=0.5) parameter regimes',
    /**
     * @returns {Promise<{ passed: boolean, evidence: string }>}
     */
    async verify() {
      // Oceanographic water parameters: Pr = 7.0, tau = 0.03, R_rho = 1.5
      const simOcean = new DoubleDiffusiveSim({ nx: 48, ny: 48, rRho: 1.5, tau: 0.03, prandtl: 7.0, raT: 25000, seed: 101 });
      // White dwarf plasma parameters: Pr = 0.5, tau = 0.02, R_rho = 1.5
      const simWD = new DoubleDiffusiveSim({ nx: 48, ny: 48, rRho: 1.5, tau: 0.02, prandtl: 0.5, raT: 25000, seed: 101 });

      for (let s = 0; s < 500; s++) {
        simOcean.step(0.001);
        simWD.step(0.001);
      }

      const keOcean = simOcean.getKineticEnergy();
      const keWD = simWD.getKineticEnergy();
      const specOcean = simOcean.getFingerSpectrum();
      const specWD = simWD.getFingerSpectrum();

      const passed = keOcean > 1.0 && keWD > 1.0 && specOcean.peakPower > 1e-4 && specWD.peakPower > 1e-4;
      const evidence = `Oceanic regime (Pr=7.0): KE = ${keOcean.toFixed(2)}, Peak k = ${specOcean.peakWavenumber} | White Dwarf regime (Pr=0.5): KE = ${keWD.toFixed(2)}, Peak k = ${specWD.peakWavenumber}`;

      if (!passed) throw new Error(`Claim failed: ${evidence}`);
      return { passed, evidence };
    }
  }
];
