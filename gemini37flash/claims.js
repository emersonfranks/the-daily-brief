// @ts-check

import {
  DoubleWellSimulator,
  NeuronSimulator,
  computeCorrelation,
  computeSpectralSNR,
  computePhaseLockingFactor,
  runDoubleWellNoiseSweep,
  runNeuronNoiseSweep
} from './stochastic-resonance.js';

/**
 * @typedef {Object} ClaimResult
 * @property {string} name
 * @property {string} description
 * @property {boolean} passed
 * @property {string} evidence
 * @property {number} [durationMs]
 */

/**
 * @typedef {Object} ClaimDefinition
 * @property {string} name
 * @property {string} description
 * @property {() => Promise<string> | string} verify
 */

/** @type {ClaimDefinition[]} */
export const claims = [
  {
    name: 'Subthreshold Deterministic Lockout at Zero Noise',
    description: 'Verifies that with zero noise (D=0), neither the double-well barrier nor the neuron spike threshold can be breached by subthreshold periodic driving.',
    verify: () => {
      const wellSim = new DoubleWellSimulator({ noiseIntensity: 0.0, amplitude: 0.18, frequency: 0.04, dt: 0.05 }, 1);
      const wellData = wellSim.record(4000);
      let wellTransitions = 0;
      for (let i = 1; i < wellData.states.length; i++) {
        if ((wellData.states[i - 1] < 0 && wellData.states[i] > 0) || (wellData.states[i - 1] > 0 && wellData.states[i] < 0)) {
          wellTransitions++;
        }
      }

      const neuronSim = new NeuronSimulator({ noiseIntensity: 0.0, amplitude: 10.0, frequency: 0.04, dt: 0.05 }, 2);
      const neuronData = neuronSim.record(4000);
      const neuronSpikeCount = neuronData.spikes.length;

      if (wellTransitions > 0) {
        throw new Error(`Double-well escaped barrier deterministically at D=0 with ${wellTransitions} transitions`);
      }
      if (neuronSpikeCount > 0) {
        throw new Error(`Neuron spiked deterministically at D=0 with ${neuronSpikeCount} spikes`);
      }

      return `Zero noise verified: double-well transitions = ${wellTransitions}, neuron spikes = ${neuronSpikeCount} over 4,000 steps`;
    }
  },
  {
    name: 'Non-Monotonic Double-Well SNR Curve (Resonance Peak)',
    description: 'Verifies that the double-well SNR exhibits a non-monotonic curve with an intermediate peak D* having higher SNR than both D=0 and high noise D=0.45.',
    verify: () => {
      const sweep = runDoubleWellNoiseSweep(15, 300);
      const zeroNoisePoint = sweep[0];
      const maxNoisePoint = sweep[sweep.length - 1];

      let peakIndex = 0;
      let peakSNR = -Infinity;
      for (let i = 0; i < sweep.length; i++) {
        if (sweep[i].snr > peakSNR) {
          peakSNR = sweep[i].snr;
          peakIndex = i;
        }
      }

      const peakPoint = sweep[peakIndex];
      const peakIsInterior = peakIndex > 1 && peakIndex < sweep.length - 2;
      const peakExceedsZero = peakPoint.snr > zeroNoisePoint.snr + 1.0;
      const peakExceedsHigh = peakPoint.snr > maxNoisePoint.snr;

      if (!peakIsInterior || !peakExceedsZero || !peakExceedsHigh) {
        throw new Error(
          `Non-monotonic peak not observed. Peak at D=${peakPoint.noise.toFixed(3)} (SNR=${peakPoint.snr.toFixed(2)} dB), ` +
          `Zero D=${zeroNoisePoint.noise.toFixed(3)} (SNR=${zeroNoisePoint.snr.toFixed(2)} dB), ` +
          `High D=${maxNoisePoint.noise.toFixed(3)} (SNR=${maxNoisePoint.snr.toFixed(2)} dB)`
        );
      }

      return (
        `Resonance peak measured at D* = ${peakPoint.noise.toFixed(3)}: ` +
        `SNR = ${peakPoint.snr.toFixed(2)} dB vs ${zeroNoisePoint.snr.toFixed(2)} dB (at D=0) and ` +
        `${maxNoisePoint.snr.toFixed(2)} dB (at D=${maxNoisePoint.noise.toFixed(2)})`
      );
    }
  },
  {
    name: 'Neuron Phase-Locking Enhancement at Optimal Noise',
    description: 'Verifies that intermediate noise enables subthreshold sensory signal detection in neurons, maximizing the phase-locking factor and spike coherence.',
    verify: () => {
      const sweep = runNeuronNoiseSweep(15, 400);
      const zeroNoise = sweep[0];
      const highNoise = sweep[sweep.length - 1];

      let peakIndex = 0;
      let peakPLF = -Infinity;
      for (let i = 0; i < sweep.length; i++) {
        if (sweep[i].phaseLocking > peakPLF) {
          peakPLF = sweep[i].phaseLocking;
          peakIndex = i;
        }
      }

      const peak = sweep[peakIndex];
      if (peak.phaseLocking <= zeroNoise.phaseLocking || peak.phaseLocking <= highNoise.phaseLocking) {
        throw new Error(
          `Neuron phase locking not optimized at interior noise. Peak PLF=${peak.phaseLocking.toFixed(3)} at noise=${peak.noise.toFixed(2)}`
        );
      }

      return (
        `Phase locking factor peaked at R = ${peak.phaseLocking.toFixed(3)} (noise = ${peak.noise.toFixed(2)}) ` +
        `compared to R = ${zeroNoise.phaseLocking.toFixed(3)} at zero noise and R = ${highNoise.phaseLocking.toFixed(3)} at high noise`
      );
    }
  },
  {
    name: 'Spectral Power Amplification at Driving Frequency',
    description: 'Verifies that adding stochastic noise transforms zero macroscopic switching power at D=0 into strong coherent spectral power (SNR > 4.0 dB) concentrated at the subthreshold signal frequency.',
    verify: () => {
      const zeroSim = new DoubleWellSimulator({ noiseIntensity: 0.0, amplitude: 0.18, frequency: 0.04, dt: 0.05 }, 1);
      const zeroData = zeroSim.record(4000);
      const zeroSNR = computeSpectralSNR(zeroData.macroStates, 0.05, 0.04);

      const optSim = new DoubleWellSimulator({ noiseIntensity: 0.12, amplitude: 0.18, frequency: 0.04, dt: 0.05 }, 1);
      optSim.step(200);
      const optData = optSim.record(4000);
      const optSNR = computeSpectralSNR(optData.macroStates, 0.05, 0.04);

      if (zeroSNR.snrDb !== 0 || optSNR.snrDb < 4.0) {
        throw new Error(
          `Spectral power amplification failed: zero noise SNR = ${zeroSNR.snrDb.toFixed(2)} dB, optimal noise SNR = ${optSNR.snrDb.toFixed(2)} dB (expected > 4.0 dB)`
        );
      }

      return (
        `Macroscopic spectral power at f0=0.04 Hz amplified from ${zeroSNR.peakPower.toFixed(2)} (SNR = 0.00 dB, 0 transitions) ` +
        `to peak power ${optSNR.peakPower.toFixed(1)} (SNR = ${optSNR.snrDb.toFixed(2)} dB, linear ratio = ${optSNR.snrLinear.toFixed(2)}x noise floor)`
      );
    }
  }
];

/**
 * @returns {Promise<ClaimResult[]>}
 */
export async function runAllClaims() {
  const results = [];
  for (const claim of claims) {
    const t0 = performance.now();
    try {
      const evidence = await claim.verify();
      const t1 = performance.now();
      results.push({
        name: claim.name,
        description: claim.description,
        passed: true,
        evidence,
        durationMs: t1 - t0
      });
    } catch (err) {
      const t1 = performance.now();
      results.push({
        name: claim.name,
        description: claim.description,
        passed: false,
        evidence: err instanceof Error ? err.message : String(err),
        durationMs: t1 - t0
      });
    }
  }
  return results;
}
