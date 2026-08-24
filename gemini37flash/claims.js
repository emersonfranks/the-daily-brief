// @ts-check
import { SandpileModel } from './sandpile-model.js';

export const CLAIMS = [
  {
    id: 'abelian-commutativity-invariance',
    title: 'Abelian Commutativity Invariance',
    statement:
      'The final lattice configuration and cumulative toppling count are strictly invariant to the sequential order of perturbation additions (A·B = B·A).',
    verify() {
      const size = 32;
      const modelA = new SandpileModel(size, 101);
      const modelB = new SandpileModel(size, 101);

      modelA.fastForward(500);
      for (let i = 0; i < modelA.grid.length; i++) {
        modelB.grid[i] = modelA.grid[i];
      }
      modelB.totalAdded = modelA.totalAdded;
      modelB.totalDissipated = modelA.totalDissipated;
      modelB.totalTopplings = modelA.totalTopplings;

      const p1 = [10, 15];
      const p2 = [11, 15];

      const rA1 = modelA.addGrain(p1[0], p1[1]);
      const rA2 = modelA.addGrain(p2[0], p2[1]);
      const totalTopplesA = rA1.size + rA2.size;

      const rB1 = modelB.addGrain(p2[0], p2[1]);
      const rB2 = modelB.addGrain(p1[0], p1[1]);
      const totalTopplesB = rB1.size + rB2.size;

      let differences = 0;
      for (let i = 0; i < modelA.grid.length; i++) {
        if (modelA.grid[i] !== modelB.grid[i]) {
          differences++;
        }
      }

      const passed = differences === 0 && totalTopplesA === totalTopplesB;

      return {
        id: 'abelian-commutativity-invariance',
        title: 'Abelian Commutativity Invariance',
        statement:
          'The final lattice configuration and cumulative toppling count are strictly invariant to the sequential order of perturbation additions (A·B = B·A).',
        passed,
        evidence: `Mismatched cells=${differences} across order permutation. Total toppling events A=${totalTopplesA}, B=${totalTopplesB} (A - B = ${totalTopplesA - totalTopplesB}).`,
        metrics: {
          differences,
          totalTopplesA,
          totalTopplesB,
          passed
        }
      };
    }
  },

  {
    id: 'soc-critical-mean-density',
    title: 'Self-Organized Critical Mean Density Attractor',
    statement:
      'Starting from an empty lattice, slow stochastic driving autonomously pulls average height to the critical attractor mean <z> in [2.05, 2.20] (theoretical BTW limit ~2.125).',
    verify() {
      const size = 48;
      const model = new SandpileModel(size, 2024);
      model.fastForward(size * size * 6);

      const meanHeight = model.getMeanHeight();
      const expectedMin = 2.05;
      const expectedMax = 2.20;
      const passed = meanHeight >= expectedMin && meanHeight <= expectedMax;

      const dist = model.getHeightDistribution();
      const totalCells = size * size;

      return {
        id: 'soc-critical-mean-density',
        title: 'Self-Organized Critical Mean Density Attractor',
        statement:
          'Starting from an empty lattice, slow stochastic driving autonomously pulls average height to the critical attractor mean <z> in [2.05, 2.20] (theoretical BTW limit ~2.125).',
        passed,
        evidence: `Measured mean height <z>=${meanHeight.toFixed(4)} (target [${expectedMin}, ${expectedMax}], BTW attractor ~2.125). Cell height fractions: z0=${(dist[0]/totalCells).toFixed(2)}, z1=${(dist[1]/totalCells).toFixed(2)}, z2=${(dist[2]/totalCells).toFixed(2)}, z3=${(dist[3]/totalCells).toFixed(2)}.`,
        metrics: {
          meanHeight: Number(meanHeight.toFixed(4)),
          passed
        }
      };
    }
  },

  {
    id: 'scale-free-power-law-scaling',
    title: 'Scale-Free Power-Law Avalanche Size Distribution',
    statement:
      'In the critical state, avalanche sizes follow a scale-free power law P(S) ~ S^(-tau) spanning multiple decades with exponent tau in [0.95, 1.60] and log-log linearity R^2 >= 0.85.',
    verify() {
      const size = 48;
      const model = new SandpileModel(size, 999);
      model.fastForward(size * size * 4);

      model.avalancheHistory = [];
      const numEvents = 8000;
      for (let i = 0; i < numEvents; i++) {
        model.dropRandom();
      }

      const stats = model.getLogLogDistribution(14);
      const absSlope = Math.abs(stats.slope);
      const passed = absSlope >= 0.95 && absSlope <= 1.60 && stats.r2 >= 0.85;

      return {
        id: 'scale-free-power-law-scaling',
        title: 'Scale-Free Power-Law Avalanche Size Distribution',
        statement:
          'In the critical state, avalanche sizes follow a scale-free power law P(S) ~ S^(-tau) spanning multiple decades with exponent tau in [0.95, 1.60] and log-log linearity R^2 >= 0.85.',
        passed,
        evidence: `Power-law exponent tau=${absSlope.toFixed(3)} (target [0.95, 1.60]). Log-log linear correlation R^2=${stats.r2.toFixed(3)} (threshold >=0.85). Sampled 8,000 driving events.`,
        metrics: {
          tau: Number(absSlope.toFixed(3)),
          r2: Number(stats.r2.toFixed(3)),
          passed
        }
      };
    }
  },

  {
    id: 'boundary-dissipation-conservation',
    title: 'Stationary Boundary Dissipation Conservation',
    statement:
      'At critical steady state, global energy conservation holds: exactly one unit of stress/grain dissipates across lattice boundaries per unit injected on average (<D>/<injected> = 1.00 ± 0.08).',
    verify() {
      const size = 32;
      const model = new SandpileModel(size, 777);
      model.fastForward(size * size * 6);

      const addedStart = model.totalAdded;
      const dissipatedStart = model.totalDissipated;

      const sampleDrops = 4000;
      for (let i = 0; i < sampleDrops; i++) {
        model.dropRandom();
      }

      const deltaAdded = model.totalAdded - addedStart;
      const deltaDissipated = model.totalDissipated - dissipatedStart;
      const ratio = deltaDissipated / deltaAdded;
      const passed = ratio >= 0.92 && ratio <= 1.08;

      return {
        id: 'boundary-dissipation-conservation',
        title: 'Stationary Boundary Dissipation Conservation',
        statement:
          'At critical steady state, global energy conservation holds: exactly one unit of stress/grain dissipates across lattice boundaries per unit injected on average (<D>/<injected> = 1.00 ± 0.08).',
        passed,
        evidence: `Injected=${deltaAdded}, Dissipated=${deltaDissipated}, Ratio=${ratio.toFixed(4)} (target 1.00 ± 0.08).`,
        metrics: {
          ratio: Number(ratio.toFixed(4)),
          deltaAdded,
          deltaDissipated,
          passed
        }
      };
    }
  },

  {
    id: 'subcritical-vs-critical-divergence',
    title: 'Subcritical vs Critical Scale Divergence',
    statement:
      'Subcritical sparse configurations truncate cascades exponentially (max cascade <= 12), whereas critical configurations exhibit scale-free cascades spanning the system size (max cascade >= 100).',
    verify() {
      const size = 32;
      const subcriticalModel = new SandpileModel(size, 404);
      for (let i = 0; i < subcriticalModel.grid.length; i++) {
        subcriticalModel.grid[i] = 1;
      }

      let subcriticalMax = 0;
      for (let i = 0; i < 500; i++) {
        const res = subcriticalModel.dropRandom();
        if (res.size > subcriticalMax) subcriticalMax = res.size;
      }

      const criticalModel = new SandpileModel(size, 505);
      criticalModel.fastForward(size * size * 5);

      let criticalMax = 0;
      for (let i = 0; i < 500; i++) {
        const res = criticalModel.dropRandom();
        if (res.size > criticalMax) criticalMax = res.size;
      }

      const passed = subcriticalMax <= 12 && criticalMax >= 100;

      return {
        id: 'subcritical-vs-critical-divergence',
        title: 'Subcritical vs Critical Scale Divergence',
        statement:
          'Subcritical sparse configurations truncate cascades exponentially (max cascade <= 12), whereas critical configurations exhibit scale-free cascades spanning the system size (max cascade >= 100).',
        passed,
        evidence: `Subcritical max cascade=${subcriticalMax} (threshold <=12) vs Critical max cascade=${criticalMax} (threshold >=100).`,
        metrics: {
          subcriticalMax,
          criticalMax,
          passed
        }
      };
    }
  }
];

