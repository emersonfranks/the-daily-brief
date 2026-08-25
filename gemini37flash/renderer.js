// @ts-check

/**
 * @typedef {Object} RenderOptions
 * @property {boolean} isNeuralMode
 * @property {number} activeAvalancheSize
 * @property {number} activeDuration
 * @property {number[]} activeWaveActivity
 */

export class SocRenderer {
  /**
   * @param {HTMLCanvasElement} simCanvas
   * @param {HTMLCanvasElement} chartCanvas
   */
  constructor(simCanvas, chartCanvas) {
    this.simCanvas = simCanvas;
    this.simCtx = /** @type {CanvasRenderingContext2D} */ (simCanvas.getContext('2d'));
    this.chartCanvas = chartCanvas;
    this.chartCtx = /** @type {CanvasRenderingContext2D} */ (chartCanvas.getContext('2d'));

    this.sandPalette = [
      '#0d131f',
      '#1e3a5f',
      '#d97706',
      '#fbbf24',
      '#ffffff'
    ];

    this.neuralPalette = [
      '#090d16',
      '#1e1b4b',
      '#4338ca',
      '#06b6d4',
      '#ffffff'
    ];
  }

  /**
   * Adjusts canvas backing resolution for high-DPI displays.
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   * @returns {{ width: number, height: number }}
   */
  static resizeCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    return { width: rect.width, height: rect.height };
  }

  /**
   * Renders the lattice state in either Sandpile or Neural Cortex mode.
   * @param {Int32Array} grid
   * @param {number} gridSize
   * @param {RenderOptions} options
   */
  renderLattice(grid, gridSize, options) {
    const { width, height } = SocRenderer.resizeCanvas(this.simCanvas, this.simCtx);
    const ctx = this.simCtx;
    ctx.clearRect(0, 0, width, height);

    const cellSize = Math.min(width, height) / gridSize;
    const offsetX = (width - cellSize * gridSize) / 2;
    const offsetY = (height - cellSize * gridSize) / 2;

    const isNeural = options.isNeuralMode;
    const palette = isNeural ? this.neuralPalette : this.sandPalette;

    if (isNeural) {
      ctx.fillStyle = '#060911';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
      ctx.lineWidth = 1;

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const cx = offsetX + (x + 0.5) * cellSize;
          const cy = offsetY + (y + 0.5) * cellSize;

          if (x + 1 < gridSize) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + cellSize, cy);
            ctx.stroke();
          }
          if (y + 1 < gridSize) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx, cy + cellSize);
            ctx.stroke();
          }
        }
      }

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const idx = y * gridSize + x;
          const val = grid[idx];
          const cx = offsetX + (x + 0.5) * cellSize;
          const cy = offsetY + (y + 0.5) * cellSize;
          const r = Math.max(2, (cellSize / 2.6) * (0.4 + Math.min(val, 4) * 0.15));

          const colorIdx = Math.min(val, 4);
          ctx.fillStyle = palette[colorIdx];

          if (val >= 3) {
            ctx.shadowColor = val >= 4 ? '#ffffff' : '#06b6d4';
            ctx.shadowBlur = val >= 4 ? 12 : 6;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, width, height);

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const idx = y * gridSize + x;
          const val = grid[idx];
          const px = offsetX + x * cellSize;
          const py = offsetY + y * cellSize;

          const colorIdx = Math.min(val, 4);
          ctx.fillStyle = palette[colorIdx];
          ctx.fillRect(px, py, cellSize - 0.5, cellSize - 0.5);

          if (val >= 4) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px + cellSize * 0.2, py + cellSize * 0.2, cellSize * 0.6, cellSize * 0.6);
          }
        }
      }
    }

    ctx.restore();
  }

  /**
   * Renders the real-time Log-Log Power Law Distribution chart.
   * @param {import('./engine.js').PowerLawFit} fit
   * @param {number} totalAvalanches
   */
  renderChart(fit, totalAvalanches) {
    const { width, height } = SocRenderer.resizeCanvas(this.chartCanvas, this.chartCtx);
    const ctx = this.chartCtx;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#0c121e';
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 28, right: 24, bottom: 44, left: 56 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    const points = fit.binnedPoints;
    if (points.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Accumulating avalanche cascade events (${totalAvalanches} recorded)...`,
        width / 2,
        height / 2
      );
      ctx.restore();
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i++) {
      const x = points[i][0];
      const y = points[i][1];
      if (x > 0 && y > 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }

    if (minX >= maxX || minY >= maxY) {
      ctx.restore();
      return;
    }

    const logMinX = Math.floor(Math.log10(minX));
    const logMaxX = Math.ceil(Math.log10(maxX));
    const logMinY = Math.floor(Math.log10(minY));
    const logMaxY = Math.ceil(Math.log10(maxY));

    /**
     * @param {number} x
     * @param {number} y
     * @returns {[number, number]}
     */
    const toScreen = (x, y) => {
      const lx = Math.log10(x);
      const ly = Math.log10(y);
      const px = padding.left + ((lx - logMinX) / (logMaxX - logMinX)) * plotWidth;
      const py = padding.top + plotHeight - ((ly - logMinY) / (logMaxY - logMinY)) * plotHeight;
      return [px, py];
    };

    ctx.strokeStyle = '#1e293b';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';

    for (let lx = logMinX; lx <= logMaxX; lx++) {
      const val = Math.pow(10, lx);
      const [px] = toScreen(val, Math.pow(10, logMinY));
      ctx.beginPath();
      ctx.moveTo(px, padding.top);
      ctx.lineTo(px, padding.top + plotHeight);
      ctx.stroke();
      ctx.fillText(`10^${lx}`, px, padding.top + plotHeight + 16);
    }

    ctx.textAlign = 'right';
    for (let ly = logMinY; ly <= logMaxY; ly++) {
      const val = Math.pow(10, ly);
      const [, py] = toScreen(Math.pow(10, logMinX), val);
      ctx.beginPath();
      ctx.moveTo(padding.left, py);
      ctx.lineTo(padding.left + plotWidth, py);
      ctx.stroke();
      ctx.fillText(`10^${ly}`, padding.left - 8, py + 3);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Avalanche Size s (topples / spikes)', padding.left + plotWidth / 2, height - 10);

    ctx.save();
    ctx.translate(14, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Probability Density P(s)', 0, 0);
    ctx.restore();

    if (points.length >= 3 && fit.rSquared > 0) {
      const firstX = points[0][0];
      const lastX = points[points.length - 1][0];
      const p0 = points[0][1];
      const predLastY = p0 * Math.pow(lastX / firstX, -fit.exponent);

      const [sx0, sy0] = toScreen(firstX, p0);
      const [sx1, sy1] = toScreen(lastX, predLastY);

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx1, sy1);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (let i = 0; i < points.length; i++) {
      const [px, py] = toScreen(points[i][0], points[i][1]);
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const fitLabel = `Power-Law Fit: \u03c4 = ${fit.exponent.toFixed(2)}  (R\u00b2 = ${fit.rSquared.toFixed(2)})`;
    ctx.fillText(fitLabel, width - padding.right - 8, padding.top + 18);

    ctx.restore();
  }
}
