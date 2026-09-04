// @ts-check
/**
 * Deterministic force-directed layout. Presentation maths, kept out of both the
 * domain module and the renderer: it takes a graph and returns coordinates, and
 * it touches no canvas and no DOM.
 *
 * Fruchterman-Reingold, seeded, fixed iteration count, so the picture is the
 * same every time the page is opened and the screenshot in the journal is the
 * layout a reader will actually see.
 */

/** @typedef {import('./network.js').Graph} Graph */

/**
 * @param {Graph} graph
 * @param {() => number} rng
 * @param {number} [iterations]
 * @returns {{ x: Float64Array, y: Float64Array }}
 */
export function forceLayout(graph, rng, iterations = 320) {
  const { n, edges, degree } = graph;
  const x = new Float64Array(n);
  const y = new Float64Array(n);

  // Seed hubs near the middle and leaves out at the rim. Pure cosmetics, but it
  // keeps the relaxation from having to untangle a hairball first.
  const maxDeg = Math.max(1, ...degree);
  for (let i = 0; i < n; i++) {
    const radius = 0.08 + 0.42 * (1 - degree[i] / maxDeg) + 0.04 * rng();
    const angle = rng() * Math.PI * 2;
    x[i] = 0.5 + radius * Math.cos(angle);
    y[i] = 0.5 + radius * Math.sin(angle);
  }

  const k = Math.sqrt(1 / n);
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  let temperature = 0.12;

  for (let step = 0; step < iterations; step++) {
    dx.fill(0);
    dy.fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ux = x[i] - x[j];
        let uy = y[i] - y[j];
        let d2 = ux * ux + uy * uy;
        if (d2 < 1e-9) {
          ux = (rng() - 0.5) * 1e-3;
          uy = (rng() - 0.5) * 1e-3;
          d2 = ux * ux + uy * uy + 1e-9;
        }
        const d = Math.sqrt(d2);
        const force = (k * k) / d;
        const fx = (ux / d) * force;
        const fy = (uy / d) * force;
        dx[i] += fx;
        dy[i] += fy;
        dx[j] -= fx;
        dy[j] -= fy;
      }
    }

    for (const [u, v] of edges) {
      const ux = x[u] - x[v];
      const uy = y[u] - y[v];
      const d = Math.sqrt(ux * ux + uy * uy) + 1e-9;
      const force = (d * d) / k;
      const fx = (ux / d) * force;
      const fy = (uy / d) * force;
      dx[u] -= fx;
      dy[u] -= fy;
      dx[v] += fx;
      dy[v] += fy;
    }

    for (let i = 0; i < n; i++) {
      const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) + 1e-9;
      const limit = Math.min(d, temperature);
      x[i] += (dx[i] / d) * limit;
      y[i] += (dy[i] / d) * limit;
    }
    temperature *= 0.985;
  }

  return normalise(x, y, n);
}

/**
 * @param {Float64Array} x
 * @param {Float64Array} y
 * @param {number} n
 */
function normalise(x, y, n) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    if (x[i] < minX) minX = x[i];
    if (x[i] > maxX) maxX = x[i];
    if (y[i] < minY) minY = y[i];
    if (y[i] > maxY) maxY = y[i];
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const offX = (span - (maxX - minX)) / 2;
  const offY = (span - (maxY - minY)) / 2;
  for (let i = 0; i < n; i++) {
    x[i] = (x[i] - minX + offX) / span;
    y[i] = (y[i] - minY + offY) / span;
  }
  return { x, y };
}
