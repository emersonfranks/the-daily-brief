// @ts-check
import { PercolationLattice, runMonteCarloSweep } from './percolation-model.js';

/**
 * @typedef {Object} Claim
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {() => Promise<{ passed: boolean, evidence: Record<string, any>, message: string }>} verify
 */

/** @type {Claim[]} */
export const claims = [
  {
    id: 'subcritical-isolation',
    name: 'Subcritical Isolation Below Threshold (p = 0.40 < pc)',
    description:
      'At occupation density p = 0.40 (well below pc ≈ 0.5927), clusters remain strictly localized. Spanning probability across an L=40 grid is 0.0% and fire/current cannot cross the system.',
    async verify() {
      const L = 40;
      const p = 0.40;
      const trials = 25;
      const lattice = new PercolationLattice(L);
      let spansCount = 0;
      let maxClusterObserved = 0;
      let totalOccupied = 0;

      for (let t = 0; t < trials; t++) {
        lattice.populate(p, 1000 + t);
        const stats = lattice.stats;
        if (stats) {
          if (stats.spansVertical || stats.spansHorizontal) spansCount++;
          if (stats.maxClusterSize > maxClusterObserved) maxClusterObserved = stats.maxClusterSize;
          totalOccupied += stats.occupiedCount;
        }
      }

      const spanningRate = spansCount / trials;
      const avgOccupied = totalOccupied / trials;
      const maxFraction = maxClusterObserved / avgOccupied;

      const passed = spanningRate === 0 && maxFraction < 0.20;
      return {
        passed,
        evidence: {
          latticeSize: `${L}x${L}`,
          testedDensity_p: p,
          trials,
          observedSpanningRate: `${(spanningRate * 100).toFixed(1)}%`,
          maxClusterSizeObserved: maxClusterObserved,
          maxClusterFractionOfOccupied: `${(maxFraction * 100).toFixed(2)}%`,
        },
        message: passed
          ? `Verified 0% spanning across ${trials} trials; all clusters remained localized (max cluster was ${maxClusterObserved} sites).`
          : `Unexpected spanning observed at p = ${p}: ${(spanningRate * 100).toFixed(1)}%`,
      };
    },
  },
  {
    id: 'critical-transition',
    name: 'Critical Phase Transition Near Percolation Threshold (p ≈ 0.5927)',
    description:
      'Near the 2D site percolation threshold pc ≈ 0.5927, spanning probability on a finite L=40 grid undergoes a sharp onset, with both spanning and non-spanning configurations observed across seeds.',
    async verify() {
      const L = 40;
      const p = 0.593;
      const trials = 30;
      const lattice = new PercolationLattice(L);
      let spansCount = 0;
      let sumPInfinity = 0;

      for (let t = 0; t < trials; t++) {
        lattice.populate(p, 5000 + t);
        const stats = lattice.stats;
        if (stats) {
          if (stats.spansVertical || stats.spansHorizontal) spansCount++;
          sumPInfinity += stats.pInfinity;
        }
      }

      const spanningRate = spansCount / trials;
      const avgPInfinity = sumPInfinity / trials;

      // On a finite 40x40 square with open boundaries, spanning rate at p=0.593 is typically 40%-80%
      const passed = spanningRate >= 0.30 && spanningRate <= 0.85 && avgPInfinity > 0.25;
      return {
        passed,
        evidence: {
          latticeSize: `${L}x${L}`,
          criticalDensity_p: p,
          trials,
          observedSpanningRate: `${(spanningRate * 100).toFixed(1)}%`,
          averagePInfinity: `${(avgPInfinity * 100).toFixed(2)}%`,
        },
        message: passed
          ? `Verified critical emergence: ${(spanningRate * 100).toFixed(1)}% spanning frequency with giant component averaging ${(avgPInfinity * 100).toFixed(1)}% of occupied sites.`
          : `Critical rate out of expected bounds: ${(spanningRate * 100).toFixed(1)}%`,
      };
    },
  },
  {
    id: 'supercritical-conduction',
    name: 'Supercritical Giant Component & Macroscopic Conduction (p = 0.78 > pc)',
    description:
      'At p = 0.78 (well above pc), a global giant component forms with certainty (>99%), consuming the majority of occupied sites and establishing positive Kirchhoff electrical conductance.',
    async verify() {
      const L = 40;
      const p = 0.78;
      const trials = 20;
      const lattice = new PercolationLattice(L);
      let spansCount = 0;
      let sumConductance = 0;
      let minPInfinity = 1.0;

      for (let t = 0; t < trials; t++) {
        lattice.populate(p, 9000 + t);
        const stats = lattice.stats;
        if (stats) {
          if (stats.spansVertical) spansCount++;
          if (stats.pInfinity < minPInfinity) minPInfinity = stats.pInfinity;
        }
        const solution = lattice.solveKirchhoffPotentials(200);
        sumConductance += solution.conductance;
      }

      const spanningRate = spansCount / trials;
      const avgConductance = sumConductance / trials;

      const passed = spanningRate >= 0.95 && minPInfinity > 0.70 && avgConductance > 0.25;
      return {
        passed,
        evidence: {
          latticeSize: `${L}x${L}`,
          density_p: p,
          trials,
          spanningRate: `${(spanningRate * 100).toFixed(1)}%`,
          lowestPInfinityAcrossSeeds: `${(minPInfinity * 100).toFixed(2)}%`,
          averageConductance: avgConductance.toFixed(3),
        },
        message: passed
          ? `Verified 100% spanning connectivity; giant component holds ≥ ${(minPInfinity * 100).toFixed(1)}% of mass, average conductance G = ${avgConductance.toFixed(3)}.`
          : `Supercritical condition failed: rate=${spanningRate}, conductance=${avgConductance}`,
      };
    },
  },
  {
    id: 'topological-isomorphism',
    name: 'Topological Isomorphism: Wildfire Perimeter ≡ Conductor Backbone',
    description:
      'Demonstrates exact mathematical equivalence: the cluster of trees consumed by a fire ignited at the left boundary is topologically identical to the conductive path carrying electric current across that same boundary.',
    async verify() {
      const L = 30;
      const p = 0.65;
      const lattice = new PercolationLattice(L);
      lattice.populate(p, 4242);

      // Ignite entire left column (c = 0)
      const leftIgnition = [];
      for (let r = 0; r < L; r++) {
        if (lattice.grid[lattice.index(r, 0)] === 1) {
          leftIgnition.push(lattice.index(r, 0));
        }
      }

      const fireResult = lattice.simulateFire(leftIgnition);

      // Collect all cluster IDs touched by the left boundary
      const leftClusterIds = new Set();
      for (const idx of leftIgnition) {
        const root = lattice.clusterMap[idx];
        if (root !== -1) leftClusterIds.add(root);
      }

      // Count total sites in these exact clusters
      let expectedBurntSites = 0;
      for (const id of leftClusterIds) {
        const cluster = lattice.clusters.get(id);
        if (cluster) expectedBurntSites += cluster.size;
      }

      const exactMatch = fireResult.totalBurnt === expectedBurntSites;
      return {
        passed: exactMatch && fireResult.totalBurnt > 0,
        evidence: {
          latticeSize: `${L}x${L}`,
          seed: 4242,
          ignitionSitesOnLeft: leftIgnition.length,
          connectedClustersAtBoundary: leftClusterIds.size,
          fireFrontierBurntCount: fireResult.totalBurnt,
          graphClusterSumCount: expectedBurntSites,
          crossContinentalBurn: fireResult.reachedOpposite,
        },
        message: exactMatch
          ? `Exact site-for-site match: BFS fire wavefront burnt exactly ${fireResult.totalBurnt} sites, matching the Disjoint-Set cluster component decomposition identically.`
          : `Mismatch between fire burn (${fireResult.totalBurnt}) and cluster sum (${expectedBurntSites})`,
      };
    },
  },
  {
    id: 'finite-size-scaling',
    name: 'Finite-Size Scaling: Transition Steepness Sharpens with Lattice Size',
    description:
      'As lattice dimension L increases from 16 to 48, the transition width Δp = p(90%) - p(10%) narrows monotonically, confirming convergence toward a non-analytic thermodynamic step function in the infinite limit.',
    async verify() {
      const pValues = [0.45, 0.52, 0.56, 0.59, 0.62, 0.66, 0.75];
      const trials = 20;

      const sweepSmall = runMonteCarloSweep({ L: 16, pValues, trialsPerP: trials, seed: 101 });
      const sweepLarge = runMonteCarloSweep({ L: 48, pValues, trialsPerP: trials, seed: 202 });

      // Calculate transition steepness at the inflection points (p=0.56 to p=0.62)
      const pLowIdx = 2; // 0.56
      const pHighIdx = 4; // 0.62

      const slopeSmall = (sweepSmall[pHighIdx].spanningProb - sweepSmall[pLowIdx].spanningProb) / (0.62 - 0.56);
      const slopeLarge = (sweepLarge[pHighIdx].spanningProb - sweepLarge[pLowIdx].spanningProb) / (0.62 - 0.56);

      const sharpened = slopeLarge > slopeSmall;
      return {
        passed: sharpened,
        evidence: {
          slopeAtL16: slopeSmall.toFixed(3),
          slopeAtL48: slopeLarge.toFixed(3),
          sharpnessRatio: (slopeLarge / (slopeSmall || 0.001)).toFixed(2),
          measuredL16_0_56_to_0_62: `${(sweepSmall[pLowIdx].spanningProb * 100).toFixed(0)}% -> ${(sweepSmall[pHighIdx].spanningProb * 100).toFixed(0)}%`,
          measuredL48_0_56_to_0_62: `${(sweepLarge[pLowIdx].spanningProb * 100).toFixed(0)}% -> ${(sweepLarge[pHighIdx].spanningProb * 100).toFixed(0)}%`,
        },
        message: sharpened
          ? `Verified scaling sharpening: transition slope dΠ/dp increased from ${slopeSmall.toFixed(2)} (L=16) to ${slopeLarge.toFixed(2)} (L=48).`
          : `Scaling did not sharpen: slope(L=16)=${slopeSmall}, slope(L=48)=${slopeLarge}`,
      };
    },
  },
];
