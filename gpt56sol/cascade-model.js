// @ts-check

/** @typedef {{ size: number, coupling: number, resistance: number[], state: number[] }} Cascade */

/**
 * @param {number} seed
 * @returns {() => number}
 */
function randomFrom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} size
 * @param {number} seed
 * @param {number} coupling
 * @param {1 | -1} initialState
 * @returns {Cascade}
 */
export function createCascade(size, seed, coupling = 0.72, initialState = 1) {
  const random = randomFrom(seed);
  const count = size * size;
  return {
    size,
    coupling,
    resistance: Array.from({ length: count }, () => (random() - 0.5) * 1.1),
    state: Array(count).fill(initialState),
  };
}

/**
 * @param {Cascade} cascade
 * @param {number} index
 * @returns {number}
 */
function neighborMean(cascade, index) {
  const { size, state } = cascade;
  const row = Math.floor(index / size);
  const column = index % size;
  let total = 0;
  let count = 0;
  if (row > 0) { total += state[index - size]; count += 1; }
  if (row < size - 1) { total += state[index + size]; count += 1; }
  if (column > 0) { total += state[index - 1]; count += 1; }
  if (column < size - 1) { total += state[index + 1]; count += 1; }
  return total / count;
}

/**
 * @param {Cascade} cascade
 * @param {number} pressure
 * @param {number} [limit]
 * @returns {number}
 */
export function settle(cascade, pressure, limit = 120) {
  let flips = 0;
  for (let pass = 0; pass < limit; pass += 1) {
    const next = [...cascade.state];
    let changed = 0;
    for (let index = 0; index < next.length; index += 1) {
      const field = pressure + cascade.resistance[index] + cascade.coupling * neighborMean(cascade, index);
      const state = field >= 0 ? 1 : -1;
      if (state !== cascade.state[index]) {
        next[index] = state;
        changed += 1;
      }
    }
    cascade.state = next;
    flips += changed;
    if (changed === 0) return flips;
  }
  return flips;
}

/**
 * @param {Cascade} cascade
 * @returns {number}
 */
export function positiveShare(cascade) {
  return cascade.state.filter((state) => state === 1).length / cascade.state.length;
}

/**
 * @param {Cascade} cascade
 * @param {number} center
 * @param {number} radius
 * @param {1 | -1} state
 */
export function seedPatch(cascade, center, radius, state) {
  const centerRow = Math.floor(center / cascade.size);
  const centerColumn = center % cascade.size;
  for (let row = 0; row < cascade.size; row += 1) {
    for (let column = 0; column < cascade.size; column += 1) {
      if (Math.hypot(row - centerRow, column - centerColumn) <= radius) {
        cascade.state[row * cascade.size + column] = state;
      }
    }
  }
}

/**
 * @param {number} seed
 * @param {number} coupling
 * @returns {{ pressure: number, descending: number, ascending: number }[]}
 */
export function runSweep(seed, coupling = 0.72) {
  const descendingCascade = createCascade(26, seed, coupling, 1);
  const ascendingCascade = createCascade(26, seed, coupling, -1);
  const pressures = Array.from({ length: 33 }, (_, index) => 1.6 - index * 0.1);
  const descending = new Map();
  const ascending = new Map();
  for (const pressure of pressures) {
    settle(descendingCascade, pressure);
    descending.set(pressure.toFixed(1), positiveShare(descendingCascade));
  }
  for (const pressure of [...pressures].reverse()) {
    settle(ascendingCascade, pressure);
    ascending.set(pressure.toFixed(1), positiveShare(ascendingCascade));
  }
  return pressures.map((pressure) => ({
    pressure,
    descending: descending.get(pressure.toFixed(1)) ?? 0,
    ascending: ascending.get(pressure.toFixed(1)) ?? 0,
  }));
}