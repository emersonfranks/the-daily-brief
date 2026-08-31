// @ts-check

/**
 * @fileoverview Canvas & SVG Renderer for Dual-Domain Rate-Distortion Allostatic Categorization.
 * Renders the 2D feature projection of sensory inputs and centroids, soft probabilistic assignment
 * links, and the live Rate-Distortion tradeoff curve with bifurcation markers.
 */

/**
 * @typedef {import('./simulation.js').Stimulus} Stimulus
 * @typedef {import('./simulation.js').CodebookState} CodebookState
 */

const CLUSTER_COLORS = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red (threat)
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];

/**
 * Render the 2D Feature Space Map showing stimuli, centroids, and probabilistic assignment halos.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Stimulus[]} stimuli
 * @param {CodebookState} state
 * @param {string} domainType - 'biology' | 'codec'
 */
export function renderFeatureMap(canvas, stimuli, state, domainType) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const padding = 35;
  const plotW = w - padding * 2;
  const plotH = h - padding * 2;

  // Clear background
  ctx.fillStyle = '#0f172a'; // Deep slate background
  ctx.fillRect(0, 0, w, h);

  // Draw subtle grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= 4; x++) {
    const px = padding + (x / 4) * plotW;
    ctx.moveTo(px, padding);
    ctx.lineTo(px, h - padding);
  }
  for (let y = 0; y <= 4; y++) {
    const py = padding + (y / 4) * plotH;
    ctx.moveTo(padding, py);
    ctx.lineTo(w - padding, py);
  }
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(domainType === 'biology' ? 'Sensory Intensity (Feature X₁)' : 'Signal Amplitude (Dim 1)', w / 2, h - 10);
  ctx.save();
  ctx.translate(14, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(domainType === 'biology' ? 'Spectral Roughness (Feature X₂)' : 'Spectral Variance (Dim 2)', 0, 0);
  ctx.restore();

  // Coordinate mapping helper (features are roughly in [0, 1])
  /**
   * @param {number[]} feat
   * @returns {[number, number]}
   */
  const toScreen = (feat) => {
    const sx = padding + Math.max(0, Math.min(1, feat[0])) * plotW;
    const sy = h - padding - Math.max(0, Math.min(1, feat[1])) * plotH;
    return [sx, sy];
  };

  // Draw probabilistic assignment lines between stimuli and active centroids
  for (let i = 0; i < stimuli.length; i++) {
    const stim = stimuli[i];
    const [sx, sy] = toScreen(stim.features);

    for (let k = 0; k < state.centroids.length; k++) {
      const prob = state.conditionalProb[i][k];
      if (prob > 0.05 && state.clusterPriors[k] > 0.02) {
        const [cx, cy] = toScreen(state.centroids[k]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(cx, cy);
        const color = CLUSTER_COLORS[k % CLUSTER_COLORS.length];
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.min(0.8, prob * 0.9);
        ctx.lineWidth = Math.max(1, prob * 4);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1.0;

  // Draw active centroids
  for (let k = 0; k < state.centroids.length; k++) {
    const prior = state.clusterPriors[k];
    if (prior < 0.02) continue;

    const [cx, cy] = toScreen(state.centroids[k]);
    const radius = 10 + prior * 25;
    const color = CLUSTER_COLORS[k % CLUSTER_COLORS.length];

    // Glow ring
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius * 1.8);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Centroid core
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Centroid label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`C${k + 1}`, cx, cy);
  }

  // Draw individual stimuli
  for (let i = 0; i < stimuli.length; i++) {
    const stim = stimuli[i];
    const [sx, sy] = toScreen(stim.features);

    ctx.fillStyle = stim.isThreat ? '#ef4444' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Stimulus label
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(` ${stim.label}`, sx + 6, sy - 2);
  }
}

/**
 * Render the Rate-Distortion Curve with the current operating point and bifurcation lines.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {CodebookState[]} sweep
 * @param {CodebookState} currentState
 * @param {{beta: number, fromCount: number, toCount: number}[]} bifurcations
 */
export function renderRateDistortionCurve(canvas, sweep, currentState, bifurcations) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const padL = 45;
  const padR = 25;
  const padT = 25;
  const padB = 35;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, w, h);

  // Find max rate and distortion for scaling
  let maxRate = 2.5;
  let maxDist = 0.22;
  for (const s of sweep) {
    if (s.rate > maxRate) maxRate = s.rate;
    if (s.distortion > maxDist) maxDist = s.distortion;
  }

  /**
   * Map (Distortion, Rate) to canvas coordinates
   * @param {number} dist
   * @param {number} rate
   * @returns {[number, number]}
   */
  const toScreen = (dist, rate) => {
    const x = padL + (1 - Math.max(0, Math.min(1, dist / maxDist))) * plotW;
    const y = padT + (1 - Math.max(0, Math.min(1, rate / maxRate))) * plotH;
    return [x, y];
  };

  // Draw grid & axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = 0; r <= 4; r++) {
    const py = padT + (r / 4) * plotH;
    ctx.moveTo(padL, py);
    ctx.lineTo(w - padR, py);
  }
  for (let d = 0; d <= 4; d++) {
    const px = padL + (d / 4) * plotW;
    ctx.moveTo(px, padT);
    ctx.lineTo(px, h - padB);
  }
  ctx.stroke();

  // Axis Labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Perceptual Fidelity / Inverse Distortion (1 - D)', padL + plotW / 2, h - 8);

  ctx.save();
  ctx.translate(14, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Rate I(X;X̂) (bits / ATP)', 0, 0);
  ctx.restore();

  // Draw R(D) convex curve
  if (sweep.length > 1) {
    ctx.beginPath();
    const [startX, startY] = toScreen(sweep[0].distortion, sweep[0].rate);
    ctx.moveTo(startX, startY);

    for (let i = 1; i < sweep.length; i++) {
      const [px, py] = toScreen(sweep[i].distortion, sweep[i].rate);
      ctx.lineTo(px, py);
    }

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.lineTo(startX, padT + plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Draw Current Operating Point
  const [curX, curY] = toScreen(currentState.distortion, currentState.rate);

  // Crosshairs
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(curX, padT);
  ctx.lineTo(curX, h - padB);
  ctx.moveTo(padL, curY);
  ctx.lineTo(w - padR, curY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Point dot
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(curX, curY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Floating tooltip
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = curX > w - 120 ? 'right' : 'left';
  ctx.fillText(`R: ${currentState.rate.toFixed(2)}b | D: ${currentState.distortion.toFixed(3)}`, curX + (curX > w - 120 ? -10 : 10), curY - 10);
}
