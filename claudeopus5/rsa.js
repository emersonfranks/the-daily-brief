// @ts-check

/**
 * Random sequential adsorption (RSA): irreversible, one-at-a-time placement of
 * objects at uniformly random positions, rejecting any placement that overlaps
 * something already there. Nothing ever moves once placed and nothing is removed.
 *
 * This module is pure state + arithmetic. It never touches the DOM, so both
 * `node --test` and the page can run the identical code.
 */

/**
 * Deterministic PRNG (mulberry32). Same seed, same stream, on every engine.
 * @param {number} seed
 * @returns {() => number} uniform in [0, 1)
 */
export function makeRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rényi's parking constant, the exact 1-D RSA jamming coverage. */
export const RENYI_CONSTANT = 0.7475979202534;

/** Flory's exact jamming coverage for dimers on a 1-D lattice: 1 - e^-2. */
export const FLORY_DIMER_COVERAGE = 1 - Math.exp(-2);

/** Accepted numerical value for RSA of equal disks in 2-D. */
export const DISK_JAMMING_COVERAGE = 0.5470735;

/**
 * Palásti's 1960 conjecture: that 2-D disk jamming equals the square of the
 * 1-D parking constant. Retained here because the page measures against it.
 */
export const PALASTI_CONJECTURE = RENYI_CONSTANT * RENYI_CONSTANT;

/**
 * @typedef {Object} Kerb
 * @property {number} length          street length, in car lengths
 * @property {number[]} cars          left edges, kept sorted ascending
 * @property {number} attempts        drivers who have tried, successful or not
 * @property {number} feasible        measure of start positions that still fit a car
 * @property {boolean} jammed         true once no position anywhere admits a car
 * @property {number} lastAim         where the most recent driver aimed, for drawing near misses
 */

/**
 * A street of `length` car-lengths with nobody parked on it yet.
 * @param {number} length
 * @returns {Kerb}
 */
export function createKerb(length) {
  return {
    length,
    cars: [],
    attempts: 0,
    feasible: Math.max(0, length - 1),
    jammed: length < 1,
    lastAim: 0,
  };
}

/** @param {Kerb} kerb */
export function kerbCoverage(kerb) {
  return kerb.cars.length / kerb.length;
}

/**
 * Dimensionless RSA time: attempts per unit of street.
 * @param {Kerb} kerb
 */
export function kerbTime(kerb) {
  return kerb.attempts / kerb.length;
}

/**
 * Index of the first car whose left edge is >= x. Plain binary search.
 * @param {number[]} cars
 * @param {number} x
 */
