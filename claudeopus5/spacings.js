// @ts-check

/**
 * @callback Rng
 * @returns {number}
 */

/**
 * @param {number} seed
 * @returns {Rng}
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Rng} rng
 * @returns {number}
 */
export function gaussian(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * @param {number} x
 * @returns {number}
 */
export function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - poly * Math.exp(-a * a));
}

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/**
 * @param {number} z
 * @returns {number}
 */
export function lgamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  const w = z - 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i++) x += LANCZOS[i] / (w + i + 1);
  const t = w + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (w + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * @param {number} a
 * @param {number} x
 * @returns {number}
 */
export function lowerGammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a;
    let del = 1 / a;
    let sum = del;
    for (let i = 0; i < 800; i++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 800; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

/** @param {number} s @returns {number} */
export function poissonPdf(s) {
  return Math.exp(-s);
}

/** @param {number} s @returns {number} */
export function poissonCdf(s) {
  return s <= 0 ? 0 : 1 - Math.exp(-s);
}

/** @param {number} s @param {number} beta @returns {number} */
export function wignerPdf(s, beta) {
  if (s <= 0) return 0;
  if (beta === 1) return (Math.PI / 2) * s * Math.exp((-Math.PI * s * s) / 4);
  return (32 / (Math.PI * Math.PI)) * s * s * Math.exp((-4 * s * s) / Math.PI);
}

/** @param {number} s @param {number} beta @returns {number} */
export function wignerCdf(s, beta) {
  if (s <= 0) return 0;
  if (beta === 1) return 1 - Math.exp((-Math.PI * s * s) / 4);
  return erf((2 * s) / Math.sqrt(Math.PI)) - ((4 * s) / Math.PI) * Math.exp((-4 * s * s) / Math.PI);
}

/** @param {number} s @param {number} beta @returns {number} */
export function gammaSpacingPdf(s, beta) {
  const k = beta + 1;
  if (s <= 0) return beta > 0 ? 0 : 1;
  return Math.exp(k * Math.log(k) + (k - 1) * Math.log(s) - k * s - lgamma(k));
}

/** @param {number} s @param {number} beta @returns {number} */
export function gammaSpacingCdf(s, beta) {
  const k = beta + 1;
  return lowerGammaP(k, k * s);
}

/** @param {number} x @returns {number} */
export function semicircleCdf(x) {
  const c = Math.max(-2, Math.min(2, x));
  return 0.5 + ((c * Math.sqrt(4 - c * c)) / 2 + 2 * Math.asin(c / 2)) / (2 * Math.PI);
}

const FORCE_CLAMP = 400;
const MIN_GAP = 2e-3;

export class BusGas {
  /**
   * @param {{count?:number, beta?:number, mode?:'nearest'|'allpairs', rng:Rng}} opts
   */
  constructor(opts) {
    this.count = opts.count ?? 48;
    this.beta = opts.beta ?? 2;
    this.mode = opts.mode ?? 'allpairs';
    this.rng = opts.rng;
    this.ring = this.count;
    this.y = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) this.y[i] = this.rng() * this.ring;
    this.y.sort();
    this.force = new Float64Array(this.count);
  }

  /** @param {number} beta */
  setBeta(beta) {
    this.beta = beta;
  }

  /** @param {'nearest'|'allpairs'} mode */
  setMode(mode) {
    this.mode = mode;
  }

  computeForces() {
    const { count, y, force, beta, ring } = this;
    force.fill(0);
    if (beta === 0) return;
    if (this.mode === 'nearest') {
      for (let i = 0; i < count; i++) {
        const next = i === count - 1 ? y[0] + ring : y[i + 1];
        const gap = Math.max(MIN_GAP, next - y[i]);
        const f = beta / gap;
        force[i] -= f;
        force[i === count - 1 ? 0 : i + 1] += f;
      }
    } else {
      const k = Math.PI / ring;
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const angle = k * (y[i] - y[j]);
          const sin = Math.sin(angle);
          const safe = Math.abs(sin) < 1e-4 ? (sin < 0 ? -1e-4 : 1e-4) : sin;
          const f = beta * k * (Math.cos(angle) / safe);
          force[i] += f;
          force[j] -= f;
        }
      }
    }
    for (let i = 0; i < count; i++) {
      force[i] = Math.max(-FORCE_CLAMP, Math.min(FORCE_CLAMP, force[i]));
    }
  }

  /**
   * @param {number} dt
   * @param {number} [substeps]
   */
  step(dt, substeps = 1) {
    const noise = Math.sqrt(2 * dt);
    for (let s = 0; s < substeps; s++) {
      this.computeForces();
      for (let i = 0; i < this.count; i++) {
        let v = this.y[i] + this.force[i] * dt + noise * gaussian(this.rng);
        v %= this.ring;
        if (v < 0) v += this.ring;
        this.y[i] = v;
      }
      this.y.sort();
    }
  }

  /** @returns {Float64Array} */
  spacings() {
    const out = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const next = i === this.count - 1 ? this.y[0] + this.ring : this.y[i + 1];
      out[i] = next - this.y[i];
    }
    return out;
  }

  /** @returns {Float64Array} */
  positions() {
    const out = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) out[i] = this.y[i] / this.ring;
    return out;
  }
}

