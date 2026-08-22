// @ts-check

import { PercolationLattice } from './percolation-model.js';

/**
 * Visual Renderer for 2D Percolation lattice, fire spread, and electrical potential fields.
 */
export class PercolationRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLCanvasElement} chartCanvas
   */
  constructor(canvas, chartCanvas) {
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    this.chartCanvas = chartCanvas;
    /** @type {CanvasRenderingContext2D} */
    this.chartCtx = /** @type {CanvasRenderingContext2D} */ (chartCanvas.getContext('2d'));

    this.domainMode = 'fire'; // 'fire' | 'electric' | 'clusters'
    /** @type {PercolationLattice | null} */
    this.lattice = null;

    /** @type {Int32Array | null} */
    this.burnStep = null;
    this.currentBurnStep = -1;
    this.maxBurnStep = 0;

    /** @type {Float32Array | null} */
    this.potentials = null;

    /** @type {{ p: number, spanningProb: number }[] | null} */
    this.mcData = null;

    this.animating = false;
    this.palette = this.generateClusterPalette(256);
  }

  /**
   * Generate distinct HSL colors for cluster visualization.
   * @param {number} count
   * @returns {string[]}
   */
  generateClusterPalette(count) {
    const palette = [];
    for (let i = 0; i < count; i++) {
      const hue = (i * 137.5) % 360; // Golden ratio hue stepping
      palette.push(`hsl(${hue.toFixed(1)}, 65%, 55%)`);
    }
    return palette;
  }

  /**
   * Set active lattice and reset visual caches.
   * @param {PercolationLattice} lattice
   */
  setLattice(lattice) {
    this.lattice = lattice;
    this.burnStep = null;
    this.currentBurnStep = -1;
    this.potentials = null;
    this.render();
  }

  /**
   * Set dynamic fire simulation state.
   * @param {Int32Array} burnStep
   * @param {number} currentStep
   * @param {number} maxStep
   */
  setFireState(burnStep, currentStep, maxStep) {
    this.burnStep = burnStep;
    this.currentBurnStep = currentStep;
    this.maxBurnStep = maxStep;
    this.render();
  }

  /**
   * Set electrical potential field.
   * @param {Float32Array} potentials
   */
  setPotentials(potentials) {
    this.potentials = potentials;
    this.render();
  }

  /**
   * Set Monte Carlo sweep curve data.
   * @param {{ p: number, spanningProb: number }[]} data
   */
  setMonteCarloData(data) {
    this.mcData = data;
    this.renderChart();
  }

  /**
   * Main render method for the lattice canvas.
   */
  render() {
    if (!this.lattice) return;
    const { canvas, ctx } = this;
    const L = this.lattice.L;

    // Handle high-DPI
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth || 500;
    const displayHeight = canvas.clientHeight || 500;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const cellSize = displayWidth / L;

    // Background
    ctx.fillStyle = '#0f172a'; // Deep slate background
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const stats = this.lattice.stats;
    const spanningId = stats ? stats.spanningClusterId : -1;

    for (let r = 0; r < L; r++) {
      for (let c = 0; c < L; c++) {
        const idx = this.lattice.index(r, c);
        const occupied = this.lattice.grid[idx] === 1;
        const x = c * cellSize;
        const y = r * cellSize;

        if (!occupied) {
          // Empty site / clearing / insulator
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
          continue;
        }

        const clusterRoot = this.lattice.clusterMap[idx];
        const isSpanning = clusterRoot === spanningId && spanningId !== -1;

        if (this.domainMode === 'fire') {
          const step = this.burnStep ? this.burnStep[idx] : -1;

          if (step >= 0 && step <= this.currentBurnStep) {
            if (step === this.currentBurnStep && this.currentBurnStep < this.maxBurnStep) {
              // Active burning wavefront
              ctx.fillStyle = '#f59e0b'; // Bright amber flame
            } else {
              // Burnt ash
              ctx.fillStyle = '#ef4444'; // Glowing ember / burnt
            }
          } else if (isSpanning) {
            // High-risk contiguous canopy
            ctx.fillStyle = '#10b981'; // Emerald tree
          } else {
            // Isolated unburnt cluster
            ctx.fillStyle = '#059669'; // Darker green
          }
        } else if (this.domainMode === 'electric') {
          if (isSpanning && this.potentials) {
            const v = Math.max(0, Math.min(1, this.potentials[idx]));
            // Color map: 1.0 (Top, high V) = Gold/Amber, 0.0 (Bottom, low V) = Cyan/Indigo
            const hue = 190 + (1.0 - v) * 80;
            const lightness = 35 + v * 35;
            ctx.fillStyle = `hsl(${hue}, 90%, ${lightness}%)`;
          } else if (occupied) {
            // Floating, dead-end resistor
            ctx.fillStyle = '#475569';
          }
        } else {
          // Topological Cluster Mode
          if (isSpanning) {
            ctx.fillStyle = '#fbbf24'; // Golden giant component
          } else {
            const colorIdx = (clusterRoot * 17) % this.palette.length;
            ctx.fillStyle = this.palette[colorIdx];
          }
        }

        ctx.fillRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
      }
    }

    // Overlay boundary electrodes / wind direction markers
    if (this.domainMode === 'electric') {
      ctx.fillStyle = 'rgba(234, 179, 8, 0.4)';
      ctx.fillRect(0, 0, displayWidth, 3); // Top anode (1V)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.fillRect(0, displayHeight - 3, displayWidth, 3); // Bottom cathode (0V)
    } else if (this.domainMode === 'fire') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.fillRect(0, 0, 3, displayHeight); // Left ignition line
    }

    ctx.restore();
    this.renderChart();
  }

  /**
   * Render analytical charts: Phase Transition S-curve and Cluster Size Log-Log plot.
   */
  renderChart() {
    if (!this.chartCanvas) return;
    const { chartCanvas, chartCtx } = this;
    const dpr = window.devicePixelRatio || 1;
    const width = chartCanvas.clientWidth || 360;
    const height = chartCanvas.clientHeight || 200;

    if (chartCanvas.width !== width * dpr || chartCanvas.height !== height * dpr) {
      chartCanvas.width = width * dpr;
      chartCanvas.height = height * dpr;
    }

    chartCtx.save();
    chartCtx.scale(dpr, dpr);

    // Dark chart background
    chartCtx.fillStyle = '#090d16';
    chartCtx.fillRect(0, 0, width, height);

    const padLeft = 40;
    const padBottom = 30;
    const padRight = 15;
    const padTop = 20;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Grid lines
    chartCtx.strokeStyle = '#1e293b';
    chartCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (plotH * i) / 4;
      chartCtx.beginPath();
      chartCtx.moveTo(padLeft, y);
      chartCtx.lineTo(width - padRight, y);
      chartCtx.stroke();
    }

    // Critical percolation threshold vertical marker (pc = 0.5927)
    const pcX = padLeft + 0.5927 * plotW;
    chartCtx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    chartCtx.setLineDash([4, 4]);
    chartCtx.beginPath();
    chartCtx.moveTo(pcX, padTop);
    chartCtx.lineTo(pcX, padTop + plotH);
    chartCtx.stroke();
    chartCtx.setLineDash([]);

    // Label pc
    chartCtx.fillStyle = '#ef4444';
    chartCtx.font = '10px monospace';
    chartCtx.fillText('pc ≈ 0.593', pcX - 25, padTop - 6);

    // Draw theoretical sigmoid curve approximation or Monte Carlo data
    chartCtx.beginPath();
    chartCtx.strokeStyle = '#38bdf8';
    chartCtx.lineWidth = 2;

    if (this.mcData && this.mcData.length > 0) {
      for (let i = 0; i < this.mcData.length; i++) {
        const pt = this.mcData[i];
        const x = padLeft + pt.p * plotW;
        const y = padTop + (1 - pt.spanningProb) * plotH;
        if (i === 0) chartCtx.moveTo(x, y);
        else chartCtx.lineTo(x, y);
      }
      chartCtx.stroke();

      // Draw points
      chartCtx.fillStyle = '#38bdf8';
      for (const pt of this.mcData) {
        const x = padLeft + pt.p * plotW;
        const y = padTop + (1 - pt.spanningProb) * plotH;
        chartCtx.beginPath();
        chartCtx.arc(x, y, 3, 0, Math.PI * 2);
        chartCtx.fill();
      }
    } else {
      // Default theoretical curve for reference
      for (let pVal = 0; pVal <= 1; pVal += 0.02) {
        const x = padLeft + pVal * plotW;
        // Finite size smoothed sigmoid approximation: 1 / (1 + exp(-20*(p - 0.5927)))
        const prob = 1 / (1 + Math.exp(-22 * (pVal - 0.5927)));
        const y = padTop + (1 - prob) * plotH;
        if (pVal === 0) chartCtx.moveTo(x, y);
        else chartCtx.lineTo(x, y);
      }
      chartCtx.stroke();
    }

    // Current state marker
    if (this.lattice && this.lattice.stats) {
      const curP = this.lattice.stats.p;
      const curX = padLeft + curP * plotW;
      const isSpanning = this.lattice.stats.spansVertical || this.lattice.stats.spansHorizontal;
      const curY = padTop + (isSpanning ? 0 : plotH);

      chartCtx.fillStyle = isSpanning ? '#22c55e' : '#eab308';
      chartCtx.beginPath();
      chartCtx.arc(curX, curY, 6, 0, Math.PI * 2);
      chartCtx.fill();
      chartCtx.strokeStyle = '#ffffff';
      chartCtx.lineWidth = 1.5;
      chartCtx.stroke();
    }

    // Axes labels
    chartCtx.fillStyle = '#94a3b8';
    chartCtx.font = '11px sans-serif';
    chartCtx.fillText('0.0', padLeft - 10, height - 10);
    chartCtx.fillText('0.5', padLeft + plotW * 0.5 - 8, height - 10);
    chartCtx.fillText('1.0', width - padRight - 15, height - 10);
    chartCtx.fillText('Density (p) →', padLeft + plotW * 0.35, height - 10);

    chartCtx.save();
    chartCtx.translate(12, padTop + plotH * 0.65);
    chartCtx.rotate(-Math.PI / 2);
    chartCtx.fillText('Spanning Probability Π(p) →', 0, 0);
    chartCtx.restore();

    chartCtx.restore();
  }
}
