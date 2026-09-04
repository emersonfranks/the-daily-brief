// @ts-check

/** @typedef {'bacteria' | 'archaea'} Lineage */
/** @typedef {{ support: number, lineage: Lineage, damaged: number | null }} State */

export const reactions = [
  { id: 'carbon', cell: 'carbon entry', town: 'water intake', x: 0.10, y: 0.50, inherited: true },
  { id: 'split', cell: 'carbon split', town: 'main junction', x: 0.24, y: 0.50, inherited: true },
  { id: 'redox-a', cell: 'redox relay A', town: 'north transformer', x: 0.38, y: 0.30, inherited: false },
  { id: 'phosphorylate-a', cell: 'phosphate coupling A', town: 'north workshop', x: 0.53, y: 0.30, inherited: false },
  { id: 'carbon-a', cell: 'carbon assembly A', town: 'north homes', x: 0.68, y: 0.30, inherited: true },
  { id: 'redox-b', cell: 'redox relay B', town: 'south transformer', x: 0.38, y: 0.70, inherited: false },
  { id: 'phosphorylate-b', cell: 'phosphate coupling B', town: 'south workshop', x: 0.53, y: 0.70, inherited: false },
  { id: 'carbon-b', cell: 'carbon assembly B', town: 'south homes', x: 0.68, y: 0.70, inherited: true },
  { id: 'merge', cell: 'precursor merge', town: 'storage depot', x: 0.80, y: 0.50, inherited: false },
  { id: 'energy', cell: 'energy relay', town: 'local generator', x: 0.90, y: 0.50, inherited: false },
  { id: 'membrane', cell: 'boundary building', town: 'weatherproofing', x: 0.68, y: 0.88, inherited: true },
  { id: 'output', cell: 'biomass output', town: 'independent town', x: 0.96, y: 0.74, inherited: true }
];

export const links = [
  [0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7],
  [4, 8], [7, 8], [8, 9], [7, 10], [9, 11], [10, 11]
];

const replacementIndices = reactions
  .map((reaction, index) => ({ reaction, index }))
  .filter(({ reaction }) => !reaction.inherited)
  .map(({ index }) => index);

/**
 * Inherited reactions already have an enzyme. For the six modeled transitions,
 * environmental and local capacity trade one-for-one.
 * @param {number} index
 * @param {State} state
 */
export function reactionCapacity(index, state) {
  const reaction = reactions[index];
  if (reaction.inherited) return 1;
  const geology = clamp(state.support);
  const local = state.damaged === index ? 0 : 1 - geology;
  return clamp(geology + local);
}

/** @param {State} state */
export function networkThroughput(state) {
  return Math.min(...reactions.map((_, index) => reactionCapacity(index, state)));
}

/** @param {number} value */
export function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

/** @param {Lineage} lineage @param {number} samples */
export function measureTransition(lineage, samples = 101) {
  const values = Array.from({ length: samples }, (_, index) => {
    const support = 1 - index / (samples - 1);
    return networkThroughput({ support, lineage, damaged: null });
  });
  return {
    lineage,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    spread: Math.max(...values) - Math.min(...values),
    samples
  };
}

/** @param {Lineage} lineage */
export function toolkit(lineage) {
  return replacementIndices.map((index) => `${lineage === 'bacteria' ? 'B' : 'A'}-${reactions[index].id}`);
}

export function compareToolkits() {
  const bacteria = toolkit('bacteria');
  const archaea = toolkit('archaea');
  const sharedReplacements = bacteria.filter((part) => archaea.includes(part)).length;
  return {
    modeledReactions: reactions.length,
    inheritedReactions: reactions.length - replacementIndices.length,
    replacementReactions: replacementIndices.length,
    sharedReplacements
  };
}

/** @param {number} damaged */
export function measureRescue(damaged = replacementIndices[0]) {
  const supports = [0, 0.25, 0.5, 0.75, 1];
  const throughputs = supports.map((support) =>
    networkThroughput({ support, lineage: 'bacteria', damaged })
  );
  return { damaged, supports, throughputs };
}
