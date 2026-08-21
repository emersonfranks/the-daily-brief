// @ts-check
// Draws the spanning-probability curve P(span) vs density for the current grid
// size, with markers for the current density and the measured threshold.

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} ps densities (x)
 * @param {number[]} probs spanning probabilities (y), same length
 * @param {number} currentP marker for the reader's current density
 * @param {number} threshold measured crossing density
 */
export function drawCurve(ctx, ps, probs, currentP, threshold) {
  const { width: W, height: H } = ctx.canvas;
  const padL = 42;
  const padB = 26;
  const padT = 12;
  const padR = 12;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (p) => padL + p * plotW;
  const y = (v) => padT + (1 - v) * plotH;

  ctx.clearRect(0, 0, W, H);

  // Grid + axis labels.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = 'rgba(230,228,221,0.45)';
  ctx.font = '10px ui-monospace, monospace';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 1; g += 0.25) {
    ctx.beginPath();
    ctx.moveTo(padL, y(g));
    ctx.lineTo(W - padR, y(g));
    ctx.stroke();
    ctx.fillText(g.toFixed(2), 6, y(g) + 3);
  }
  for (let g = 0; g <= 1; g += 0.25) {
    ctx.fillText(g.toFixed(1), x(g) - 8, H - 8);
  }

  // Threshold marker.
  ctx.strokeStyle = 'rgba(240,195,104,0.55)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x(threshold), padT);
  ctx.lineTo(x(threshold), H - padB);
  ctx.stroke();
  ctx.setLineDash([]);

  // The curve.
  ctx.strokeStyle = '#e7e4dd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ps.forEach((p, i) => {
    const px = x(p);
    const py = y(probs[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Current-density marker.
  ctx.strokeStyle = '#4ea1ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x(currentP), padT);
  ctx.lineTo(x(currentP), H - padB);
  ctx.stroke();
  const idx = Math.min(ps.length - 1, Math.max(0, Math.round(currentP * (ps.length - 1))));
  ctx.fillStyle = '#4ea1ff';
  ctx.beginPath();
  ctx.arc(x(currentP), y(probs[idx]), 3.5, 0, Math.PI * 2);
  ctx.fill();
}
