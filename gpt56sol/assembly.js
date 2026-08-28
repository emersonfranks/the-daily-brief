// @ts-check

/** @typedef {{ left: string, right: string, result: string }} AssemblyStep */
/** @typedef {{ pattern: string, steps: AssemblyStep[], assemblyIndex: number, waitingTime: number, borderLengths: number[], overlapTax: number }} PatternAnalysis */

const binaryAlphabet = ["0", "1"];

/** @param {string} pattern */
export function validatePattern(pattern) {
  if (!/^[01]{2,10}$/.test(pattern)) {
    throw new Error("Pattern must contain 2 to 10 binary digits.");
  }
}

/** @param {string} pattern */
export function borderLengths(pattern) {
  validatePattern(pattern);
  const lengths = [];
  for (let length = 1; length <= pattern.length; length += 1) {
    if (pattern.slice(0, length) === pattern.slice(-length)) {
      lengths.push(length);
    }
  }
  return lengths;
}

/** @param {string} pattern */
export function expectedWaitingTime(pattern) {
  return borderLengths(pattern).reduce((total, length) => total + 2 ** length, 0);
}

/** @param {string} pattern */
function candidateParts(pattern) {
  const candidates = new Set();
  for (let start = 0; start < pattern.length; start += 1) {
    for (let end = start + 2; end <= pattern.length; end += 1) {
      candidates.add(pattern.slice(start, end));
    }
  }
  return [...candidates].sort((left, right) => left.length - right.length || left.localeCompare(right));
}

/** @param {string} pattern */
export function shortestAssembly(pattern) {
  validatePattern(pattern);
  const candidates = candidateParts(pattern);
  const candidateIndex = new Map(candidates.map((candidate, index) => [candidate, index]));
  const targetIndex = candidateIndex.get(pattern);
  if (targetIndex === undefined) {
    throw new Error("Target is missing from its candidate set.");
  }

  const initial = { mask: 0n, steps: /** @type {AssemblyStep[]} */ ([]) };
  let frontier = [initial];
  const visited = new Set([initial.mask]);

  while (frontier.length > 0) {
    const nextFrontier = [];
    for (const state of frontier) {
      const known = [...binaryAlphabet];
      for (let index = 0; index < candidates.length; index += 1) {
        if ((state.mask & (1n << BigInt(index))) !== 0n) {
          known.push(candidates[index]);
        }
      }

      for (const left of known) {
        for (const right of known) {
          const result = left + right;
          const resultIndex = candidateIndex.get(result);
          if (resultIndex === undefined) continue;
          const bit = 1n << BigInt(resultIndex);
          if ((state.mask & bit) !== 0n) continue;
          const steps = [...state.steps, { left, right, result }];
          if (resultIndex === targetIndex) {
            return steps;
          }
          const mask = state.mask | bit;
          if (!visited.has(mask)) {
            visited.add(mask);
            nextFrontier.push({ mask, steps });
          }
        }
      }
    }
    frontier = nextFrontier;
  }

  throw new Error(`No assembly path found for ${pattern}.`);
}

/** @param {string} pattern */
export function analyzePattern(pattern) {
  const steps = shortestAssembly(pattern);
  const waitingTime = expectedWaitingTime(pattern);
  const minimumWait = 2 ** pattern.length;
  return {
    pattern,
    steps,
    assemblyIndex: steps.length,
    waitingTime,
    borderLengths: borderLengths(pattern),
    overlapTax: waitingTime - minimumWait,
  };
}

/** @param {number} length */
export function enumeratePatterns(length) {
  if (!Number.isInteger(length) || length < 2 || length > 10) {
    throw new Error("Length must be an integer from 2 through 10.");
  }
  return Array.from({ length: 2 ** length }, (_, value) => analyzePattern(value.toString(2).padStart(length, "0")));
}