/**
 * @param {{count?:number, beta:number, mode?:'nearest'|'allpairs', rng:Rng,
 *   dt?:number, burnSteps?:number, snapshots?:number, stride?:number}} opts
 * @returns {Float64Array}
 */
export function sampleBusSpacings(opts) {
  const count = opts.count ?? 32;
  const dt = opts.dt ?? 0.004;
  const burnSteps = opts.burnSteps ?? 6000;
  const snapshots = opts.snapshots ?? 140;
  const stride = opts.stride ?? 90;
  const gas = new BusGas({ count, beta: opts.beta, mode: opts.mode ?? 'allpairs', rng: opts.rng });
  gas.step(dt, burnSteps);
  const out = new Float64Array(count * snapshots);
  for (let k = 0; k < snapshots; k++) {
    gas.step(dt, stride);
    out.set(gas.spacings(), k * count);
  }
  return out;
}

/**
 * @param {number} n
 * @param {Rng} rng
 * @returns {Float64Array}
 */
export function poissonGaps(n, rng) {
  const pts = new Float64Array(n);
  for (let i = 0; i < n; i++) pts[i] = rng();
  pts.sort();
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const next = i === n - 1 ? pts[0] + 1 : pts[i + 1];
    out[i] = (next - pts[i]) * n;
  }
  return out;
}

/**
 * @param {number} shape
 * @param {Rng} rng
 * @returns {number}
 */
