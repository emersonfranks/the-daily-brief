// @ts-check

import { analyzePattern, enumeratePatterns, expectedWaitingTime } from "./assembly.js";

/** @typedef {{ label: string, value: string }} Evidence */
/** @typedef {{ name: string, catches: string, verify: () => Evidence[] }} Claim */

/** @param {number[]} values */
function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** @param {import("./assembly.js").PatternAnalysis[]} rows */
function correlation(rows) {
  const meanAssembly = mean(rows.map((row) => row.assemblyIndex));
  const meanWaiting = mean(rows.map((row) => row.waitingTime));
  const covariance = rows.reduce((total, row) => total + (row.assemblyIndex - meanAssembly) * (row.waitingTime - meanWaiting), 0);
  const assemblyVariance = rows.reduce((total, row) => total + (row.assemblyIndex - meanAssembly) ** 2, 0);
  const waitingVariance = rows.reduce((total, row) => total + (row.waitingTime - meanWaiting) ** 2, 0);
  return covariance / Math.sqrt(assemblyVariance * waitingVariance);
}

/** @type {Claim[]} */
export const claims = [
  {
    name: "Exact waiting-time anchors",
    catches: "A recurrence or overlap calculation that no longer matches the fair-coin pattern theorem.",
    verify() {
      const anchors = { "001": 8, "000": 14, "0101": 20 };
      for (const [pattern, expected] of Object.entries(anchors)) {
        const actual = expectedWaitingTime(pattern);
        if (actual !== expected) throw new Error(`${pattern}: expected ${expected}, measured ${actual}`);
      }
      return Object.entries(anchors).map(([pattern, value]) => ({ label: pattern, value: `${value} flips` }));
    },
  },
  {
    name: "Every eight-bit build is valid",
    catches: "An assembly plan that uses a piece before building it or does not finish at its target.",
    verify() {
      const rows = enumeratePatterns(8);
      for (const row of rows) {
        const available = new Set(["0", "1"]);
        for (const step of row.steps) {
          if (!available.has(step.left) || !available.has(step.right) || step.left + step.right !== step.result) {
            throw new Error(`Invalid assembly step for ${row.pattern}`);
          }
          available.add(step.result);
        }
        if (!available.has(row.pattern)) throw new Error(`Assembly missed ${row.pattern}`);
      }
      return [
        { label: "patterns checked", value: String(rows.length) },
        { label: "invalid plans", value: "0" },
      ];
    },
  },
  {
    name: "Reuse and random waiting diverge",
    catches: "The shipped population no longer shows the inverse relationship that the page claims.",
    verify() {
      const rows = enumeratePatterns(8);
      const measuredCorrelation = correlation(rows);
      const compact = rows.filter((row) => row.assemblyIndex === 3);
      const elaborate = rows.filter((row) => row.assemblyIndex >= 5);
      const compactWait = mean(compact.map((row) => row.waitingTime));
      const elaborateWait = mean(elaborate.map((row) => row.waitingTime));
      if (measuredCorrelation > -0.4) throw new Error(`Correlation ${measuredCorrelation.toFixed(3)} is above -0.400`);
      if (compactWait <= elaborateWait * 1.5) throw new Error(`Waiting-time ratio ${(compactWait / elaborateWait).toFixed(2)} is too small`);
      return [
        { label: "all-pattern correlation", value: measuredCorrelation.toFixed(3) },
        { label: "3-step mean wait", value: `${compactWait.toFixed(0)} flips` },
        { label: "5-6-step mean wait", value: `${elaborateWait.toFixed(1)} flips` },
        { label: "ratio", value: `${(compactWait / elaborateWait).toFixed(2)}x` },
      ];
    },
  },
  {
    name: "The featured pattern is not cherry-picked",
    catches: "A featured pattern that stops belonging to the full set of minimum-step eight-bit builds.",
    verify() {
      const featured = analyzePattern("01010101");
      const rows = enumeratePatterns(8);
      const minimumSteps = Math.min(...rows.map((row) => row.assemblyIndex));
      const peers = rows.filter((row) => row.assemblyIndex === minimumSteps);
      if (featured.assemblyIndex !== minimumSteps) throw new Error("Featured pattern is not minimum-step");
      if (peers.length !== 4) throw new Error(`Expected 4 minimum-step patterns, measured ${peers.length}`);
      return [
        { label: "minimum steps", value: String(minimumSteps) },
        { label: "patterns tied", value: String(peers.length) },
        { label: "featured wait", value: `${featured.waitingTime} flips` },
      ];
    },
  },
];

export function runClaims() {
  return claims.map((claim) => {
    try {
      return { claim, passed: true, evidence: claim.verify(), error: "" };
    } catch (error) {
      return { claim, passed: false, evidence: [], error: error instanceof Error ? error.message : String(error) };
    }
  });
}
