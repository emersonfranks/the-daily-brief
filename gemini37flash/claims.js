// @ts-check
import { KuramotoModel } from './kuramoto-model.js';

/**
 * @typedef {Object} Claim
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {() => Promise<{ passed: boolean, evidence: Record<string, any> }> | () => { passed: boolean, evidence: Record<string, any> }} verify
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'subcritical-disorder',
    title: 'Subcritical Disorder Under Weak Coupling',
    description: 'When coupling strength is insufficient (K = 0.1, spread = 0.8), oscillators drift incoherently with low order parameter (r < 0.32).',
    verify: () => {
      const model = new KuramotoModel({
        oscillatorCount: 64,
        couplingStrength: 0.1,
        frequencySpread: 0.8,
        seed: 101
      });

      model.run(500);

      let orderSum = 0;
      const sampleSteps = 100;
      for (let i = 0; i < sampleSteps; i++) {
        model.step();
        orderSum += model.getMetrics().orderParameter;
      }
      const meanOrder = orderSum / sampleSteps;

      if (meanOrder >= 0.32) {
        throw new Error(`Expected mean order parameter < 0.32 under subcritical coupling, got ${meanOrder.toFixed(4)}`);
      }

      return {
        passed: true,
        evidence: {
          couplingStrength: 0.1,
          frequencySpread: 0.8,
          meanOrderParameter: Number(meanOrder.toFixed(4)),
          threshold: 0.32
        }
      };
    }
  },
  {
    id: 'supercritical-synchronization',
    title: 'Supercritical Synchronization Under Strong Coupling',
    description: 'When coupling exceeds critical threshold (K = 3.5, spread = 0.8), collective entrainment drives order parameter r > 0.85 and frequency locking > 85%.',
    verify: () => {
      const model = new KuramotoModel({
        oscillatorCount: 64,
        couplingStrength: 3.5,
        frequencySpread: 0.8,
        seed: 202
      });

      model.run(600);

      const metrics = model.getMetrics();
      if (metrics.orderParameter <= 0.85) {
        throw new Error(`Expected order parameter > 0.85 under supercritical coupling, got ${metrics.orderParameter.toFixed(4)}`);
      }
      if (metrics.lockedFraction <= 0.85) {
        throw new Error(`Expected locked fraction > 0.85, got ${metrics.lockedFraction.toFixed(4)}`);
      }

      return {
        passed: true,
        evidence: {
          couplingStrength: 3.5,
          orderParameter: Number(metrics.orderParameter.toFixed(4)),
          lockedFraction: Number(metrics.lockedFraction.toFixed(4)),
          thresholdOrder: 0.85
        }
      };
    }
  },
  {
    id: 'monotonic-phase-transition',
    title: 'Monotonic Order Scaling Across Phase Transition',
    description: 'Order parameter r monotonically increases across coupling values K = [0.2, 0.8, 1.8, 3.2, 5.0] reflecting the second-order phase transition.',
    verify: () => {
      const couplings = [0.2, 0.8, 1.8, 3.2, 5.0];
      const orders = [];

      for (const k of couplings) {
        const model = new KuramotoModel({
          oscillatorCount: 64,
          couplingStrength: k,
          frequencySpread: 0.8,
          seed: 303
        });
        model.run(600);

        let sumR = 0;
        const steps = 60;
        for (let s = 0; s < steps; s++) {
          model.step();
          sumR += model.getMetrics().orderParameter;
        }
        orders.push(sumR / steps);
      }

      for (let i = 1; i < orders.length; i++) {
        if (orders[i] <= orders[i - 1]) {
          throw new Error(`Monotonicity violation at K=${couplings[i]}: r=${orders[i].toFixed(4)} <= r(prev)=${orders[i - 1].toFixed(4)}`);
        }
      }

      return {
        passed: true,
        evidence: {
          couplings,
          measuredOrders: orders.map((r) => Number(r.toFixed(4)))
        }
      };
    }
  },
  {
    id: 'perturbation-relaxation',
    title: 'Self-Healing Perturbation Recovery',
    description: 'When 40% of synchronized oscillators are phase-scrambled, the system spontaneously recovers to r > 0.80 within 400 simulation steps (dt=0.02).',
    verify: () => {
      const model = new KuramotoModel({
        oscillatorCount: 64,
        couplingStrength: 3.5,
        frequencySpread: 0.8,
        seed: 404
      });

      model.run(600);
      const preShockOrder = model.getMetrics().orderParameter;

      model.perturbFraction(0.4);
      const shockedOrder = model.getMetrics().orderParameter;

      model.run(400);
      const postRecoveryOrder = model.getMetrics().orderParameter;

      if (postRecoveryOrder < 0.80) {
        throw new Error(`Failed to recover phase coherence after shock: r=${postRecoveryOrder.toFixed(4)} < 0.80`);
      }

      return {
        passed: true,
        evidence: {
          preShockOrder: Number(preShockOrder.toFixed(4)),
          shockedOrder: Number(shockedOrder.toFixed(4)),
          postRecoveryOrder: Number(postRecoveryOrder.toFixed(4)),
          recoveryTimeUnits: 8.0
        }
      };
    }
  },
  {
    id: 'frequency-dispersion-collapse',
    title: 'Frequency Dispersion Collapse in Grid Harmony',
    description: 'Instantaneous frequency variance drops by > 85% from weak coupling (K=0.2) to strong coupling (K=3.5), demonstrating network stabilization.',
    verify: () => {
      const weakModel = new KuramotoModel({
        oscillatorCount: 64,
        couplingStrength: 0.2,
        frequencySpread: 0.8,
        seed: 505
      });
      weakModel.run(600);
      const weakVar = weakModel.getMetrics().frequencyVariance;

      const strongModel = new KuramotoModel({
        oscillatorCount: 64,
        couplingStrength: 3.5,
        frequencySpread: 0.8,
        seed: 505
      });
      strongModel.run(600);
      const strongVar = strongModel.getMetrics().frequencyVariance;

      const reduction = (weakVar - strongVar) / weakVar;
      if (reduction < 0.85) {
        throw new Error(`Expected frequency variance reduction > 85%, got ${(reduction * 100).toFixed(2)}%`);
      }

      return {
        passed: true,
        evidence: {
          weakVariance: Number(weakVar.toFixed(4)),
          strongVariance: Number(strongVar.toFixed(4)),
          varianceReductionPercent: Number((reduction * 100).toFixed(2))
        }
      };
    }
  }
];
