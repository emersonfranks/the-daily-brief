// @ts-check

/**
 * Curve fitting and summary statistics for the RSA measurements. Pure numerics,
 * no DOM, so the browser and `node --test` fit the same way.
 */

/**
 * @param {number[]} values
 * @returns {{ mean: number, sd: number, n: number, min: number, max: number }}
 */
export function summarise(values) {
  const n = values.length;
  if (n === 0) return { mean: NaN, sd: NaN, n: 0, min: NaN, max: NaN };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n < 2 ? 0 : values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { mean, sd: Math.sqrt(variance), n, min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Ordinary least squares of y on x.
 * @param {number[]} x
 * @param {number[]} y
 * @returns {{ slope: number, intercept: number, r2: number }}
 */
export function linearFit(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) };
}

/**
 * Fit Feder's law, coverage(t) = jamming - A * t^(-alpha), without assuming the
 * jamming value. The limit is grid-searched and, at each candidate, the residual
 * deficit is regressed log-log against time; the candidate with the best fit wins.
 *
 * Returning `alpha` as a free parameter is deliberate: the exponent is the claim
 * under test, so it must not be pinned to the value the literature predicts.
 *
 * @param {{ t: number, coverage: number }[]} points
 * @returns {{ jamming: number, alpha: number, amplitude: number, r2: number, points: number }}
 */
export function fitFeder(points) {
  const usable = points.filter((p) => p.t > 0 && Number.isFinite(p.coverage));
  const maxCoverage = Math.max(...usable.map((p) => p.coverage));
  let best = { jamming: NaN, alpha: NaN, amplitude: NaN, r2: -Infinity, points: usable.length };
  for (let step = 0; step <= 3000; step += 1) {
    const jamming = maxCoverage + 1e-6 + step * 0.0001;
    if (jamming > maxCoverage + 0.31) break;
    /** @type {number[]} */ const lx = [];
    /** @type {number[]} */ const ly = [];
    for (const p of usable) {
      const deficit = jamming - p.coverage;
      if (deficit <= 0) continue;
      lx.push(Math.log(p.t));
      ly.push(Math.log(deficit));
    }
    if (lx.length < 4) continue;
    const fit = linearFit(lx, ly);
    if (fit.r2 > best.r2) {
      best = {
        jamming,
        alpha: -fit.slope,
        amplitude: Math.exp(fit.intercept),
        r2: fit.r2,
        points: lx.length,
      };
    }
  }
  return best;
}

/**
 * Log-spaced sample times, inclusive of both ends.
 * @param {number} from
 * @param {number} to
 * @param {number} count
 * @returns {number[]}
 */
export function logSpace(from, to, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(from * (to / from) ** (i / (count - 1)));
  }
  return out;
}
