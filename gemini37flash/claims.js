// @ts-check
import { DensityMotilitySim } from './sim.js';

/**
 * @typedef {Object} ClaimResult
 * @property {boolean} passed
 * @property {string} summary
 * @property {Record<string, number | string | boolean>} metrics
 */

/**
 * @typedef {Object} Claim
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {() => ClaimResult} verify
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'threshold-speed-surge',
    name: 'Threshold-Activated Velocity Discontinuity',
    description:
      'Active particles exceeding the quorum threshold rho_c ignite into high-speed ballistic propulsion (>2.5x passive baseline speed).',
    verify() {
      const sim = new DensityMotilitySim({
        seed: 101,
        particleCount: 400,
        quorumThreshold: 6.0,
        passiveSpeed: 0.25,
        activeSpeed: 4.8,
      });

      // Step simulation for initial activation
      sim.step();

      let passiveSpeedSum = 0;
      let passiveCount = 0;
      let activeSpeedSum = 0;
      let activeCount = 0;

      for (const p of sim.particles) {
        const spd = Math.hypot(p.vx, p.vy);
        if (p.activeLevel < 0.2) {
          passiveSpeedSum += spd;
          passiveCount++;
        } else if (p.activeLevel > 0.8) {
          activeSpeedSum += spd;
          activeCount++;
        }
      }

      const meanPassiveSpeed = passiveCount > 0 ? passiveSpeedSum / passiveCount : 0.25;
      const meanActiveSpeed = activeCount > 0 ? activeSpeedSum / activeCount : 4.8;
      const speedRatio = meanActiveSpeed / (meanPassiveSpeed + 1e-5);

      const passed = speedRatio >= 2.5 && activeCount >= 10;
      return {
        passed,
        summary: `Active particles average speed ${meanActiveSpeed.toFixed(2)} vs passive ${meanPassiveSpeed.toFixed(2)} (${speedRatio.toFixed(2)}x surge, threshold: >=2.5x).`,
        metrics: {
          meanPassiveSpeed: Number(meanPassiveSpeed.toFixed(3)),
          meanActiveSpeed: Number(meanActiveSpeed.toFixed(3)),
          speedRatio: Number(speedRatio.toFixed(2)),
          activeParticles: activeCount,
          passiveParticles: passiveCount,
        },
      };
    },
  },
  {
    id: 'core-evacuation-cavitation',
    name: 'Blastwave Cavitation & Core Evacuation',
    description:
      'Supercritical blast propulsion rapidly blows out the dense core by >35%, establishing an evacuated central void surrounded by an expanding shock shell.',
    verify() {
      const sim = new DensityMotilitySim({
        seed: 202,
        particleCount: 450,
        quorumThreshold: 5.8,
        passiveSpeed: 0.25,
        activeSpeed: 4.8,
      });

      const initialCoreDensity = sim.getSnapshot().coreDensity;

      // Run blastwave expansion
      for (let s = 0; s < 45; s++) {
        sim.step();
      }

      const postBlastCoreDensity = sim.getSnapshot().coreDensity;
      const evacuationFraction = (initialCoreDensity - postBlastCoreDensity) / initialCoreDensity;

      const passed = evacuationFraction >= 0.35;
      return {
        passed,
        summary: `Core density evacuated by ${(evacuationFraction * 100).toFixed(1)}% (from ${initialCoreDensity.toFixed(4)} to ${postBlastCoreDensity.toFixed(4)}, threshold: >=35%).`,
        metrics: {
          initialCoreDensity: Number(initialCoreDensity.toFixed(5)),
          postBlastCoreDensity: Number(postBlastCoreDensity.toFixed(5)),
          evacuationPercentage: Number((evacuationFraction * 100).toFixed(1)),
        },
      };
    },
  },
  {
    id: 'negative-feedback-starvation',
    name: 'Negative Feedback Blast Starvation',
    description:
      'Because outward blast propulsion evacuates local particle crowding, the blastwave starves its own trigger: active fraction plummets by >60% after ignition.',
    verify() {
      const sim = new DensityMotilitySim({
        seed: 303,
        particleCount: 400,
        quorumThreshold: 5.5,
        activeSpeed: 4.8,
      });

      let peakActiveFraction = 0;
      let postBlastActiveFraction = 1.0;

      for (let s = 0; s < 70; s++) {
        sim.step();
        const snap = sim.getSnapshot();
        if (s <= 15) {
          peakActiveFraction = Math.max(peakActiveFraction, snap.activeFraction);
        }
        if (s >= 40) {
          postBlastActiveFraction = Math.min(postBlastActiveFraction, snap.activeFraction);
        }
      }

      const activeDrop = (peakActiveFraction - postBlastActiveFraction) / peakActiveFraction;
      const passed = activeDrop >= 0.60;

      return {
        passed,
        summary: `Active fraction dropped from peak ${(peakActiveFraction * 100).toFixed(1)}% to ${(postBlastActiveFraction * 100).toFixed(1)}% (${(activeDrop * 100).toFixed(1)}% reduction, threshold: >=60%).`,
        metrics: {
          peakActiveFraction: Number(peakActiveFraction.toFixed(3)),
          postBlastActiveFraction: Number(postBlastActiveFraction.toFixed(3)),
          dropPercentage: Number((activeDrop * 100).toFixed(1)),
        },
      };
    },
  },
  {
    id: 'limit-cycle-breathing',
    name: 'Inward Infall vs Outward Blast Limit Cycle',
    description:
      'Continuous inward accretion against threshold-triggered blasts creates cyclical core density pulsation cycles (recurrent recovery pulses detected).',
    verify() {
      const sim = new DensityMotilitySim({
        seed: 404,
        particleCount: 450,
        quorumThreshold: 5.6,
        activeSpeed: 4.6,
        centralPull: 0.02,
        localAccretion: 0.3,
      });

      for (let s = 0; s < 180; s++) {
        sim.step();
      }

      const metrics = sim.getBreathingMetrics();
      const passed = metrics.hasOscillation && metrics.cycleCount >= 1;

      return {
        passed,
        summary: `Detected limit-cycle breathing with ${metrics.cycleCount} full cycle(s) and characteristic period ${metrics.period.toFixed(1)}s (amplitude: ${metrics.amplitude.toFixed(2)}).`,
        metrics: {
          cycleCount: metrics.cycleCount,
          period: Number(metrics.period.toFixed(2)),
          amplitude: Number(metrics.amplitude.toFixed(3)),
          hasOscillation: metrics.hasOscillation,
        },
      };
    },
  },
  {
    id: 'interaction-scale-bubble-radius',
    name: 'Sensing Interaction Horizon Governs Bubble Diameter',
    description:
      'Expanding the sensing radius Rs increases the spatial extent and cavitation bubble diameter (dispersion index increases by >6%).',
    verify() {
      const smallRsSim = new DensityMotilitySim({
        seed: 505,
        quorumRadius: 20,
        quorumThreshold: 4.8,
        particleCount: 400,
      });

      const largeRsSim = new DensityMotilitySim({
        seed: 505,
        quorumRadius: 36,
        quorumThreshold: 4.8,
        particleCount: 400,
      });

      for (let s = 0; s < 50; s++) {
        smallRsSim.step();
        largeRsSim.step();
      }

      const smallSnap = smallRsSim.getSnapshot();
      const largeSnap = largeRsSim.getSnapshot();

      const expansionRatio = largeSnap.spatialClustering / (smallSnap.spatialClustering + 1e-5);
      const passed = expansionRatio >= 1.06;

      return {
        passed,
        summary: `Large sensing horizon (Rs=36) widened spatial dispersion to ${largeSnap.spatialClustering.toFixed(1)} vs Rs=20 dispersion ${smallSnap.spatialClustering.toFixed(1)} (ratio: ${expansionRatio.toFixed(2)}x, threshold: >=1.06x).`,
        metrics: {
          smallRsDispersion: Number(smallSnap.spatialClustering.toFixed(2)),
          largeRsDispersion: Number(largeSnap.spatialClustering.toFixed(2)),
          expansionRatio: Number(expansionRatio.toFixed(2)),
        },
      };
    },
  },
];

