// @ts-check
// Draws a lattice onto a canvas. Knows nothing about percolation — it is handed
// the grid and the pre-computed spanning mask and just paints cells.

/**
 * @typedef {{ ground: string, filled: string, span: string, spanEdge: string }} Palette
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Uint8Array} grid open/blocked, length L*L
 * @param {Uint8Array} mask spanning-cluster membership, length L*L
 * @param {number} L
 * @param {Palette} palette
 */
export function drawLattice(ctx, grid, mask, L, palette) {
  const canvas = ctx.canvas;
  const cell = Math.floor(canvas.width / L);
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < L; r++) {
    for (let c = 0; c < L; c++) {
      const i = r * L + c;
      if (!grid[i]) continue;
      ctx.fillStyle = mask[i] ? palette.span : palette.filled;
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  }
  // A thin outline of the spanning cluster to make the connected path pop.
  if (cell >= 5) {
    ctx.fillStyle = palette.spanEdge;
    for (let r = 0; r < L; r++) {
      for (let c = 0; c < L; c++) {
        if (!mask[r * L + c]) continue;
        const up = r > 0 && mask[(r - 1) * L + c];
        const left = c > 0 && mask[r * L + (c - 1)];
        if (!up) ctx.fillRect(c * cell, r * cell, cell, 1);
        if (!left) ctx.fillRect(c * cell, r * cell, 1, cell);
      }
    }
  }
}

/** @returns {number} the integer pixel size the canvas should use for L cells */
export function fitCanvas(canvas, L, target) {
  const cell = Math.max(2, Math.floor(target / L));
  const size = cell * L;
  canvas.width = size;
  canvas.height = size;
  return size;
}
