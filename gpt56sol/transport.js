// @ts-check

export const COLS = 34;
export const ROWS = 20;
export const CUT_COUNT = 16;
export const DIFFUSION = 0.17;

/** @param {number} seed */
function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/** @param {number} a @param {number} b */
function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** @param {number} coherence @param {number} seed */
export function createCuts(coherence, seed = 7) {
  const amount = Math.max(0, Math.min(1, coherence));
  const seamCount = Math.round(CUT_COUNT * amount);
  const cuts = new Set();
  const center = Math.floor(COLS / 2) - 1;
  const rows = Array.from({ length: ROWS }, (_, row) => row);
  const random = randomSource(seed);

  rows.sort((a, b) => Math.abs(a - (ROWS - 1) / 2) - Math.abs(b - (ROWS - 1) / 2));
  for (const row of rows.slice(0, seamCount)) {
    const left = row * COLS + center;
    cuts.add(edgeKey(left, left + 1));
  }

  while (cuts.size < CUT_COUNT) {
    const horizontal = random() > 0.28;
    const x = Math.floor(random() * (horizontal ? COLS - 1 : COLS));
    const y = Math.floor(random() * (horizontal ? ROWS : ROWS - 1));
    const a = y * COLS + x;
    const b = horizontal ? a + 1 : a + COLS;
    cuts.add(edgeKey(a, b));
  }
  return cuts;
}

/** @param {Set<string>} cuts */
export function createState(cuts) {
  const values = new Float64Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row += 1) values[row * COLS] = 1;
  return { values, cuts, step: 0 };
}

/** @typedef {{ values: Float64Array, cuts: Set<string>, step: number }} TransportState */

/** @param {TransportState} state */
export function advance(state) {
  const next = new Float64Array(state.values);
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const index = y * COLS + x;
      if (x === 0) {
        next[index] = 1;
        continue;
      }
      let flow = 0;
      const neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x < COLS - 1) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - COLS);
      if (y < ROWS - 1) neighbors.push(index + COLS);
      for (const neighbor of neighbors) {
        if (!state.cuts.has(edgeKey(index, neighbor))) {
          flow += state.values[neighbor] - state.values[index];
        }
      }
      next[index] = Math.max(0, Math.min(1, state.values[index] + DIFFUSION * flow));
    }
  }
  return { values: next, cuts: state.cuts, step: state.step + 1 };
}

/** @param {Float64Array} values */
export function farEdgeMean(values) {
  let total = 0;
  for (let row = 0; row < ROWS; row += 1) total += values[row * COLS + COLS - 1];
  return total / ROWS;
}

/** @param {number} coherence @param {number} seed @param {number} [limit] */
export function measureArrival(coherence, seed, limit = 2400) {
  const cuts = createCuts(coherence, seed);
  let state = createState(cuts);
  let arrivalStep = Infinity;
  for (let step = 1; step <= limit; step += 1) {
    state = advance(state);
    if (arrivalStep === Infinity && farEdgeMean(state.values) >= 0.2) arrivalStep = step;
  }
  return {
    arrivalStep,
    finalMean: farEdgeMean(state.values),
    cutCount: cuts.size,
  };
}