export function sampleGamma(shape, rng) {
  if (shape < 1) return sampleGamma(shape + 1, rng) * Math.pow(rng(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = gaussian(rng);
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) continue;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * @param {number} n
 * @param {Rng} rng
 * @returns {Float64Array}
 */
export function buildGoe(n, rng) {
  const m = new Float64Array(n * n);
  const off = Math.sqrt(1 / n);
  const diag = Math.sqrt(2 / n);
  for (let i = 0; i < n; i++) {
    m[i * n + i] = gaussian(rng) * diag;
    for (let j = i + 1; j < n; j++) {
      const v = gaussian(rng) * off;
      m[i * n + j] = v;
      m[j * n + i] = v;
    }
  }
  return m;
}

/**
 * @param {number} n
 * @param {Rng} rng
 * @returns {Float64Array}
 */
export function buildGue(n, rng) {
  const size = 2 * n;
  const m = new Float64Array(size * size);
  const s = Math.sqrt(1 / (2 * n));
  const diag = Math.sqrt(1 / n);
  /** @type {(i:number,j:number,re:number,im:number)=>void} */
  const put = (i, j, re, im) => {
    m[i * size + j] = re;
    m[i * size + (n + j)] = -im;
    m[(n + i) * size + j] = im;
    m[(n + i) * size + (n + j)] = re;
  };
  for (let i = 0; i < n; i++) {
    put(i, i, gaussian(rng) * diag, 0);
    for (let j = i + 1; j < n; j++) {
      const re = gaussian(rng) * s;
      const im = gaussian(rng) * s;
      put(i, j, re, im);
      put(j, i, re, -im);
    }
  }
  return m;
}

/**
 * @param {Float64Array} matrix
 * @param {number} n
 * @param {{sweeps?:number, tol?:number}} [opts]
 * @returns {Float64Array}
 */
export function jacobiEigenvalues(matrix, n, opts = {}) {
  const sweeps = opts.sweeps ?? 80;
  const tol = opts.tol ?? 1e-12;
  const a = Float64Array.from(matrix);
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) off += a[p * n + q] * a[p * n + q];
    }
    if (Math.sqrt(off) < tol) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q];
        if (Math.abs(apq) < 1e-300) continue;
        const app = a[p * n + p];
        const aqq = a[q * n + q];
        const theta = (aqq - app) / (2 * apq);
        const sign = theta >= 0 ? 1 : -1;
        const t = sign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        a[p * n + p] = app - t * apq;
        a[q * n + q] = aqq + t * apq;
        a[p * n + q] = 0;
        a[q * n + p] = 0;
        for (let k = 0; k < n; k++) {
          if (k === p || k === q) continue;
          const akp = a[k * n + p];
          const akq = a[k * n + q];
          const np = c * akp - s * akq;
          const nq = s * akp + c * akq;
          a[k * n + p] = np;
          a[p * n + k] = np;
          a[k * n + q] = nq;
          a[q * n + k] = nq;
        }
      }
    }
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i * n + i];
  out.sort();
  return out;
}

/**
 * @param {1|2} beta
 * @param {number} size
 * @param {Rng} rng
 * @returns {Float64Array}
 */
export function sampleLevels(beta, size, rng) {
  if (beta === 1) return jacobiEigenvalues(buildGoe(size, rng), size);
  const doubled = jacobiEigenvalues(buildGue(size, rng), 2 * size);
  const out = new Float64Array(size);
  for (let i = 0; i < size; i++) out[i] = doubled[2 * i];
  return out;
}

/**
 * @param {Float64Array} levels
 * @returns {Float64Array}
 */
export function unfoldLevels(levels) {
  const n = levels.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = n * semicircleCdf(levels[i]);
  return out;
}

/**
 * @param {{beta:1|2, size?:number, samples?:number, rng:Rng, bulk?:number}} opts
 * @returns {Float64Array}
 */
export function ensembleSpacings(opts) {
  const size = opts.size ?? 24;
  const samples = opts.samples ?? 60;
  const bulk = opts.bulk ?? 0.6;
  /** @type {number[]} */
  const all = [];
  for (let k = 0; k < samples; k++) {
    const unfolded = unfoldLevels(sampleLevels(opts.beta, size, opts.rng));
    const keep = Math.max(4, Math.round(size * bulk));
    const start = Math.floor((size - keep) / 2);
    for (let i = start; i < start + keep - 1; i++) all.push(unfolded[i + 1] - unfolded[i]);
  }
  return Float64Array.from(all);
}

/**
 * @param {ArrayLike<number>} values
 * @returns {number}
 */
export function mean(values) {
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i];
  return s / values.length;
}

/**
 * @param {ArrayLike<number>} values
 * @param {number} limit
 * @returns {number}
 */
export function fractionBelow(values, limit) {
  let c = 0;
  for (let i = 0; i < values.length; i++) if (values[i] < limit) c++;
  return c / values.length;
}