function lowerBound(cars, x) {
  let lo = 0;
  let hi = cars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cars[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Free measure contributed by a gap spanning (a, b): the set of left edges in
 * that gap at which a unit car still fits.
 * @param {number} a
 * @param {number} b
 */
function gapFeasible(a, b) {
  return Math.max(0, b - a - 1);
}

/**
 * Insert a car at `x` and update the running feasible measure.
 * @param {Kerb} kerb
 * @param {number} index insertion index from lowerBound
 * @param {number} x
 */
function insertCar(kerb, index, x) {
  const cars = kerb.cars;
  const a = index === 0 ? 0 : cars[index - 1] + 1;
  const b = index === cars.length ? kerb.length : cars[index];
  kerb.feasible += gapFeasible(a, x) + gapFeasible(x + 1, b) - gapFeasible(a, b);
  if (kerb.feasible < 1e-12) kerb.feasible = 0;
  cars.splice(index, 0, x);
  kerb.jammed = kerb.feasible === 0;
}

/**
 * One driver arrives, aims at a uniformly random spot, and parks only if the
 * car fits without touching a neighbour. This is the literal RSA move.
 * @param {Kerb} kerb
 * @param {() => number} rand
 * @returns {boolean} whether the car parked
 */
export function attemptPark(kerb, rand) {
  if (kerb.jammed) return false;
  kerb.attempts += 1;
  const x = rand() * (kerb.length - 1);
  kerb.lastAim = x;
  const cars = kerb.cars;
  const index = lowerBound(cars, x);
  if (index > 0 && cars[index - 1] + 1 > x) return false;
  if (index < cars.length && x + 1 > cars[index]) return false;
  insertCar(kerb, index, x);
  return true;
}

/**
 * Skip forward over the failed attempts analytically instead of simulating each
 * one, then place the next successful car. Sampling the wait from a geometric
 * distribution and the position uniformly over the remaining feasible measure is
 * the same process as `attemptPark` in a loop, but finishes a jam in O(cars)
 * accepted moves rather than O(attempts) rejected ones.
 *
 * @param {Kerb} kerb
 * @param {() => number} rand
 * @returns {boolean} whether a car parked
 */
export function parkNext(kerb, rand) {
  if (kerb.jammed) return false;
  const p = kerb.feasible / (kerb.length - 1);
  if (p <= 0) {
    kerb.jammed = true;
    return false;
  }
  const u = Math.max(rand(), Number.MIN_VALUE);
  const denominator = Math.log(1 - p);
  const failures = p >= 1 || denominator === 0 ? 0 : Math.floor(Math.log(u) / denominator);
  kerb.attempts += failures + 1;

  let target = rand() * kerb.feasible;
  const cars = kerb.cars;
  let a = 0;
  let fallbackIndex = -1;
  let fallbackStart = 0;
  let fallbackRoom = 0;
  for (let i = 0; i <= cars.length; i += 1) {
    const b = i === cars.length ? kerb.length : cars[i];
    const room = gapFeasible(a, b);
    if (room > 0) {
      if (target < room) {
        insertCar(kerb, i, a + target);
        return true;
      }
      target -= room;
      fallbackIndex = i;
      fallbackStart = a;
      fallbackRoom = room;
    }
    a = b + 1;
  }
  // Rounding can push the sampled target a hair past the accumulated measure;
  // land it in the last gap that genuinely had room rather than nowhere.
  if (fallbackIndex >= 0) {
    insertCar(kerb, fallbackIndex, fallbackStart + fallbackRoom * 0.5);
    return true;
  }
  kerb.feasible = 0;
  kerb.jammed = true;
  return false;
}

/**
 * Park until nothing else fits anywhere.
 * @param {number} length
 * @param {number} seed
 * @returns {{ coverage: number, cars: number, attempts: number, kerb: Kerb }}
 */
export function jamKerb(length, seed) {
  const kerb = createKerb(length);
  const rand = makeRandom(seed);
  while (!kerb.jammed) {
    if (!parkNext(kerb, rand)) break;
  }
  return {
    coverage: kerbCoverage(kerb),
    cars: kerb.cars.length,
    attempts: kerb.attempts,
    kerb,
  };
}

/**
 * Coverage sampled at a rising list of RSA times, up to the jam.
 * @param {number} length
 * @param {number} seed
 * @param {number[]} sampleTimes ascending, in attempts per unit length
 * @returns {{ t: number, coverage: number }[]}
 */
export function kerbCoverageCurve(length, seed, sampleTimes) {
  const kerb = createKerb(length);
  const rand = makeRandom(seed);
  /** @type {{ t: number, coverage: number }[]} */
  const out = [];
  let next = 0;
  while (next < sampleTimes.length) {
    const targetAttempts = sampleTimes[next] * length;
    if (kerb.attempts >= targetAttempts || kerb.jammed) {
      out.push({ t: sampleTimes[next], coverage: kerbCoverage(kerb) });
      next += 1;
      continue;
    }
    parkNext(kerb, rand);
  }
  return out;
}

/**
 * Verify the defining invariant: no two parked cars overlap, and every car sits
 * on the street. A model that quietly accepts overlaps would report a higher
 * coverage and invalidate every other number on the page.
 * @param {Kerb} kerb
 * @returns {{ ok: boolean, minGap: number }}
 */
export function checkKerbInvariant(kerb) {
  let minGap = Infinity;
  const cars = kerb.cars;
  for (let i = 0; i < cars.length; i += 1) {
    if (cars[i] < -1e-9 || cars[i] + 1 > kerb.length + 1e-9) return { ok: false, minGap: -1 };
    if (i > 0) minGap = Math.min(minGap, cars[i] - (cars[i - 1] + 1));
  }
  return { ok: cars.length < 2 || minGap >= -1e-9, minGap: Number.isFinite(minGap) ? minGap : 0 };
}

/**
 * The considerate alternative: every driver parks flush against the nearest
 * parked car instead of stopping wherever they happened to aim. Same arrival
 * order, same street, only the choice of spot differs.
 * @param {number} length
 * @param {number} seed
 * @returns {{ coverage: number, cars: number }}
 */
export function attemptPolitePark(kerb, rand) {
  if (kerb.jammed) return false;
  kerb.attempts += 1;
  const cars = kerb.cars;
  const aim = rand() * (kerb.length - 1);
  kerb.lastAim = aim;
  if (cars.length === 0) {
    insertCar(kerb, 0, 0);
    return true;
  }
  const index = lowerBound(cars, aim);
  const leftEdge = index === 0 ? 0 : cars[index - 1] + 1;
  const rightEdge = index === cars.length ? kerb.length : cars[index];
  if (gapFeasible(leftEdge, rightEdge) > 0) {
    insertCar(kerb, index, leftEdge);
    return true;
  }
  // The gap the driver aimed at is already too small, so they carry on to the
  // widest one still open rather than giving up.
  let bestIndex = -1;
  let bestRoom = 0;
  let a = 0;
  for (let i = 0; i <= cars.length; i += 1) {
    const b = i === cars.length ? kerb.length : cars[i];
    const room = gapFeasible(a, b);
    if (room > bestRoom) {
      bestRoom = room;
      bestIndex = i;
    }
    a = b + 1;
  }
  if (bestIndex < 0) {
    kerb.feasible = 0;
    kerb.jammed = true;
    return false;
  }
  insertCar(kerb, bestIndex, bestIndex === 0 ? 0 : cars[bestIndex - 1] + 1);
  return true;
}

/**
 * Run the considerate street to a jam.
 * @param {number} length
 * @param {number} seed
 * @returns {{ coverage: number, cars: number }}
 */
export function jamPoliteKerb(length, seed) {
  const kerb = createKerb(length);
  const rand = makeRandom(seed);
  while (!kerb.jammed) {
    if (!attemptPolitePark(kerb, rand)) break;
  }
  return { coverage: kerbCoverage(kerb), cars: kerb.cars.length };
}

/**
 * Dimers dropped on a 1-D lattice: each lands on a random site and occupies
 * that site and the one to its right, if both are free. Flory solved this in
 * 1939 while modelling side reactions along a polymer chain.
 * @param {number} sites
 * @param {number} seed
 * @returns {{ coverage: number, dimers: number, attempts: number }}
 */
export function jamDimerLattice(sites, seed) {
  const occupied = new Uint8Array(sites);
  const rand = makeRandom(seed);
  /** @type {number[]} */
  let openStarts = [];
  for (let i = 0; i < sites - 1; i += 1) openStarts.push(i);
  let dimers = 0;
  let attempts = 0;
  while (openStarts.length > 0) {
    const pick = Math.floor(rand() * openStarts.length);
    const site = openStarts[pick];
    attempts += 1;
    if (occupied[site] === 0 && occupied[site + 1] === 0) {
      occupied[site] = 1;
      occupied[site + 1] = 1;
      dimers += 1;
    }
    openStarts[pick] = openStarts[openStarts.length - 1];
    openStarts.pop();
    if (dimers > 0 && openStarts.length > 0 && attempts % 4096 === 0) {
      openStarts = openStarts.filter((s) => occupied[s] === 0 && occupied[s + 1] === 0);
    }
  }
  return { coverage: (2 * dimers) / sites, dimers, attempts };
}

/**
 * @typedef {Object} Membrane
 * @property {number} size            box side, in disk diameters
 * @property {number} radius
 * @property {number[]} xs
 * @property {number[]} ys
 * @property {number} attempts
 * @property {Int32Array} cellHead
 * @property {Int32Array} cellNext
 * @property {number} cells
 * @property {number} cellSize
 * @property {number} lastAimX       where the most recent molecule landed, for drawing near misses
 * @property {number} lastAimY
 */

/**
 * A periodic square patch of surface with nothing adsorbed yet. Periodic edges
 * remove the boundary depletion that would otherwise bias the coverage low.
 * @param {number} size
 * @param {number} [radius]
 * @returns {Membrane}
 */
export function createMembrane(size, radius = 0.5) {
  const cells = Math.max(1, Math.floor(size / (2 * radius)));
  return {
    size,
    radius,
    xs: [],
    ys: [],
    attempts: 0,
    cellHead: new Int32Array(cells * cells).fill(-1),
    cellNext: new Int32Array(0),
    cells,
    cellSize: size / cells,
    lastAimX: 0,
    lastAimY: 0,
  };
}

/** @param {Membrane} m */
export function membraneCoverage(m) {
  return (m.xs.length * Math.PI * m.radius * m.radius) / (m.size * m.size);
}

/**
 * Dimensionless RSA time for the 2-D process: attempted disk areas per unit area.
 * @param {Membrane} m
 */
export function membraneTime(m) {
  return (m.attempts * Math.PI * m.radius * m.radius) / (m.size * m.size);
}

/**
 * One molecule arrives at a random point and sticks unless it would overlap a
 * molecule already bound.
 * @param {Membrane} m
 * @param {() => number} rand
 * @returns {boolean} whether it stuck
 */
export function attemptAdsorb(m, rand) {
  m.attempts += 1;
  const x = rand() * m.size;
  const y = rand() * m.size;
  m.lastAimX = x;
  m.lastAimY = y;
  const d2min = 4 * m.radius * m.radius;
  const cx = Math.min(m.cells - 1, Math.floor(x / m.cellSize));
  const cy = Math.min(m.cells - 1, Math.floor(y / m.cellSize));
  const reach = Math.ceil((2 * m.radius) / m.cellSize);
  for (let ox = -reach; ox <= reach; ox += 1) {
    for (let oy = -reach; oy <= reach; oy += 1) {
      const gx = (cx + ox + m.cells) % m.cells;
      const gy = (cy + oy + m.cells) % m.cells;
      let idx = m.cellHead[gy * m.cells + gx];
      while (idx !== -1) {
        let dx = Math.abs(x - m.xs[idx]);
        let dy = Math.abs(y - m.ys[idx]);
        if (dx > m.size * 0.5) dx = m.size - dx;
        if (dy > m.size * 0.5) dy = m.size - dy;
        if (dx * dx + dy * dy < d2min) return false;
        idx = m.cellNext[idx];
      }
    }
  }
  const index = m.xs.length;
  m.xs.push(x);
  m.ys.push(y);
  if (index >= m.cellNext.length) {
    const grown = new Int32Array(Math.max(1024, m.cellNext.length * 2));
    grown.set(m.cellNext);
    m.cellNext = grown;
  }
  const cell = cy * m.cells + cx;
  m.cellNext[index] = m.cellHead[cell];
  m.cellHead[cell] = index;
  return true;
}

/**
 * Coverage sampled at a rising list of RSA times.
 * @param {number} size
 * @param {number} seed
 * @param {number[]} sampleTimes ascending, in attempted areas per unit area
 * @returns {{ t: number, coverage: number }[]}
 */
export function membraneCoverageCurve(size, seed, sampleTimes) {
  const m = createMembrane(size);
  const rand = makeRandom(seed);
  /** @type {{ t: number, coverage: number }[]} */
  const out = [];
  const perTime = (m.size * m.size) / (Math.PI * m.radius * m.radius);
  for (const t of sampleTimes) {
    const targetAttempts = t * perTime;
    while (m.attempts < targetAttempts) attemptAdsorb(m, rand);
    out.push({ t, coverage: membraneCoverage(m) });
  }
  return out;
}

/**
 * Verify no two adsorbed disks overlap under the periodic metric.
 * @param {Membrane} m
 * @returns {{ ok: boolean, minCentreDistance: number }}
 */
export function checkMembraneInvariant(m) {
  let min = Infinity;
  for (let i = 0; i < m.xs.length; i += 1) {
    for (let j = i + 1; j < m.xs.length; j += 1) {
      let dx = Math.abs(m.xs[i] - m.xs[j]);
      let dy = Math.abs(m.ys[i] - m.ys[j]);
      if (dx > m.size * 0.5) dx = m.size - dx;
      if (dy > m.size * 0.5) dy = m.size - dy;
      min = Math.min(min, Math.hypot(dx, dy));
    }
  }
  const threshold = 2 * m.radius - 1e-9;
  return {
    ok: m.xs.length < 2 || min >= threshold,
    minCentreDistance: Number.isFinite(min) ? min : 0,
  };
}