/**
 * @param {ArrayLike<number>} values
 * @param {{bins?:number, max?:number}} [opts]
 * @returns {{centers:number[], density:number[], width:number}}
 */
export function histogram(values, opts = {}) {
  const bins = opts.bins ?? 40;
  const max = opts.max ?? 4;
  const width = max / bins;
  const counts = new Float64Array(bins);
  const n = values.length;
  for (let i = 0; i < n; i++) {
    const b = Math.floor(values[i] / width);
    if (b >= 0 && b < bins) counts[b]++;
  }
  /** @type {number[]} */
  const centers = [];
  /** @type {number[]} */
  const density = [];
  for (let b = 0; b < bins; b++) {
    centers.push((b + 0.5) * width);
    density.push(counts[b] / (n * width));
  }
  return { centers, density, width };
}

/**
 * @param {number[][]} matrix
 * @param {number[]} rhs
 * @returns {number[]}
 */
function solveLinear(matrix, rhs) {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    const tmp = a[col];
    a[col] = a[pivot];
    a[pivot] = tmp;
    const p = a[col][col];
    if (Math.abs(p) < 1e-14) return new Array(n).fill(NaN);
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col] / p;
      for (let c = col; c <= n; c++) a[r][c] -= factor * a[col][c];
    }
  }
  return a.map((row, i) => row[n] / a[i][i]);
}

/**
 * @param {ArrayLike<number>} values
 * @param {{lo?:number, hi?:number, bins?:number, minCount?:number}} [opts]
 * @returns {{exponent:number, points:{s:number, density:number}[]}}
 */
export function fitExponent(values, opts = {}) {
  const lo = opts.lo ?? 0.06;
  const hi = opts.hi ?? 0.9;
  const bins = opts.bins ?? 14;
  const minCount = opts.minCount ?? 6;
  const width = (hi - lo) / bins;
  const counts = new Float64Array(bins);
  const n = values.length;
  for (let i = 0; i < n; i++) {
    const s = values[i];
    if (s >= lo && s < hi) counts[Math.floor((s - lo) / width)]++;
  }
  /** @type {{s:number, density:number}[]} */
  const points = [];
  for (let b = 0; b < bins; b++) {
    if (counts[b] < minCount) continue;
    points.push({ s: lo + (b + 0.5) * width, density: counts[b] / (n * width) });
  }
  if (points.length < 4) return { exponent: NaN, points };
  const basis = points.map((p) => [1, Math.log(p.s), p.s]);
  const target = points.map((p) => Math.log(p.density));
  /** @type {number[][]} */
  const normal = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const rhs = [0, 0, 0];
  for (let i = 0; i < points.length; i++) {
    for (let r = 0; r < 3; r++) {
      rhs[r] += basis[i][r] * target[i];
      for (let c = 0; c < 3; c++) normal[r][c] += basis[i][r] * basis[i][c];
    }
  }
  const coeffs = solveLinear(normal, rhs);
  return { exponent: coeffs[1], points };
}

/**
 * @param {ArrayLike<number>} sample
 * @param {(s:number)=>number} cdf
 * @returns {number}
 */
export function ksToCdf(sample, cdf) {
  const xs = Float64Array.from(sample);
  xs.sort();
  const n = xs.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const f = cdf(xs[i]);
    d = Math.max(d, Math.abs((i + 1) / n - f), Math.abs(f - i / n));
  }
  return d;
}

/**
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @returns {number}
 */
export function twoSampleKs(a, b) {
  const xs = Float64Array.from(a);
  const ys = Float64Array.from(b);
  xs.sort();
  ys.sort();
  let i = 0;
  let j = 0;
  let d = 0;
  while (i < xs.length && j < ys.length) {
    const v = Math.min(xs[i], ys[j]);
    while (i < xs.length && xs[i] <= v) i++;
    while (j < ys.length && ys[j] <= v) j++;
    d = Math.max(d, Math.abs(i / xs.length - j / ys.length));
  }
  return d;
}
